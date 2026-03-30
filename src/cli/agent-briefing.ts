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

function deriveReadOrder(
  knownSessionIds: string[],
  hasSession: boolean,
  hasPendingReview: boolean,
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
