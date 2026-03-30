import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import type {
  AgentConfig,
  AgentExecutionInput,
  AgentExecutionResult,
  AgentRuntimeProfile
} from '../context.js';

export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandExecutionRequest {
  command: string;
  args: string[];
  cwd: string;
  input?: string;
}

export type CommandRunner = (
  request: CommandExecutionRequest
) => Promise<CommandExecutionResult>;

export async function runCommand(
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      stdio: 'pipe',
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`External command timed out: ${request.command}`));
    }, 30000);

    child.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr
      });
    });

    if (request.input) {
      child.stdin.write(request.input);
    }
    child.stdin.end();
  });
}

export const AGENT_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'summary', 'needsReview'],
  properties: {
    success: { type: 'boolean' },
    summary: { type: 'string' },
    needsReview: { type: 'boolean' },
    error: { type: ['string', 'null'] },
    metadata: { type: 'object' },
    deliverables: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'content'],
        properties: {
          type: {
            type: 'string',
            enum: ['document', 'code', 'test', 'config', 'design', 'review']
          },
          title: { type: 'string' },
          content: { type: 'string' }
        }
      }
    }
  }
} as const;

export function buildAgentPrompt(
  input: AgentExecutionInput,
  config: AgentConfig
): string {
  const knowledgePreview = summarizeEntries(
    input.context.knowledge.items.map((item) => `${item.id}:${item.title}`),
    8
  );
  const deliverablePreview = summarizeEntries(
    input.context.deliverables.task.map((item) => `${item.id}:${item.title}`),
    6
  );
  const sessionHint = input.context.sessions.active
    ? `${input.context.sessions.active.id} (${input.context.sessions.active.status})`
    : 'none';

  return [
    'You are executing a WebForge task through an external agent adapter.',
    'Operate inside the provided workspace and return ONLY valid JSON that matches the requested schema.',
    '',
    'Execution rules:',
    `- Provider: ${config.runtimeProfile.provider}`,
    `- Permission profile: ${config.runtimeProfile.permissionProfile}`,
    `- Workspace write allowed: ${input.context.permissions.canWriteWorkspace ? 'yes' : 'no'}`,
    `- Approval required: ${input.context.permissions.requiresApproval ? 'yes' : 'no'}`,
    `- Workspace root: ${input.context.workspace.basePath}`,
    '- Prefer concise, high-signal deliverables for the harness deliverable index.',
    '- If you are blocked by permissions or missing tools, set success=false and explain in error.',
    '- Do not emit markdown fences or extra prose outside the JSON object.',
    '',
    'Worker profile:',
    `- Name: ${config.name}`,
    `- Role: ${config.role}`,
    `- Skills: ${config.skills.join(', ') || 'none'}`,
    `- System prompt: ${config.systemPrompt}`,
    '',
    'Task:',
    `- ID: ${input.task.id}`,
    `- Title: ${input.task.title}`,
    `- Description: ${input.task.description ?? 'none'}`,
    `- Phase: ${input.context.phase.id} ${input.context.phase.name}`,
    '',
    'Workspace state:',
    `- Runtime summary: ${input.context.runtime.summary}`,
    `- Active session: ${sessionHint}`,
    `- Knowledge items: ${input.context.knowledge.items.length}`,
    `- Existing task deliverables: ${input.context.deliverables.task.length}`,
    `- Ready tasks: ${input.context.observation.counts.readyTasks}`,
    `- Blocked tasks: ${input.context.observation.counts.blockedTasks}`,
    `- Pending review items: ${input.context.observation.counts.pendingReview}`,
    `- Unread mailbox messages: ${input.context.observation.counts.unreadMessages}`,
    '',
    'Method hints:',
    `- Superpowers enabled: ${input.context.superpowers.enabled ? 'yes' : 'no'}`,
    `- Task skills: ${input.context.superpowers.taskSkills.join(', ') || 'none'}`,
    `- Required skills: ${input.context.superpowers.requiredSkills.join(', ') || 'none'}`,
    `- Execution mode: ${input.context.superpowers.executionMode ?? 'none'}`,
    `- Suggested workflow: ${input.context.superpowers.suggestedWorkflow ?? 'none'}`,
    `- Capability registry: ${
      input.context.superpowers.capabilities.map((capability) => capability.id).join(', ') ||
      'none'
    }`,
    '',
    'Knowledge preview:',
    knowledgePreview,
    '',
    'Task deliverable preview:',
    deliverablePreview,
    '',
    'Return JSON with this intent:',
    '- success: whether task execution succeeded',
    '- summary: concise execution summary',
    '- needsReview: whether review is required',
    '- error: failure reason when success=false',
    '- metadata: adapter/provider notes',
    '- deliverables: concise deliverable drafts to persist in .webforge/deliverables/'
  ].join('\n');
}

export function mapCodexArgs(
  command: string,
  input: AgentExecutionInput,
  config: AgentConfig,
  schemaPath: string,
  outputPath: string
): CommandExecutionRequest {
  const args = ['exec', '--skip-git-repo-check', '--color', 'never'];

  if (config.runtimeProfile.permissionProfile === 'workspace-write') {
    args.push('--full-auto');
  } else {
    args.push('--sandbox', 'read-only');
  }

  if (config.runtimeProfile.model) {
    args.push('--model', config.runtimeProfile.model);
  }

  args.push('--output-schema', schemaPath, '--output-last-message', outputPath);
  args.push('-C', input.context.workspace.basePath, '-');

  return {
    command,
    args,
    cwd: input.context.workspace.basePath,
    input: buildAgentPrompt(input, config)
  };
}

export function mapClaudeArgs(
  command: string,
  input: AgentExecutionInput,
  config: AgentConfig
): CommandExecutionRequest {
  const args = [
    '-p',
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(AGENT_RESULT_SCHEMA),
    '--add-dir',
    input.context.workspace.basePath,
    '--system-prompt',
    config.systemPrompt
  ];

  if (config.runtimeProfile.model) {
    args.push('--model', config.runtimeProfile.model);
  }

  args.push(
    '--permission-mode',
    config.runtimeProfile.permissionProfile === 'workspace-write' ? 'acceptEdits' : 'plan'
  );
  args.push(buildAgentPrompt(input, config));

  return {
    command,
    args,
    cwd: input.context.workspace.basePath
  };
}

export async function withTemporarySchemaFiles<T>(
  callback: (paths: { schemaPath: string; outputPath: string }) => Promise<T>
): Promise<T> {
  const tempDir = await mkdtemp(join(tmpdir(), 'webforge-agent-adapter-'));
  const schemaPath = join(tempDir, 'result-schema.json');
  const outputPath = join(tempDir, 'result.json');

  await writeFile(schemaPath, JSON.stringify(AGENT_RESULT_SCHEMA, null, 2), 'utf-8');

  try {
    return await callback({ schemaPath, outputPath });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function readStructuredOutput(
  outputPath: string,
  stdout: string
): Promise<AgentExecutionResult> {
  const preferred = await readFile(outputPath, 'utf-8').catch(() => '');
  return parseAgentExecutionResult(preferred || stdout);
}

export function parseAgentExecutionResult(raw: string): AgentExecutionResult {
  const parsed = parseLooseJson(raw);
  const success = Boolean(parsed.success);
  const summary =
    typeof parsed.summary === 'string' ? parsed.summary : success ? 'completed task' : 'task failed';
  const deliverables = Array.isArray(parsed.deliverables) ? parsed.deliverables : undefined;

  return {
    success,
    summary,
    needsReview: Boolean(parsed.needsReview),
    error: typeof parsed.error === 'string' ? parsed.error : undefined,
    metadata: isRecord(parsed.metadata) ? parsed.metadata : undefined,
    deliverables
  };
}

export function enrichResultMetadata(
  result: AgentExecutionResult,
  provider: AgentRuntimeProfile['provider'],
  mode: 'external-command' | 'bridge-fallback',
  config: AgentConfig,
  extra?: Record<string, unknown>
): AgentExecutionResult {
  return {
    ...result,
    metadata: {
      ...(result.metadata ?? {}),
      adapterProvider: provider,
      adapterMode: mode,
      adapterCommand: config.runtimeProfile.command ?? provider,
      adapterModel: config.runtimeProfile.model ?? null,
      permissionProfile: config.runtimeProfile.permissionProfile,
      ...extra
    }
  };
}

function summarizeEntries(entries: string[], limit: number): string {
  if (entries.length === 0) {
    return '- none';
  }

  const selected = entries.slice(0, limit).map((entry) => `- ${entry}`);
  if (entries.length > limit) {
    selected.push(`- ...and ${entries.length - limit} more`);
  }

  return selected.join('\n');
}

function parseLooseJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('External agent returned empty output');
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('External agent did not return JSON');
    }
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
