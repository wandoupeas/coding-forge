import { getLatestSession, loadSession } from '../core/session.js';
import { getLatestSuperpowersRun } from '../core/superpowers-runs.js';
import {
  getRuntimeWorkflowContext,
  getSessionWorkflowContext,
  getTaskWorkflowContext,
  pickWorkflowContext
} from '../core/workflow-context.js';
import {
  buildObservationSnapshot,
  loadPermissionHints,
  loadSuperpowersHints,
  type ObservationSnapshot,
  type PermissionHints,
  type SuperpowersHints
} from '../core/harness-hints.js';
import { loadWorkspaceState } from '../core/workspace.js';
import type {
  Task,
  WorkspaceDeliverableIndexEntry,
  WorkspaceKnowledgeIndexEntry,
  WorkspaceRuntime,
  WorkspaceSuperpowersRun,
  WorkspaceWorkflowContext,
  WorkspaceState
} from '../types/index.js';

export interface AgentBriefing {
  sessionId: string | null;
  sessionName: string | null;
  lastActive: string | null;
  runtimeStatus: string;
  runtimeSummary: string;
  currentTaskId: string | null;
  currentPhaseId: string | null;
  guidance: string | null;
  nextAction: string;
  shouldRead: string[];
  readyTasks: Task[];
  blockedTasks: Task[];
  pendingReview: WorkspaceDeliverableIndexEntry[];
  superpowers: SuperpowersHints;
  permissions: PermissionHints;
  observation: ObservationSnapshot;
  latestSuperpowersRun: WorkspaceSuperpowersRun | null;
  workflowContext: WorkspaceWorkflowContext | null;
}

export async function buildAgentBriefing(
  basePath: string = process.cwd(),
  workspace?: WorkspaceState
): Promise<AgentBriefing> {
  const currentWorkspace = workspace ?? (await loadWorkspaceState(basePath));
  const latestSession = await getLatestSession(basePath);
  const snapshot =
    latestSession === null
      ? null
      : await loadSession(latestSession.id, basePath);
  const readyTasks = sortTasksByPriority(
    currentWorkspace.tasks.tasks.filter((task) => task.status === 'ready')
  );
  const blockedTasks = sortTasksByPriority(
    currentWorkspace.tasks.tasks.filter((task) => task.status === 'blocked')
  );
  const pendingReview = [...currentWorkspace.indexes.deliverables]
    .filter((item) => item.status === 'pending_review')
    .sort((left, right) => left.taskId.localeCompare(right.taskId));
  const guidance = snapshot?.resumeGuidance ?? latestSession?.nextAction ?? null;
  const nextTask = readyTasks[0] ?? currentWorkspace.tasks.tasks.find((task) => task.id === currentWorkspace.runtime.taskId);
  const workflowContext = pickWorkflowContext(
    nextTask ? getTaskWorkflowContext(nextTask) : null,
    snapshot ? getSessionWorkflowContext(snapshot.session) : null,
    latestSession ? getSessionWorkflowContext(latestSession) : null,
    getRuntimeWorkflowContext(currentWorkspace.runtime)
  );
  const threadLink =
    workflowContext?.threadId
      ? currentWorkspace.indexes.threads.find((link) => link.id === workflowContext.threadId) ?? null
      : null;
  
  // 查找与当前任务相关的知识文档
  // 优先使用 task.knowledgeRefs，如果没有则通过标签匹配
  const taskRelatedKnowledge = nextTask
    ? findTaskRelatedKnowledge(nextTask, currentWorkspace.indexes.knowledge)
    : [];
  
  const [permissions, superpowers, observation, latestSuperpowersRun] = await Promise.all([
    loadPermissionHints(basePath),
    nextTask
      ? loadSuperpowersHints(basePath, nextTask)
      : Promise.resolve({
          enabled: false,
          requiredSkills: [],
          taskSkills: [],
          executionMode: null,
          suggestedWorkflow: null,
          capabilities: []
        } satisfies SuperpowersHints),
    buildObservationSnapshot(basePath, currentWorkspace, {
      taskId: nextTask?.id ?? currentWorkspace.runtime.taskId ?? '',
      relatedSessionCount: latestSession ? 1 : 0
    }),
    getLatestSuperpowersRun(basePath)
  ]);

  return {
    sessionId: latestSession?.id ?? null,
    sessionName: latestSession?.name ?? null,
    lastActive: latestSession?.lastActive ?? null,
    runtimeStatus: currentWorkspace.runtime.status,
    runtimeSummary: currentWorkspace.runtime.summary,
    currentTaskId: currentWorkspace.runtime.taskId,
    currentPhaseId: currentWorkspace.runtime.phaseId,
    guidance,
    nextAction: deriveNextAction(
      currentWorkspace.runtime,
      readyTasks,
      blockedTasks,
      pendingReview,
      guidance
    ),
    shouldRead: deriveReadOrder(
      currentWorkspace.indexes.sessions.map((session) => session.id),
      latestSession !== null,
      pendingReview.length > 0,
      taskRelatedKnowledge,
      latestSuperpowersRun,
      workflowContext,
      threadLink
    ),
    readyTasks,
    blockedTasks,
    pendingReview,
    superpowers,
    permissions,
    observation,
    latestSuperpowersRun,
    workflowContext
  };
}

function deriveNextAction(
  runtime: WorkspaceRuntime,
  readyTasks: Task[],
  blockedTasks: Task[],
  pendingReview: WorkspaceDeliverableIndexEntry[],
  guidance: string | null
): string {
  if (guidance) {
    return guidance;
  }

  if (runtime.status === 'active' && runtime.taskId) {
    return `检查运行时记录并继续处理 ${runtime.taskId}`;
  }

  const nextTask = readyTasks[0];
  if (nextTask) {
    return `运行 ${nextTask.id}: ${nextTask.title}`;
  }

  const reviewTarget = pendingReview[0];
  if (reviewTarget) {
    return `当前没有 ready task，先处理待审核交付物 ${reviewTarget.id}（${reviewTarget.taskId}）。`;
  }

  const blockedTask = blockedTasks[0];
  if (blockedTask) {
    return `当前没有 ready task，先排查阻塞任务 ${blockedTask.id}: ${blockedTask.title}`;
  }

  return '当前没有 ready task，先检查阻塞项或重新规划任务图。';
}

/**
 * 根据任务查找相关的知识文档
 * 
 * 优先级：
 * 1. 如果 task.knowledgeRefs 存在，直接使用（显式关联）
 * 2. 否则通过标签/路径/标题匹配（隐式关联）
 */
function findTaskRelatedKnowledge(
  task: Task,
  knowledgeEntries: WorkspaceKnowledgeIndexEntry[]
): WorkspaceKnowledgeIndexEntry[] {
  // 1. 优先使用显式关联的 knowledgeRefs
  if (task.knowledgeRefs && task.knowledgeRefs.length > 0) {
    const refsSet = new Set(task.knowledgeRefs);
    return knowledgeEntries.filter((entry) => refsSet.has(entry.path));
  }
  
  // 2. 回退到隐式匹配（通过标签、路径、标题）
  const taskIdLower = task.id.toLowerCase();
  const phaseLower = task.phase.toLowerCase();
  const titleWords = task.title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2); // 只保留2个字符以上的词
  
  return knowledgeEntries.filter((entry) => {
    // 检查 tags 是否包含任务ID或阶段
    if (entry.tags) {
      const entryTags = entry.tags.map((t) => t.toLowerCase());
      if (entryTags.includes(taskIdLower)) return true;
      if (entryTags.includes(phaseLower)) return true;
    }
    
    // 检查文档路径是否包含任务相关关键词
    const entryPath = entry.path.toLowerCase();
    if (entryPath.includes(taskIdLower)) return true;
    if (entryPath.includes(phaseLower)) return true;
    
    // 检查文档标题是否包含任务关键词
    const entryTitle = entry.title.toLowerCase();
    const matchingWords = titleWords.filter((word) => 
      entryTitle.includes(word) || entryPath.includes(word)
    );
    if (matchingWords.length >= 1) return true;
    
    return false;
  });
}

function deriveReadOrder(
  knownSessionIds: string[],
  hasSession: boolean,
  hasPendingReview: boolean,
  taskRelatedKnowledge: WorkspaceKnowledgeIndexEntry[],
  latestSuperpowersRun: WorkspaceSuperpowersRun | null,
  workflowContext: WorkspaceWorkflowContext | null,
  threadLink: { artifacts: string[] } | null
): string[] {
  const shouldRead = ['AGENTS.md', '.webforge/runtime.json', '.webforge/tasks.json'];

  if (hasSession) {
    shouldRead.push('.webforge/sessions/index.json');
  }

  if (hasPendingReview) {
    shouldRead.push('.webforge/deliverables/index.json');
  }

  shouldRead.push('.webforge/knowledge/index.json');
  
  // 添加与当前任务相关的知识文档（在knowledge/index.json之后）
  for (const entry of taskRelatedKnowledge) {
    if (!shouldRead.includes(entry.path)) {
      shouldRead.push(entry.path);
    }
  }
  
  if (latestSuperpowersRun) {
    for (const artifact of latestSuperpowersRun.artifacts) {
      if (!shouldRead.includes(artifact.path)) {
        shouldRead.push(artifact.path);
      }
    }
  }
  if (workflowContext?.artifacts) {
    for (const artifact of workflowContext.artifacts) {
      if (!shouldRead.includes(artifact)) {
        shouldRead.push(artifact);
      }
    }
  }
  if (
    workflowContext?.compactFromSession &&
    knownSessionIds.includes(workflowContext.compactFromSession)
  ) {
    const compactSessionPath = `.webforge/sessions/${workflowContext.compactFromSession}.json`;
    if (!shouldRead.includes(compactSessionPath)) {
      shouldRead.push(compactSessionPath);
    }
  }
  if (workflowContext?.threadId) {
    if (!shouldRead.includes('.webforge/threads.json')) {
      shouldRead.push('.webforge/threads.json');
    }
    for (const artifact of threadLink?.artifacts ?? []) {
      if (!shouldRead.includes(artifact)) {
        shouldRead.push(artifact);
      }
    }
  }
  return shouldRead;
}

function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.id.localeCompare(right.id);
  });
}
