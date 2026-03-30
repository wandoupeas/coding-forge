import { describe, expect, it, vi } from 'vitest';
import { createAgentAdapter, normalizeRuntimeProfile } from '../../agent/adapters/index.js';
import { createClaudeCodeAgentAdapter } from '../../agent/adapters/claude-code.js';
import { createCodexAgentAdapter } from '../../agent/adapters/codex.js';
import { createStubAgentAdapter } from '../../agent/adapters/stub.js';
import {
  AGENT_RESULT_SCHEMA,
  buildAgentPrompt,
  mapClaudeArgs,
  mapCodexArgs,
  parseAgentExecutionResult,
  readStructuredOutput
} from '../../agent/adapters/command-bridge.js';

describe('agent adapters', () => {
  it('normalizes an empty profile to the stub defaults', () => {
    expect(normalizeRuntimeProfile()).toMatchObject({
      provider: 'stub',
      fallbackProvider: 'stub',
      permissionProfile: 'workspace-write'
    });
  });

  it('maps codex profiles to a real external command request', async () => {
    const runner = vi.fn(async (request: any) => {
      expect(request.command).toBe('codex');
      expect(request.args).toContain('exec');
      expect(request.args).toContain('--output-schema');
      expect(request.args).toContain('--output-last-message');
      expect(request.args).toContain('--sandbox');
      expect(request.args).toContain('read-only');
      expect(request.args).toContain('-');
      expect(request.cwd).toBe('/tmp/webforge-adapter');

      const outputIndex = request.args.indexOf('--output-last-message') + 1;
      const outputPath = request.args[outputIndex];
      await import('fs/promises').then(({ writeFile }) =>
        writeFile(
          outputPath,
          JSON.stringify({
            success: true,
            summary: 'codex executed task',
            needsReview: true,
            deliverables: [
              {
                type: 'document',
                title: 'Codex Deliverable',
                content: '# codex'
              }
            ]
          }),
          'utf-8'
        )
      );

      return {
        exitCode: 0,
        stdout: '',
        stderr: ''
      };
    });

    const adapter = createCodexAgentAdapter(createStubAgentAdapter(), runner as any);
    const result = await adapter.execute(buildInput(), buildConfig('codex', 'approval-required'));

    expect(adapter.provider).toBe('codex');
    expect(result.metadata).toMatchObject({
      adapterProvider: 'codex',
      adapterMode: 'external-command',
      permissionProfile: 'approval-required'
    });
    expect(result.summary).toBe('codex executed task');
  });

  it('maps claude-code profiles to a real external command request', async () => {
    const runner = vi.fn(async (request: any) => {
      expect(request.command).toBe('claude');
      expect(request.args).toContain('-p');
      expect(request.args).toContain('--json-schema');
      expect(request.args).toContain(JSON.stringify(AGENT_RESULT_SCHEMA));
      expect(request.args).toContain('--permission-mode');
      expect(request.args).toContain('acceptEdits');
      expect(request.cwd).toBe('/tmp/webforge-adapter');

      return {
        exitCode: 0,
        stdout: JSON.stringify({
          success: true,
          summary: 'claude executed task',
          needsReview: true,
          deliverables: [
            {
              type: 'design',
              title: 'Claude Deliverable',
              content: '# claude'
            }
          ]
        }),
        stderr: ''
      };
    });

    const adapter = createClaudeCodeAgentAdapter(createStubAgentAdapter(), runner as any);
    const result = await adapter.execute(
      buildInput('设计页面'),
      buildConfig('claude-code', 'workspace-write')
    );

    expect(adapter.provider).toBe('claude-code');
    expect(result.metadata).toMatchObject({
      adapterProvider: 'claude-code',
      adapterMode: 'external-command',
      permissionProfile: 'workspace-write'
    });
    expect(result.summary).toBe('claude executed task');
  });

  it('falls back to the stub adapter when the external command fails', async () => {
    const adapter = createClaudeCodeAgentAdapter(
      createStubAgentAdapter(),
      vi.fn(async () => {
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'claude unavailable'
        };
      }) as any
    );

    const result = await adapter.execute(buildInput('设计页面'), buildConfig('claude-code'));

    expect(result.metadata).toMatchObject({
      adapterProvider: 'claude-code',
      adapterMode: 'bridge-fallback',
      adapterFallbackProvider: 'stub'
    });
    expect(result.deliverables?.[0]?.content).toContain('Adapter: claude-code');
  });

  it('falls back to the stub adapter when codex returns a failing exit code', async () => {
    const adapter = createCodexAgentAdapter(
      createStubAgentAdapter(),
      vi.fn(async () => {
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'codex unavailable'
        };
      }) as any
    );

    const result = await adapter.execute(buildInput(), buildConfig('codex'));

    expect(result.metadata).toMatchObject({
      adapterProvider: 'codex',
      adapterMode: 'bridge-fallback',
      adapterFallbackProvider: 'stub'
    });
  });

  it('covers argument mapping and structured output helpers', async () => {
    const codexArgs = mapCodexArgs(
      'codex',
      buildInput(),
      buildConfig('codex', 'workspace-write', 'gpt-5'),
      '/tmp/schema.json',
      '/tmp/output.json'
    );
    expect(codexArgs.args).toContain('--full-auto');
    expect(codexArgs.args).toContain('--model');
    expect(codexArgs.args).toContain('gpt-5');

    const claudeArgs = mapClaudeArgs(
      'claude',
      buildInput(),
      buildConfig('claude-code', 'read-only', 'sonnet')
    );
    expect(claudeArgs.args).toContain('plan');
    expect(claudeArgs.args).toContain('sonnet');

    await expect(
      readStructuredOutput(
        '/tmp/webforge-missing-structured-output.json',
        JSON.stringify({ success: true, summary: 'stdout result', needsReview: false })
      )
    ).resolves.toMatchObject({
      success: true,
      summary: 'stdout result'
    });

    expect(
      parseAgentExecutionResult('prefix {"success":false,"needsReview":false} suffix')
    ).toMatchObject({
      success: false,
      summary: 'task failed'
    });

    expect(() => parseAgentExecutionResult('')).toThrow(/empty output/);
  });

  it('includes superpowers capability registry hints in the external agent prompt', () => {
    const prompt = buildAgentPrompt(buildInput(), buildConfig('codex'));

    expect(prompt).toContain('Suggested workflow: subagent-driven-development');
    expect(prompt).toContain('Capability registry: writing-plans, subagent-driven-development');
  });
});

function buildInput(title: string = '实现后端接口') {
  return {
    task: {
      id: 'T001',
      phase: 'P1',
      title,
      description: 'adapter test',
      status: 'ready',
      assignee: 'backend',
      depends_on: [],
      priority: 1,
      created_at: '2026-03-30T00:00:00.000Z',
      updated_at: '2026-03-30T00:00:00.000Z'
    },
    context: {
      workspace: {
        basePath: '/tmp/webforge-adapter',
        paths: {}
      },
      runtime: {
        summary: 'runtime summary'
      },
      task: {
        id: 'T001'
      },
      phase: {
        id: 'P1',
        name: 'Core'
      },
      knowledge: {
        items: []
      },
      deliverables: {
        task: []
      },
      sessions: {
        active: null
      },
      superpowers: {
        enabled: true,
        requiredSkills: ['writing-plans'],
        taskSkills: ['backend-patterns'],
        executionMode: 'subagent',
        suggestedWorkflow: 'subagent-driven-development',
        capabilities: [
          {
            id: 'writing-plans',
            kind: 'workflow',
            owner: 'superpowers',
            purpose: '将稳定 spec 拆解成可执行实施步骤',
            writes: ['.webforge/tasks.json', '.webforge/phases.json'],
            artifacts: ['docs/superpowers/plans/'],
            recommended: true
          },
          {
            id: 'subagent-driven-development',
            kind: 'workflow',
            owner: 'superpowers',
            purpose: '在当前会话中按任务波次调度隔离子 agent',
            writes: ['.webforge/sessions/', '.webforge/mailboxes/'],
            artifacts: ['wave metadata', 'review markers'],
            recommended: true
          }
        ]
      },
      permissions: {
        profile: 'workspace-write',
        canWriteWorkspace: true,
        requiresApproval: false,
        allowedActions: ['read:workspace', 'write:workspace', 'mutate:state'],
        blockedActions: ['external:side-effects']
      },
      observation: {
        counts: {
          readyTasks: 1,
          blockedTasks: 0,
          pendingReview: 0,
          unreadMessages: 0,
          knowledgeItems: 0,
          taskDeliverables: 0,
          relatedSessions: 0
        },
        readyTaskIds: ['T001'],
        blockedTaskIds: [],
        pendingReviewIds: [],
        workersWithUnread: [],
        mailbox: {
          workerId: 'backend',
          unreadForWorker: 0
        }
      }
    }
  } as any;
}

function buildConfig(
  provider: 'stub' | 'codex' | 'claude-code',
  permissionProfile: 'workspace-write' | 'approval-required' | 'read-only' = 'workspace-write',
  model?: string
) {
  return {
    name: provider === 'claude-code' ? 'Claude Worker' : 'Codex Worker',
    role: provider === 'claude-code' ? 'frontend' : 'backend',
    systemPrompt: 'test',
    skills: provider === 'claude-code' ? ['vue'] : ['typescript'],
    runtimeProfile: normalizeRuntimeProfile({
      provider,
      fallback_provider: 'stub',
      permission_profile: permissionProfile,
      command: provider === 'claude-code' ? 'claude' : 'codex',
      model
    })
  } as const;
}
