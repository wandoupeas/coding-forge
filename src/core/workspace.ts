/**
 * Workspace v0.2 契约与状态管理
 */

import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { buildSuperpowersRegistry } from './superpowers-registry.js';
import { normalizeWorkflowContext } from './workflow-context.js';
import { createDefaultConfig, saveConfig } from '../utils/config.js';
import { ensureDir, readJson, writeJson } from '../utils/file.js';
import type {
  WorkspaceInitOptions,
  WorkspaceIndexes,
  WorkspacePaths,
  WorkspaceRuntime,
  WorkspaceRuntimeStatus,
  WorkspaceState,
  Phase,
  Task
} from '../types/index.js';

const WORKSPACE_DIR = '.webforge';
const WORKSPACE_VERSION = '0.2';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertArrayShape(value: unknown, label: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
}

function normalizeWorkspaceIndex<T>(
  value: unknown,
  label: string,
  wrapperKey?: string
): T[] {
  if (wrapperKey && isRecord(value) && Array.isArray(value[wrapperKey])) {
    return value[wrapperKey] as T[];
  }
  assertArrayShape(value, label);
  return value as T[];
}

function buildWorkspacePaths(basePath: string): WorkspacePaths {
  const root = resolve(basePath);
  const workspace = join(root, WORKSPACE_DIR);

  return {
    root,
    workspace,
    config: join(workspace, 'config.yaml'),
    tasks: join(workspace, 'tasks.json'),
    phases: join(workspace, 'phases.json'),
    runtime: join(workspace, 'runtime.json'),
    superpowers: join(workspace, 'superpowers.json'),
    superpowersRuns: join(workspace, 'superpowers-runs.json'),
    knowledge: join(workspace, 'knowledge'),
    knowledgeIndex: join(workspace, 'knowledge/index.json'),
    knowledgeRequirements: join(workspace, 'knowledge/requirements'),
    knowledgeDesign: join(workspace, 'knowledge/design'),
    knowledgeDecisions: join(workspace, 'knowledge/decisions'),
    knowledgeParsed: join(workspace, 'knowledge/parsed'),
    deliverables: join(workspace, 'deliverables'),
    deliverablesIndex: join(workspace, 'deliverables/index.json'),
    sessions: join(workspace, 'sessions'),
    sessionsIndex: join(workspace, 'sessions/index.json'),
    threadsIndex: join(workspace, 'threads.json'),
    mailboxes: join(workspace, 'mailboxes'),
    logs: join(workspace, 'logs')
  };
}

function createWorkspaceRuntime(
  updatedAt: string,
  summary: string = 'workspace initialized'
): WorkspaceRuntime {
  return {
    version: WORKSPACE_VERSION,
    status: 'idle',
    updatedAt,
    sessionId: null,
    phaseId: null,
    taskId: null,
    summary,
    workflowContext: null
  };
}

async function ensureWorkspaceDirectories(paths: WorkspacePaths): Promise<void> {
  const directories = [
    paths.workspace,
    paths.knowledge,
    paths.knowledgeRequirements,
    paths.knowledgeDesign,
    paths.knowledgeDecisions,
    paths.knowledgeParsed,
    paths.deliverables,
    paths.sessions,
    paths.mailboxes,
    paths.logs
  ];

  for (const directory of directories) {
    await ensureDir(directory);
  }
}

async function readJsonOrDefault<T>(path: string, fallback: T): Promise<T> {
  if (!existsSync(path)) {
    return fallback;
  }

  return readJson<T>(path);
}

function normalizeRuntime(runtime: unknown): WorkspaceRuntime {
  if (!isRecord(runtime)) {
    throw new Error('Workspace runtime must be an object');
  }

  const version = runtime.version;
  if (version !== WORKSPACE_VERSION) {
    throw new Error(`Unsupported workspace version: ${String(version)}`);
  }

  const summary = runtime.summary;
  const status = runtime.status ?? 'idle';
  const allowedStatus: WorkspaceRuntimeStatus[] = [
    'idle',
    'active',
    'blocked',
    'error'
  ];

  if (!allowedStatus.includes(status as WorkspaceRuntimeStatus)) {
    throw new Error(`Unsupported workspace runtime status: ${status}`);
  }

  if (typeof runtime.updatedAt !== 'string' || runtime.updatedAt.length === 0) {
    throw new Error('Workspace runtime.updatedAt must be a non-empty string');
  }

  if (
    runtime.sessionId !== null &&
    typeof runtime.sessionId !== 'string'
  ) {
    throw new Error('Workspace runtime.sessionId must be a string or null');
  }

  if (runtime.phaseId !== null && typeof runtime.phaseId !== 'string') {
    throw new Error('Workspace runtime.phaseId must be a string or null');
  }

  if (runtime.taskId !== null && typeof runtime.taskId !== 'string') {
    throw new Error('Workspace runtime.taskId must be a string or null');
  }

  if (summary !== undefined && typeof summary !== 'string') {
    throw new Error('Workspace runtime.summary must be a string');
  }

  return {
    version: WORKSPACE_VERSION,
    status: status as WorkspaceRuntimeStatus,
    updatedAt: runtime.updatedAt,
    sessionId: runtime.sessionId ?? null,
    phaseId: runtime.phaseId ?? null,
    taskId: runtime.taskId ?? null,
    summary: summary ?? 'workspace ready',
    workflowContext: normalizeWorkflowContext(runtime.workflowContext)
  };
}

async function readWorkspaceIndexes(paths: WorkspacePaths): Promise<WorkspaceIndexes> {
  return {
    knowledge: normalizeWorkspaceIndex(
      await readJsonOrDefault(paths.knowledgeIndex, [] as WorkspaceIndexes['knowledge']),
      'knowledge/index.json'
    ),
    deliverables: normalizeWorkspaceIndex(
      await readJsonOrDefault(
        paths.deliverablesIndex,
        [] as WorkspaceIndexes['deliverables']
      ),
      'deliverables/index.json',
      'items'
    ),
    sessions: normalizeWorkspaceIndex(
      await readJsonOrDefault(
        paths.sessionsIndex,
        [] as WorkspaceIndexes['sessions']
      ),
      'sessions/index.json',
      'sessions'
    ),
    threads: normalizeWorkspaceIndex(
      await readJsonOrDefault(
        paths.threadsIndex,
        [] as WorkspaceIndexes['threads']
      ),
      'threads.json',
      'threads'
    ),
    superpowersRuns: normalizeWorkspaceIndex(
      await readJsonOrDefault(
        paths.superpowersRuns,
        [] as WorkspaceIndexes['superpowersRuns']
      ),
      'superpowers-runs.json',
      'runs'
    )
  };
}

async function readWorkspaceGraph(paths: WorkspacePaths): Promise<{
  tasks: { tasks: Task[] };
  phases: { phases: Phase[] };
}> {
  const tasks = await readJsonOrDefault<unknown>(paths.tasks, {
    tasks: []
  });
  if (!isRecord(tasks) || !Array.isArray(tasks.tasks)) {
    throw new Error('tasks.json must contain a tasks array');
  }

  const phases = await readJsonOrDefault<unknown>(paths.phases, {
    phases: []
  });
  if (!isRecord(phases) || !Array.isArray(phases.phases)) {
    throw new Error('phases.json must contain a phases array');
  }

  return {
    tasks: { tasks: tasks.tasks as Task[] },
    phases: { phases: phases.phases as Phase[] }
  };
}

async function writeWorkspaceSkeleton(
  paths: WorkspacePaths,
  options: WorkspaceInitOptions
): Promise<void> {
  const config = createDefaultConfig(options.projectName);
  const runtime = createWorkspaceRuntime(new Date().toISOString());

  await saveConfig(config, paths.root);
  await writeJson(paths.tasks, { tasks: [] });
  await writeJson(paths.phases, { phases: config.phases });
  await writeJson(paths.runtime, runtime);
  await writeJson(paths.superpowers, buildSuperpowersRegistry());
  await writeJson(paths.superpowersRuns, { runs: [] });
  await writeJson(paths.knowledgeIndex, []);
  await writeJson(paths.deliverablesIndex, []);
  await writeJson(paths.sessionsIndex, []);
  await writeJson(paths.threadsIndex, { threads: [] });
}

/**
 * 初始化 v0.2 workspace
 */
export async function createWorkspace(
  basePath: string,
  options: WorkspaceInitOptions
): Promise<WorkspaceState> {
  const paths = buildWorkspacePaths(basePath);

  if (existsSync(paths.workspace)) {
    throw new Error(`Workspace already exists: ${paths.workspace}`);
  }

  await ensureWorkspaceDirectories(paths);
  await writeWorkspaceSkeleton(paths, options);

  return loadWorkspaceState(basePath);
}

/**
 * 读取 workspace 状态
 */
export async function loadWorkspaceState(
  basePath: string
): Promise<WorkspaceState> {
  const paths = buildWorkspacePaths(basePath);

  if (!existsSync(paths.runtime)) {
    throw new Error(`Workspace runtime file not found: ${paths.runtime}`);
  }

  const runtime = normalizeRuntime(await readJson<unknown>(paths.runtime));
  const graph = await readWorkspaceGraph(paths);
  const indexes = await readWorkspaceIndexes(paths);

  return {
    basePath: paths.root,
    paths,
    runtime,
    tasks: graph.tasks,
    phases: graph.phases,
    indexes
  };
}
