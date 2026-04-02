/**
 * 会话管理系统
 * 支持跨会话状态恢复
 */

import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { Task, Phase, WorkspaceWorkflowContext } from '../types/index.js';
import { normalizeWorkflowContext } from './workflow-context.js';
import { withFileLock } from '../utils/lock.js';
import { ensureDir } from '../utils/file.js';

const SESSIONS_DIR = '.webforge/sessions';
const SESSION_INDEX = '.webforge/sessions/index.json';
const SESSION_INDEX_LOCK = '.webforge/sessions/index.lock';

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  lastActive: string;
  status: 'active' | 'paused' | 'completed';
  currentPhaseId?: string;
  currentTaskId?: string;
  contextSummary?: string;
  nextAction?: string;
  workflowContext?: WorkspaceWorkflowContext;
  stats: {
    tasksCompleted: number;
    totalTasks: number;
  };
}

interface SessionSnapshot {
  session: Session;
  tasksSnapshot: Task[];
  phasesSnapshot: Phase[];
  resumeGuidance: string;
}

interface SessionIndexFile {
  sessions: SessionIndexEntry[];
}

interface SessionIndexEntry {
  id: string;
  name: string;
  createdAt: string;
  created_at: string;
  lastActive: string;
  last_active: string;
  status: Session['status'];
  currentPhaseId?: string;
  currentPhase?: string;
  currentTaskId?: string;
  currentTask?: string;
  contextSummary?: string;
  context_summary?: string;
  nextAction?: string;
  next_action?: string;
  active_worker?: string;
  workflowContext?: WorkspaceWorkflowContext;
  stats: {
    tasksCompleted: number;
    totalTasks: number;
  };
}

type LegacySnapshotSession = Partial<Session> & {
  created_at?: string;
  last_active?: string;
  currentPhase?: string;
  currentTask?: string;
  context_summary?: string;
  next_action?: string;
};

/**
 * 保存会话快照
 */
export async function saveSession(
  sessionId: string,
  tasks: Task[],
  phases: Phase[],
  options?: {
    name?: string;
    currentPhaseId?: string;
    currentTaskId?: string;
    context?: string;
    nextAction?: string;
    workflowContext?: WorkspaceWorkflowContext;
    basePath?: string;
  }
): Promise<void> {
  const basePath = options?.basePath;

  await withSessionLock(sessionId, async () => {
    await ensureDir(resolveSessionPath(basePath, SESSIONS_DIR));

    const existing = await readSessionSnapshot(sessionId, basePath);
    const now = new Date().toISOString();
    const session: Session = {
      id: sessionId,
      name: options?.name || existing?.session.name || `Session ${sessionId.slice(-4)}`,
      createdAt: existing?.session.createdAt || now,
      lastActive: now,
      status: existing?.session.status || 'active',
      currentPhaseId: options?.currentPhaseId ?? existing?.session.currentPhaseId,
      currentTaskId: options?.currentTaskId ?? existing?.session.currentTaskId,
      contextSummary: options?.context ?? existing?.session.contextSummary,
      nextAction: options?.nextAction ?? existing?.session.nextAction,
      workflowContext: options?.workflowContext ?? existing?.session.workflowContext,
      stats: {
        tasksCompleted: tasks.filter(t => t.status === 'completed').length,
        totalTasks: tasks.length
      }
    };

    const snapshot = buildSessionSnapshot(session, tasks, phases);
    await persistSessionSnapshot(snapshot, basePath);
  }, basePath);
}

/**
 * 加载会话
 */
export async function loadSession(
  sessionId: string,
  basePath?: string
): Promise<SessionSnapshot | null> {
  return withSessionLock(sessionId, async () => {
    const snapshot = await readSessionSnapshot(sessionId, basePath);

    if (!snapshot) {
      return null;
    }

    snapshot.session.lastActive = new Date().toISOString();
    snapshot.resumeGuidance = buildResumeGuidance(snapshot.session);
    await persistSessionSnapshot(snapshot, basePath);

    return snapshot;
  }, basePath);
}

/**
 * 列出所有会话
 */
export async function listSessions(
  basePath?: string
): Promise<Session[]> {
  return withFileLock(resolveSessionPath(basePath, SESSION_INDEX_LOCK), async () => {
    const sessions = await loadSessionIndexUnlocked(basePath);
    return sessions
      .map(normalizeSessionIndexEntry)
      .sort((a, b) =>
        new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
      );
  });
}

/**
 * 获取最新的活动会话
 */
export async function getLatestSession(
  basePath?: string
): Promise<Session | null> {
  const sessions = await listSessions(basePath);
  return sessions[0] || null;
}

/**
 * 暂停会话
 */
export async function pauseSession(
  sessionId: string,
  basePath?: string
): Promise<void> {
  await updateSessionStatus(sessionId, 'paused', basePath);
}

/**
 * 完成会话
 */
export async function completeSession(
  sessionId: string,
  basePath?: string
): Promise<void> {
  await updateSessionStatus(sessionId, 'completed', basePath);
}

export async function applySessionWorkflowContext(
  sessionId: string,
  workflowContext: WorkspaceWorkflowContext,
  basePath?: string
): Promise<void> {
  await withSessionLock(sessionId, async () => {
    const snapshot = await readSessionSnapshot(sessionId, basePath);
    if (!snapshot) {
      return;
    }

    snapshot.session.workflowContext = workflowContext;
    snapshot.resumeGuidance = buildResumeGuidance(snapshot.session);
    await persistSessionSnapshot(snapshot, basePath);
  }, basePath);
}

/**
 * 更新会话索引
 */
async function updateSessionIndex(
  session: Session,
  basePath?: string
): Promise<void> {
  await withFileLock(resolveSessionPath(basePath, SESSION_INDEX_LOCK), async () => {
    const sessions = (await loadSessionIndexUnlocked(basePath)).map(normalizeSessionIndexEntry);
    const index = sessions.findIndex(item => item.id === session.id);

    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }

    const payload: SessionIndexFile = {
      sessions: sessions.map(toSessionIndexEntry)
    };
    await writeFile(resolveSessionPath(basePath, SESSION_INDEX), JSON.stringify(payload, null, 2));
  });
}

async function readSessionSnapshot(
  sessionId: string,
  basePath?: string
): Promise<SessionSnapshot | null> {
  const sessionPath = resolveSessionPath(basePath, join(SESSIONS_DIR, `${sessionId}.json`));

  if (!existsSync(sessionPath)) {
    return null;
  }

  try {
    const content = await readFile(sessionPath, 'utf-8');
    const data = JSON.parse(content) as Partial<SessionSnapshot>;

    if (!data.session || !Array.isArray(data.tasksSnapshot) || !Array.isArray(data.phasesSnapshot)) {
      return null;
    }

    const legacySession = data.session as LegacySnapshotSession;
    const session: Session = {
      id: legacySession.id || sessionId,
      name: legacySession.name || `Session ${sessionId.slice(-4)}`,
      createdAt: legacySession.createdAt || legacySession.created_at || new Date().toISOString(),
      lastActive: legacySession.lastActive || legacySession.last_active || legacySession.createdAt || legacySession.created_at || new Date().toISOString(),
      status: legacySession.status || 'active',
      currentPhaseId: legacySession.currentPhaseId ?? legacySession.currentPhase,
      currentTaskId: legacySession.currentTaskId ?? legacySession.currentTask,
      contextSummary: legacySession.contextSummary ?? legacySession.context_summary,
      nextAction: legacySession.nextAction ?? legacySession.next_action,
      workflowContext: normalizeWorkflowContext(legacySession.workflowContext) ?? undefined,
      stats: legacySession.stats ?? {
        tasksCompleted: 0,
        totalTasks: 0
      }
    };

    return {
      session,
      tasksSnapshot: data.tasksSnapshot as Task[],
      phasesSnapshot: data.phasesSnapshot as Phase[],
      resumeGuidance: data.resumeGuidance || buildResumeGuidance(session)
    };
  } catch {
    return null;
  }
}

async function persistSessionSnapshot(
  snapshot: SessionSnapshot,
  basePath?: string
): Promise<void> {
  const sessionPath = resolveSessionPath(
    basePath,
    join(SESSIONS_DIR, `${snapshot.session.id}.json`)
  );
  await writeFile(sessionPath, JSON.stringify(snapshot, null, 2));
  await updateSessionIndex(snapshot.session, basePath);
}

function buildSessionSnapshot(session: Session, tasks: Task[], phases: Phase[]): SessionSnapshot {
  return {
    session,
    tasksSnapshot: tasks,
    phasesSnapshot: phases,
    resumeGuidance: buildResumeGuidance(session)
  };
}

function buildResumeGuidance(session: Session): string {
  const scope: string[] = [];

  if (session.currentPhaseId) {
    scope.push(`phase ${session.currentPhaseId}`);
  }

  if (session.currentTaskId) {
    scope.push(`task ${session.currentTaskId}`);
  }

  const summary = session.contextSummary?.trim();
  const nextAction = session.nextAction?.trim();

  const lead = scope.length > 0 ? `Resume ${scope.join(' / ')}` : `Resume session ${session.name}`;
  const parts = [lead];

  if (summary) {
    parts.push(summary);
  }

  if (nextAction) {
    parts.push(`Next: ${nextAction}`);
  }

  return parts.join('. ');
}

async function updateSessionStatus(
  sessionId: string,
  status: Session['status'],
  basePath?: string
): Promise<void> {
  await withSessionLock(sessionId, async () => {
    const snapshot = await readSessionSnapshot(sessionId, basePath);
    if (!snapshot) {
      return;
    }

    snapshot.session.status = status;
    snapshot.session.lastActive = new Date().toISOString();
    snapshot.resumeGuidance = buildResumeGuidance(snapshot.session);
    await persistSessionSnapshot(snapshot, basePath);
  }, basePath);
}

async function loadSessionIndexUnlocked(
  basePath?: string
): Promise<Array<Session | SessionIndexEntry>> {
  const indexPath = resolveSessionPath(basePath, SESSION_INDEX);

  if (!existsSync(indexPath)) {
    return [];
  }

  try {
    const content = await readFile(indexPath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.sessions)
        ? parsed.sessions
        : [];
  } catch {
    return [];
  }
}

function getSessionLockPath(sessionId: string, basePath?: string): string {
  return resolveSessionPath(basePath, join(SESSIONS_DIR, '.locks', `${sessionId}.lock`));
}

async function withSessionLock<T>(
  sessionId: string,
  fn: () => Promise<T>,
  basePath?: string
): Promise<T> {
  return withFileLock(getSessionLockPath(sessionId, basePath), fn);
}

function resolveSessionPath(basePath: string | undefined, relativePath: string): string {
  return basePath ? join(basePath, relativePath) : relativePath;
}

function normalizeSessionIndexEntry(entry: Session | SessionIndexEntry): Session {
  const legacy = entry as SessionIndexEntry & {
    created_at?: string;
    last_active?: string;
    currentPhase?: string;
    currentTask?: string;
    context_summary?: string;
    next_action?: string;
  };

  return {
    id: legacy.id,
    name: legacy.name,
    createdAt: legacy.createdAt || legacy.created_at,
    lastActive: legacy.lastActive || legacy.last_active,
    status: legacy.status,
    currentPhaseId: legacy.currentPhaseId || legacy.currentPhase,
    currentTaskId: legacy.currentTaskId || legacy.currentTask,
    contextSummary: legacy.contextSummary || legacy.context_summary,
    nextAction: legacy.nextAction || legacy.next_action,
    workflowContext: normalizeWorkflowContext(legacy.workflowContext) ?? undefined,
    stats: legacy.stats ?? { tasksCompleted: 0, totalTasks: 0 }
  };
}

function toSessionIndexEntry(session: Session): SessionIndexEntry {
  return {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    created_at: session.createdAt,
    lastActive: session.lastActive,
    last_active: session.lastActive,
    status: session.status,
    currentPhaseId: session.currentPhaseId,
    currentPhase: session.currentPhaseId,
    currentTaskId: session.currentTaskId,
    currentTask: session.currentTaskId,
    contextSummary: session.contextSummary,
    context_summary: session.contextSummary,
    nextAction: session.nextAction,
    next_action: session.nextAction,
    workflowContext: session.workflowContext,
    stats: session.stats
  };
}
