import { existsSync } from 'fs';
import { basename, isAbsolute, join, relative, resolve } from 'path';
import { setRuntimeWorkflowContext } from './runtime.js';
import { applySessionWorkflowContext } from './session.js';
import { upsertThreadLink } from './threads.js';
import { toWorkflowContext } from './workflow-context.js';
import { readJson, writeJson } from '../utils/file.js';
import type {
  Task,
  WorkspaceSuperpowersArtifact,
  WorkspaceSuperpowersArtifactKind,
  WorkspaceSuperpowersRun,
  WorkspaceSuperpowersRunMetadata
} from '../types/index.js';

const SUPERPOWERS_RUNS_FILE = '.webforge/superpowers-runs.json';
const TASKS_FILE = '.webforge/tasks.json';

interface SuperpowersRunsFile {
  runs: WorkspaceSuperpowersRun[];
}

export interface RecordSuperpowersRunInput {
  workflow: string;
  summary: string;
  taskId?: string;
  sessionId?: string;
  artifacts: WorkspaceSuperpowersArtifact[];
  metadata?: WorkspaceSuperpowersRunMetadata;
}

export interface SuperpowersRunReadiness {
  missingArtifacts: string[];
  missingWorktreePath: string | null;
  missingCompactSessionId: string | null;
}

export async function loadSuperpowersRuns(
  basePath: string
): Promise<WorkspaceSuperpowersRun[]> {
  const path = join(basePath, SUPERPOWERS_RUNS_FILE);
  if (!existsSync(path)) {
    return [];
  }

  const raw = await readJson<unknown>(path);
  return normalizeSuperpowersRuns(raw);
}

export async function getLatestSuperpowersRun(
  basePath: string
): Promise<WorkspaceSuperpowersRun | null> {
  const runs = await loadSuperpowersRuns(basePath);
  return runs[0] ?? null;
}

export async function recordSuperpowersRun(
  basePath: string,
  input: RecordSuperpowersRunInput
): Promise<WorkspaceSuperpowersRun> {
  const runs = await loadSuperpowersRuns(basePath);
  const recordedAt = new Date().toISOString();
  const run: WorkspaceSuperpowersRun = {
    id: buildRunId(),
    workflow: input.workflow,
    recordedAt,
    summary: input.summary,
    taskId: input.taskId,
    sessionId: input.sessionId,
    artifacts: input.artifacts.map((artifact) => normalizeArtifact(basePath, artifact)),
    metadata: normalizeRunMetadata(basePath, input.metadata)
  };
  const workflowContext = toWorkflowContext(run);

  if (run.taskId) {
    await attachRunToTask(basePath, run, workflowContext);
  }
  if (run.sessionId) {
    await applySessionWorkflowContext(run.sessionId, workflowContext, basePath);
  }
  await attachRunToRuntime(basePath, run, workflowContext);
  if (run.metadata?.threadId) {
    await upsertThreadLink(basePath, {
      id: run.metadata.threadId,
      recordedAt: run.recordedAt,
      workflow: run.workflow,
      summary: run.summary,
      runId: run.id,
      taskId: run.taskId,
      sessionId: run.sessionId,
      owner: run.metadata.owner,
      branch: run.metadata.branch,
      worktreePath: run.metadata.worktreePath,
      artifacts: run.artifacts.map((artifact) => artifact.path)
    });
  }

  await writeJson(join(basePath, SUPERPOWERS_RUNS_FILE), {
    runs: [run, ...runs]
  } satisfies SuperpowersRunsFile);

  return run;
}

export function inspectSuperpowersRun(
  basePath: string,
  run: WorkspaceSuperpowersRun
): SuperpowersRunReadiness {
  const missingArtifacts = run.artifacts
    .map((artifact) => artifact.path)
    .filter((path) => !existsSync(resolveStoredPath(basePath, path)));
  const missingWorktreePath =
    run.metadata?.worktreePath &&
    !existsSync(resolveStoredPath(basePath, run.metadata.worktreePath))
      ? run.metadata.worktreePath
      : null;
  const missingCompactSessionId =
    run.metadata?.compactFromSession &&
    !existsSync(resolveStoredPath(basePath, `.webforge/sessions/${run.metadata.compactFromSession}.json`))
      ? run.metadata.compactFromSession
      : null;

  return {
    missingArtifacts,
    missingWorktreePath,
    missingCompactSessionId
  };
}

function normalizeSuperpowersRuns(raw: unknown): WorkspaceSuperpowersRun[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeRun).filter((item): item is WorkspaceSuperpowersRun => item !== null);
  }

  if (isRecord(raw) && Array.isArray(raw.runs)) {
    return raw.runs
      .map(normalizeRun)
      .filter((item): item is WorkspaceSuperpowersRun => item !== null)
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  }

  return [];
}

function normalizeRun(raw: unknown): WorkspaceSuperpowersRun | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.workflow !== 'string') {
    return null;
  }

  return {
    id: raw.id,
    workflow: raw.workflow,
    recordedAt:
      typeof raw.recordedAt === 'string' ? raw.recordedAt : new Date().toISOString(),
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    taskId: typeof raw.taskId === 'string' ? raw.taskId : undefined,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
    artifacts: Array.isArray(raw.artifacts)
      ? raw.artifacts
          .map(normalizeArtifactShape)
          .filter((item): item is WorkspaceSuperpowersArtifact => item !== null)
      : [],
    metadata: normalizeRunMetadata(undefined, raw.metadata)
  };
}

function normalizeArtifact(
  basePath: string,
  artifact: WorkspaceSuperpowersArtifact
): WorkspaceSuperpowersArtifact {
  const absolutePath = resolveStoredPath(basePath, artifact.path);
  if (!existsSync(absolutePath)) {
    throw new Error(`artifact not found: ${artifact.path}`);
  }

  return {
    kind: artifact.kind,
    path: normalizeStoredPath(basePath, absolutePath),
    label: artifact.label ?? basename(artifact.path)
  };
}

function normalizeArtifactShape(raw: unknown): WorkspaceSuperpowersArtifact | null {
  if (!isRecord(raw) || typeof raw.path !== 'string') {
    return null;
  }

  return {
    kind: normalizeArtifactKind(raw.kind),
    path: raw.path,
    label: typeof raw.label === 'string' ? raw.label : undefined
  };
}

function normalizeRunMetadata(
  basePath: string | undefined,
  raw: unknown
): WorkspaceSuperpowersRunMetadata | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const metadata: WorkspaceSuperpowersRunMetadata = {};
  if (typeof raw.owner === 'string' && raw.owner.length > 0) {
    metadata.owner = raw.owner;
  }
  if (typeof raw.waveId === 'string' && raw.waveId.length > 0) {
    metadata.waveId = raw.waveId;
  }
  if (typeof raw.threadId === 'string' && raw.threadId.length > 0) {
    metadata.threadId = raw.threadId;
  }
  if (typeof raw.branch === 'string' && raw.branch.length > 0) {
    metadata.branch = raw.branch;
  }
  if (typeof raw.compactFromSession === 'string' && raw.compactFromSession.length > 0) {
    metadata.compactFromSession = raw.compactFromSession;
  }
  if (typeof raw.worktreePath === 'string' && raw.worktreePath.length > 0) {
    metadata.worktreePath =
      basePath === undefined
        ? raw.worktreePath
        : normalizeStoredPath(basePath, resolveStoredPath(basePath, raw.worktreePath));
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

async function attachRunToTask(
  basePath: string,
  run: WorkspaceSuperpowersRun,
  workflowContext: ReturnType<typeof toWorkflowContext>
): Promise<void> {
  const taskId = run.taskId;
  if (!taskId) {
    return;
  }

  const tasksPath = join(basePath, TASKS_FILE);
  const tasksData = await readJson<{ tasks: Task[] }>(tasksPath);
  const task = tasksData.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error(`task not found: ${taskId}`);
  }

  task.metadata = {
    ...task.metadata,
    workflow_context: workflowContext,
    superpowers_run: {
      runId: run.id,
      workflow: run.workflow,
      recordedAt: run.recordedAt,
      summary: run.summary,
      artifacts: run.artifacts.map((artifact) => artifact.path),
      metadata: run.metadata ?? {}
    }
  };
  task.workflowContext = workflowContext;

  await writeJson(tasksPath, tasksData);
}

async function attachRunToRuntime(
  basePath: string,
  run: WorkspaceSuperpowersRun,
  workflowContext: ReturnType<typeof toWorkflowContext>
): Promise<void> {
  const runtimePath = join(basePath, '.webforge', 'runtime.json');
  if (!existsSync(runtimePath)) {
    return;
  }

  const runtime = await readJson<{
    sessionId?: string | null;
    taskId?: string | null;
  }>(runtimePath);
  const sessionMatches =
    typeof runtime.sessionId === 'string' &&
    typeof run.sessionId === 'string' &&
    runtime.sessionId === run.sessionId;
  const taskMatches =
    typeof runtime.taskId === 'string' &&
    typeof run.taskId === 'string' &&
    runtime.taskId === run.taskId;

  if (!sessionMatches && !taskMatches) {
    return;
  }

  await setRuntimeWorkflowContext(basePath, workflowContext);
}

function buildRunId(): string {
  return `spr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStoredPath(basePath: string, absolutePath: string): string {
  const relativePath = relative(basePath, absolutePath).replace(/\\/g, '/');
  return relativePath.startsWith('..') ? absolutePath : relativePath || '.';
}

function resolveStoredPath(basePath: string, targetPath: string): string {
  return isAbsolute(targetPath) ? targetPath : resolve(basePath, targetPath);
}

function normalizeArtifactKind(raw: unknown): WorkspaceSuperpowersArtifactKind {
  switch (raw) {
    case 'knowledge':
    case 'decision':
    case 'plan':
    case 'compact-handoff':
    case 'thread':
    case 'worktree-metadata':
      return raw;
    case 'note':
    default:
      return 'note';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
