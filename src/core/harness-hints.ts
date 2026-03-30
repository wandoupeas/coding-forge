import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { Mailbox } from './mailbox.js';
import { loadSuperpowersRegistry } from './superpowers-registry.js';
import { loadConfig } from '../utils/config.js';
import type {
  AgentPermissionProfile,
  Task,
  WorkspaceSuperpowersCapability,
  WorkspaceState
} from '../types/index.js';

export interface SuperpowersHints {
  enabled: boolean;
  requiredSkills: string[];
  taskSkills: string[];
  executionMode: 'subagent' | 'inline' | null;
  suggestedWorkflow: string | null;
  capabilities: WorkspaceSuperpowersCapability[];
}

export interface PermissionHints {
  profile: AgentPermissionProfile;
  canWriteWorkspace: boolean;
  requiresApproval: boolean;
  allowedActions: string[];
  blockedActions: string[];
}

export interface ObservationSnapshot {
  counts: {
    readyTasks: number;
    blockedTasks: number;
    pendingReview: number;
    unreadMessages: number;
    knowledgeItems: number;
    taskDeliverables: number;
    relatedSessions: number;
  };
  readyTaskIds: string[];
  blockedTaskIds: string[];
  pendingReviewIds: string[];
  workersWithUnread: string[];
  mailbox: {
    workerId: string | null;
    unreadForWorker: number;
  };
}

export async function loadSuperpowersHints(
  basePath: string,
  task: Task
): Promise<SuperpowersHints> {
  const registry = await loadSuperpowersRegistry(basePath);
  const requiredSkills = registry.required;
  const taskSkills = normalizeStringList(task.metadata?.skills);
  const executionMode =
    normalizeExecutionMode(task.metadata?.execution) ??
    registry.execution ??
    null;
  const enabled =
    task.metadata?.superpowers === true ||
    taskSkills.length > 0 ||
    requiredSkills.length > 0 ||
    executionMode !== null;

  return {
    enabled,
    requiredSkills,
    taskSkills,
    executionMode,
    suggestedWorkflow: deriveSuggestedWorkflow(task, enabled, executionMode),
    capabilities: registry.capabilities
  };
}

export async function loadPermissionHints(basePath: string): Promise<PermissionHints> {
  let profile: AgentPermissionProfile = 'workspace-write';

  try {
    const config = await loadConfig(basePath);
    profile = config.agent?.permission_profile ?? profile;
  } catch {
    // config 不存在时回退到默认 profile
  }

  switch (profile) {
    case 'read-only':
      return {
        profile,
        canWriteWorkspace: false,
        requiresApproval: true,
        allowedActions: ['read:workspace', 'inspect:state', 'review:deliverables'],
        blockedActions: ['write:workspace', 'mutate:state', 'external:side-effects']
      };
    case 'approval-required':
      return {
        profile,
        canWriteWorkspace: false,
        requiresApproval: true,
        allowedActions: ['read:workspace', 'plan:changes', 'propose:edits'],
        blockedActions: ['apply:workspace-writes', 'destructive:actions', 'external:side-effects']
      };
    default:
      return {
        profile: 'workspace-write',
        canWriteWorkspace: true,
        requiresApproval: false,
        allowedActions: ['read:workspace', 'write:workspace', 'mutate:state'],
        blockedActions: ['external:side-effects']
      };
  }
}

export async function buildObservationSnapshot(
  basePath: string,
  workspace: WorkspaceState,
  options: { taskId: string; relatedSessionCount: number; workerId?: string } = {
    taskId: '',
    relatedSessionCount: 0
  }
): Promise<ObservationSnapshot> {
  const readyTasks = workspace.tasks.tasks
    .filter((item) => item.status === 'ready')
    .sort(sortTasksByPriority);
  const blockedTasks = workspace.tasks.tasks
    .filter((item) => item.status === 'blocked')
    .sort(sortTasksByPriority);
  const pendingReview = workspace.indexes.deliverables
    .filter((item) => item.status === 'pending_review')
    .sort((left, right) => left.taskId.localeCompare(right.taskId));

  const unreadByWorker = await collectUnreadMailboxCounts(basePath);
  const workersWithUnread = Object.entries(unreadByWorker)
    .filter(([, count]) => count > 0)
    .map(([workerId]) => workerId)
    .sort();
  const unreadMessages = Object.values(unreadByWorker).reduce((sum, count) => sum + count, 0);

  return {
    counts: {
      readyTasks: readyTasks.length,
      blockedTasks: blockedTasks.length,
      pendingReview: pendingReview.length,
      unreadMessages,
      knowledgeItems: workspace.indexes.knowledge.length,
      taskDeliverables: workspace.indexes.deliverables.filter(
        (item) => item.taskId === options.taskId
      ).length,
      relatedSessions: options.relatedSessionCount
    },
    readyTaskIds: readyTasks.map((item) => item.id),
    blockedTaskIds: blockedTasks.map((item) => item.id),
    pendingReviewIds: pendingReview.map((item) => item.id),
    workersWithUnread,
    mailbox: {
      workerId: options.workerId ?? null,
      unreadForWorker:
        options.workerId !== undefined ? (unreadByWorker[options.workerId] ?? 0) : 0
    }
  };
}

function deriveSuggestedWorkflow(
  task: Task,
  enabled: boolean,
  executionMode: 'subagent' | 'inline' | null
): string | null {
  if (!enabled) {
    return null;
  }

  const normalized = `${task.title} ${task.description ?? ''}`.toLowerCase();
  if (
    /(需求|分析|架构|设计|方案|research|discovery|spec|prd|architecture|design)/.test(
      normalized
    )
  ) {
    return 'brainstorming';
  }

  if (executionMode === 'subagent') {
    return 'subagent-driven-development';
  }

  return 'writing-plans';
}

async function collectUnreadMailboxCounts(basePath: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const workerIds = await discoverMailboxWorkers(basePath);

  for (const workerId of workerIds) {
    const mailbox = new Mailbox(workerId, basePath);
    await mailbox.init();
    counts[workerId] = await mailbox.getUnreadCount();
  }

  return counts;
}

async function discoverMailboxWorkers(basePath: string): Promise<string[]> {
  const workers = new Set<string>();

  try {
    const config = await loadConfig(basePath);
    for (const workerId of config.workers) {
      workers.add(workerId);
    }
  } catch {
    // config 对 observation 不是强依赖
  }

  const mailboxRoot = join(basePath, '.webforge', 'mailboxes');
  if (existsSync(mailboxRoot)) {
    const entries = await readdir(mailboxRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        workers.add(entry.name.slice(0, -'.jsonl'.length));
      }
    }
  }

  return Array.from(workers).sort();
}

function normalizeExecutionMode(value: unknown): 'subagent' | 'inline' | null {
  return value === 'subagent' || value === 'inline' ? value : null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))
  );
}

function sortTasksByPriority(left: Task, right: Task): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  return left.id.localeCompare(right.id);
}
