import { existsSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import type {
  Task,
  WorkspaceRuntime,
  WorkspaceSessionIndexEntry,
  WorkspaceSuperpowersRun,
  WorkspaceWorkflowContext
} from '../types/index.js';

export function toWorkflowContext(
  run: WorkspaceSuperpowersRun
): WorkspaceWorkflowContext {
  return {
    workflow: run.workflow,
    runId: run.id,
    recordedAt: run.recordedAt,
    summary: run.summary,
    owner: run.metadata?.owner,
    waveId: run.metadata?.waveId,
    threadId: run.metadata?.threadId,
    branch: run.metadata?.branch,
    worktreePath: run.metadata?.worktreePath,
    compactFromSession: run.metadata?.compactFromSession,
    artifacts: run.artifacts.map((artifact) => artifact.path)
  };
}

export function getTaskWorkflowContext(task: Task): WorkspaceWorkflowContext | null {
  return (
    normalizeWorkflowContext(task.workflowContext) ??
    normalizeWorkflowContext(task.metadata?.workflow_context) ??
    normalizeWorkflowContext(task.metadata?.superpowers_run) ??
    null
  );
}

export function getRuntimeWorkflowContext(
  runtime: WorkspaceRuntime
): WorkspaceWorkflowContext | null {
  return normalizeWorkflowContext(runtime.workflowContext) ?? null;
}

export function getSessionWorkflowContext(
  session: WorkspaceSessionIndexEntry | { workflowContext?: unknown } | null | undefined
): WorkspaceWorkflowContext | null {
  return normalizeWorkflowContext(session?.workflowContext) ?? null;
}

export function pickWorkflowContext(
  ...contexts: Array<WorkspaceWorkflowContext | null | undefined>
): WorkspaceWorkflowContext | null {
  for (const context of contexts) {
    const normalized = normalizeWorkflowContext(context);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export interface WorkflowContextReadiness {
  missingArtifacts: string[];
  missingWorktreePath: string | null;
  missingCompactSessionId: string | null;
}

export function inspectWorkflowContext(
  basePath: string,
  context: WorkspaceWorkflowContext
): WorkflowContextReadiness {
  const missingArtifacts = (context.artifacts ?? []).filter(
    (artifact) => !existsSync(resolveWorkflowPath(basePath, artifact))
  );
  const missingWorktreePath =
    context.worktreePath && !existsSync(resolveWorkflowPath(basePath, context.worktreePath))
      ? context.worktreePath
      : null;
  const missingCompactSessionId =
    context.compactFromSession &&
    !existsSync(resolveWorkflowPath(basePath, `.webforge/sessions/${context.compactFromSession}.json`))
      ? context.compactFromSession
      : null;

  return {
    missingArtifacts,
    missingWorktreePath,
    missingCompactSessionId
  };
}

export function normalizeWorkflowContext(
  raw: unknown
): WorkspaceWorkflowContext | null {
  if (!isRecord(raw) || typeof raw.workflow !== 'string' || raw.workflow.length === 0) {
    return null;
  }

  const context: WorkspaceWorkflowContext = {
    workflow: raw.workflow
  };

  if (typeof raw.runId === 'string' && raw.runId.length > 0) {
    context.runId = raw.runId;
  }
  if (typeof raw.recordedAt === 'string' && raw.recordedAt.length > 0) {
    context.recordedAt = raw.recordedAt;
  }
  if (typeof raw.summary === 'string' && raw.summary.length > 0) {
    context.summary = raw.summary;
  }
  if (typeof raw.owner === 'string' && raw.owner.length > 0) {
    context.owner = raw.owner;
  }
  if (typeof raw.waveId === 'string' && raw.waveId.length > 0) {
    context.waveId = raw.waveId;
  }
  if (typeof raw.threadId === 'string' && raw.threadId.length > 0) {
    context.threadId = raw.threadId;
  }
  if (typeof raw.branch === 'string' && raw.branch.length > 0) {
    context.branch = raw.branch;
  }
  if (typeof raw.worktreePath === 'string' && raw.worktreePath.length > 0) {
    context.worktreePath = raw.worktreePath;
  }
  if (typeof raw.compactFromSession === 'string' && raw.compactFromSession.length > 0) {
    context.compactFromSession = raw.compactFromSession;
  }
  if (Array.isArray(raw.artifacts)) {
    const artifacts = raw.artifacts.filter(
      (item): item is string => typeof item === 'string' && item.length > 0
    );
    if (artifacts.length > 0) {
      context.artifacts = artifacts;
    }
  }

  return context;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveWorkflowPath(basePath: string, targetPath: string): string {
  return isAbsolute(targetPath) ? targetPath : resolve(basePath, targetPath);
}
