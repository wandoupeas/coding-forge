import { existsSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';
import { readJson, writeJson } from '../utils/file.js';
import type { WorkspaceThreadLink } from '../types/index.js';

const THREADS_FILE = '.webforge/threads.json';

interface ThreadsFile {
  threads: WorkspaceThreadLink[];
}

export interface UpsertThreadLinkInput {
  id: string;
  recordedAt: string;
  workflow: string;
  summary: string;
  runId?: string;
  taskId?: string;
  sessionId?: string;
  owner?: string;
  branch?: string;
  worktreePath?: string;
  artifacts: string[];
}

export interface ThreadLinkReadiness {
  missingArtifacts: string[];
  missingWorktreePath: string | null;
}

export async function loadThreadLinks(
  basePath: string
): Promise<WorkspaceThreadLink[]> {
  const path = join(basePath, THREADS_FILE);
  if (!existsSync(path)) {
    return [];
  }

  const raw = await readJson<unknown>(path);
  return normalizeThreadLinks(raw);
}

export async function getThreadLink(
  basePath: string,
  threadId: string
): Promise<WorkspaceThreadLink | null> {
  const links = await loadThreadLinks(basePath);
  return links.find((link) => link.id === threadId) ?? null;
}

export async function upsertThreadLink(
  basePath: string,
  input: UpsertThreadLinkInput
): Promise<WorkspaceThreadLink> {
  const links = await loadThreadLinks(basePath);
  const next: WorkspaceThreadLink = {
    id: input.id,
    recordedAt: input.recordedAt,
    workflow: input.workflow,
    summary: input.summary,
    runId: input.runId,
    taskId: input.taskId,
    sessionId: input.sessionId,
    owner: input.owner,
    branch: input.branch,
    worktreePath: input.worktreePath,
    artifacts: input.artifacts
  };

  const updated = [next, ...links.filter((link) => link.id !== input.id)].sort((left, right) =>
    right.recordedAt.localeCompare(left.recordedAt)
  );

  await writeJson(join(basePath, THREADS_FILE), {
    threads: updated
  } satisfies ThreadsFile);

  return next;
}

export function inspectThreadLink(
  basePath: string,
  link: WorkspaceThreadLink
): ThreadLinkReadiness {
  const missingArtifacts = link.artifacts.filter(
    (artifact) => !existsSync(resolveThreadPath(basePath, artifact))
  );
  const missingWorktreePath =
    link.worktreePath && !existsSync(resolveThreadPath(basePath, link.worktreePath))
      ? link.worktreePath
      : null;

  return {
    missingArtifacts,
    missingWorktreePath
  };
}

function normalizeThreadLinks(raw: unknown): WorkspaceThreadLink[] {
  if (Array.isArray(raw)) {
    return raw
      .map(normalizeThreadLink)
      .filter((link): link is WorkspaceThreadLink => link !== null)
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  }

  if (isRecord(raw) && Array.isArray(raw.threads)) {
    return raw.threads
      .map(normalizeThreadLink)
      .filter((link): link is WorkspaceThreadLink => link !== null)
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  }

  return [];
}

function normalizeThreadLink(raw: unknown): WorkspaceThreadLink | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.length === 0) {
    return null;
  }

  const artifacts = Array.isArray(raw.artifacts)
    ? raw.artifacts.filter((artifact): artifact is string => typeof artifact === 'string' && artifact.length > 0)
    : [];

  return {
    id: raw.id,
    recordedAt:
      typeof raw.recordedAt === 'string' && raw.recordedAt.length > 0
        ? raw.recordedAt
        : new Date().toISOString(),
    workflow: typeof raw.workflow === 'string' ? raw.workflow : 'unknown',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    runId: typeof raw.runId === 'string' ? raw.runId : undefined,
    taskId: typeof raw.taskId === 'string' ? raw.taskId : undefined,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
    owner: typeof raw.owner === 'string' ? raw.owner : undefined,
    branch: typeof raw.branch === 'string' ? raw.branch : undefined,
    worktreePath: typeof raw.worktreePath === 'string' ? raw.worktreePath : undefined,
    artifacts
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveThreadPath(basePath: string, targetPath: string): string {
  return isAbsolute(targetPath) ? targetPath : resolve(basePath, targetPath);
}
