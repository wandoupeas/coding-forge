import { buildExecutionContext } from './context.js';
import { getTaskWorkflowContext, normalizeWorkflowContext } from './workflow-context.js';
import { LogManager } from './logger.js';
import { Mailbox } from './mailbox.js';
import { TaskManager } from './task.js';
import { inferWorkerForTask, Worker } from './worker.js';
import { loadWorkspaceState } from './workspace.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { readJson, writeJson, writeText } from '../utils/file.js';
import type { AgentExecutionResult } from '../agent/context.js';
import type { Deliverable } from './deliverable.js';
import type { WorkspaceRuntime, WorkspaceWorkflowContext } from '../types/index.js';

export interface RuntimeAgent {
  execute(input: Parameters<Worker['execute']>[0]): Promise<AgentExecutionResult>;
}

export interface RuntimeOptions {
  limit?: number;
  sessionId?: string;
  createAgent?: (worker: Worker) => RuntimeAgent;
}

export interface RuntimeRunResult {
  sessionId: string;
  processed: number;
  completed: number;
  failed: number;
  blocked: number;
  deliverables: number;
}

export async function runReadyTasks(
  basePath: string,
  options: RuntimeOptions = {}
): Promise<RuntimeRunResult> {
  const taskManager = new TaskManager(basePath);
  await taskManager.load();

  const sessionId = options.sessionId ?? `runtime-${Date.now()}`;
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  let processed = 0;
  let completed = 0;
  let failed = 0;
  let blocked = 0;
  let deliverableCount = 0;
  let lastTaskId: string | null = null;
  let lastPhaseId: string | null = null;
  const logManager = new LogManager('runtime', basePath, sessionId);

  await updateRuntime(basePath, {
    status: 'active',
    sessionId,
    phaseId: null,
    taskId: null,
    summary: 'Runtime loop started'
  });

  while (processed < limit) {
    await taskManager.load();
    const nextTask = taskManager.getReadyTasks({ limit: 1 })[0];

    if (!nextTask) {
      break;
    }

    // 检查任务执行模式
    if (nextTask.executionMode === 'manual') {
      // manual 任务需要 Agent 直接执行，runtime 暂停并提示
      await updateRuntime(basePath, {
        status: 'idle',
        sessionId,
        phaseId: nextTask.phase,
        taskId: nextTask.id,
        summary: `任务 ${nextTask.id} 需要 Agent 手动执行 (executionMode=manual)`
      });
      await logManager.addEntry('info', 'manual_task_pause', {
        taskId: nextTask.id,
        metadata: {
          reason: 'executionMode is manual',
          hint: 'Agent should execute this task directly and use webforge record notify'
        }
      });
      // 遇到 manual 任务，停止执行循环
      break;
    }

    const workerId = nextTask.assignee || inferWorkerForTask(nextTask);
    const worker = new Worker(workerId, taskManager, basePath);
    await worker.init();

    const claimedTask = await taskManager.claimTask(nextTask.id, worker.getId());
    if (!claimedTask) {
      continue;
    }

    lastTaskId = claimedTask.id;
    lastPhaseId = claimedTask.phase;
    const workflowContext = getTaskWorkflowContext(claimedTask);

    await updateRuntime(basePath, {
      status: 'active',
      sessionId,
      phaseId: claimedTask.phase,
      taskId: claimedTask.id,
      summary: `Running ${claimedTask.id}`,
      workflowContext
    });
    await persistSession(
      basePath,
      sessionId,
      taskManager,
      claimedTask.id,
      claimedTask.phase,
      workflowContext
    );

    const context = await buildExecutionContext(basePath, claimedTask.id, {
      workerId: worker.getId()
    });
    const agent = options.createAgent?.(worker) ?? worker;

    await logManager.addEntry('info', 'before_execute', {
      taskId: claimedTask.id,
      workerId: worker.getId(),
      metadata: buildRuntimeObservationLogMetadata(context, {
        sessionId,
        stage: 'before_execute'
      })
    });

    if (context.permissions.profile === 'read-only') {
      processed += 1;
      blocked += 1;

      await taskManager.updateTaskStatus(claimedTask.id, 'blocked', {
        agent_summary: `Task ${claimedTask.id} blocked by read-only permission profile`,
        blocked_reason: 'read-only permission profile',
        required_permission: 'workspace-write',
        agent_metadata: mergeAgentMetadata(
          {
            adapterProvider: worker.getAdapterProvider(),
            adapterMode: 'permission-blocked',
            permissionProfile: context.permissions.profile
          },
          context
        )
      });

      await updateRuntime(basePath, {
        status: 'blocked',
        sessionId,
        phaseId: claimedTask.phase,
        taskId: claimedTask.id,
        summary: `Blocked ${claimedTask.id}: read-only permission profile`,
        workflowContext
      });
      await persistSession(
        basePath,
        sessionId,
        taskManager,
        claimedTask.id,
        claimedTask.phase,
        workflowContext
      );
      await logManager.addEntry('warning', 'permission_blocked', {
        taskId: claimedTask.id,
        workerId: worker.getId(),
        metadata: buildRuntimeObservationLogMetadata(context, {
          sessionId,
          stage: 'permission_blocked',
          result: 'blocked',
          reason: 'read-only permission profile'
        })
      });
      continue;
    }

    let result: AgentExecutionResult;
    try {
      result = await agent.execute({ task: claimedTask, context });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        success: false,
        summary: `Task ${claimedTask.id} failed`,
        needsReview: false,
        error: message
      };
    }

    processed += 1;

    if (result.success) {
      const requiresReview = result.needsReview || context.permissions.requiresApproval;
      const persistedDeliverables = await persistDeliverables(
        basePath,
        claimedTask.id,
        worker.getId(),
        result.deliverables ?? []
      );
      deliverableCount += persistedDeliverables.length;
      await sendApprovalRequests(
        basePath,
        worker.getId(),
        persistedDeliverables,
        requiresReview
      );

      await taskManager.updateTaskStatus(claimedTask.id, 'completed', {
        agent_summary: result.summary,
        completed_by: worker.getId(),
        deliverables: persistedDeliverables.map((deliverable) => deliverable.id),
        agent_metadata: mergeAgentMetadata(result.metadata, context)
      });
      completed += 1;
      await logManager.addEntry('success', 'after_execute', {
        taskId: claimedTask.id,
        workerId: worker.getId(),
        metadata: buildRuntimeObservationLogMetadata(context, {
          sessionId,
          stage: 'after_execute',
          result: 'completed',
          deliverables: persistedDeliverables.map((deliverable) => deliverable.id),
          needsReview: requiresReview
        })
      });
    } else {
      await taskManager.updateTaskStatus(claimedTask.id, 'failed', {
        agent_summary: result.summary,
        error: result.error ?? 'Agent execution failed',
        agent_metadata: mergeAgentMetadata(result.metadata, context)
      });
      failed += 1;
      await logManager.addEntry('error', 'after_execute', {
        taskId: claimedTask.id,
        workerId: worker.getId(),
        metadata: buildRuntimeObservationLogMetadata(context, {
          sessionId,
          stage: 'after_execute',
          result: 'failed',
          error: result.error ?? 'Agent execution failed'
        })
      });
    }

    await persistSession(
      basePath,
      sessionId,
      taskManager,
      claimedTask.id,
      claimedTask.phase,
      workflowContext
    );
  }

  const summary = `Processed ${processed} task(s): ${completed} completed, ${failed} failed, ${blocked} blocked`;
  await updateRuntime(basePath, {
    status: blocked > 0 ? 'blocked' : 'idle',
    sessionId,
    phaseId: lastPhaseId,
    taskId: null,
    summary
  });
  await logManager.addEntry('info', 'runtime_completed', {
    metadata: {
      sessionId,
      processed,
      completed,
      failed,
      blocked,
      deliverables: deliverableCount
    }
  });
  await logManager.end();

  return {
    sessionId,
    processed,
    completed,
    failed,
    blocked,
    deliverables: deliverableCount
  };
}

function mergeAgentMetadata(
  metadata: AgentExecutionResult['metadata'],
  context: Awaited<ReturnType<typeof buildExecutionContext>>
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    harness: {
      permissionProfile: context.permissions.profile,
      canWriteWorkspace: context.permissions.canWriteWorkspace,
      requiresApproval: context.permissions.requiresApproval,
      taskSkills: context.superpowers.taskSkills,
      requiredSkills: context.superpowers.requiredSkills,
      executionMode: context.superpowers.executionMode,
      suggestedWorkflow: context.superpowers.suggestedWorkflow,
      capabilities: context.superpowers.capabilities.map((capability) => capability.id),
      workflowContext: context.workflowContext,
      observation: {
        readyTasks: context.observation.counts.readyTasks,
        blockedTasks: context.observation.counts.blockedTasks,
        pendingReview: context.observation.counts.pendingReview,
        unreadMessages: context.observation.counts.unreadMessages,
        unreadForWorker: context.observation.mailbox.unreadForWorker
      }
    }
  };
}

function buildRuntimeObservationLogMetadata(
  context: Awaited<ReturnType<typeof buildExecutionContext>>,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...extras,
    taskId: context.task.id,
    phaseId: context.phase.id,
    permissionProfile: context.permissions.profile,
    superpowers: {
      taskSkills: context.superpowers.taskSkills,
      requiredSkills: context.superpowers.requiredSkills,
      executionMode: context.superpowers.executionMode,
      suggestedWorkflow: context.superpowers.suggestedWorkflow,
      capabilities: context.superpowers.capabilities.map((capability) => capability.id)
    },
    workflowContext: context.workflowContext,
    observation: context.observation
  };
}

async function persistDeliverables(
  basePath: string,
  taskId: string,
  createdBy: string,
  drafts: NonNullable<AgentExecutionResult['deliverables']>
): Promise<Deliverable[]> {
  const workspace = await loadWorkspaceState(basePath);
  const existing = existsSync(workspace.paths.deliverablesIndex)
    ? await readJson<{ items: Deliverable[] } | Deliverable[]>(workspace.paths.deliverablesIndex)
    : { items: [] as Deliverable[] };
  const items = Array.isArray(existing) ? existing : existing.items;
  const deliverables: Deliverable[] = [];

  for (const draft of drafts) {
    const id = `del-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const extension =
      draft.type === 'code'
        ? 'ts'
        : draft.type === 'config'
          ? 'yaml'
          : draft.type === 'test'
            ? 'test.ts'
            : 'md';
    const relativePath = `.webforge/deliverables/${id}.${extension}`;

    await writeText(join(basePath, relativePath), draft.content);

    const deliverable: Deliverable = {
      id,
      taskId,
      type: draft.type,
      title: draft.title,
      content: draft.content,
      path: relativePath,
      createdBy,
      createdAt: new Date().toISOString(),
      status: 'pending_review'
    };

    items.push(deliverable);
    deliverables.push(deliverable);
  }

  await writeJson(workspace.paths.deliverablesIndex, { items });

  return deliverables;
}

async function sendApprovalRequests(
  basePath: string,
  workerId: string,
  deliverables: Deliverable[],
  needsReview: boolean
): Promise<void> {
  if (!needsReview || deliverables.length === 0) {
    return;
  }

  const requester = new Mailbox(workerId, basePath);
  const requestedAt = new Date().toISOString();

  for (const deliverable of deliverables) {
    await requester.send(
      'reviewer',
      'approval_request',
      buildApprovalRequestContent(deliverable),
      {
        taskId: deliverable.taskId,
        metadata: {
          deliverableId: deliverable.id,
          taskId: deliverable.taskId,
          deliverableType: deliverable.type,
          title: deliverable.title,
          requestedAt
        }
      }
    );
  }
}

function buildApprovalRequestContent(deliverable: Deliverable): string {
  return `交付物 ${deliverable.id} (${deliverable.title}) 请求审核`;
}

async function persistSession(
  basePath: string,
  sessionId: string,
  taskManager: TaskManager,
  currentTaskId: string | undefined,
  currentPhaseId: string | undefined,
  workflowContext: WorkspaceWorkflowContext | null
): Promise<void> {
  const workspace = await loadWorkspaceState(basePath);
  const now = new Date().toISOString();
  const snapshotPath = join(workspace.paths.sessions, `${sessionId}.json`);
  const indexPath = workspace.paths.sessionsIndex;
  const existingIndex = existsSync(indexPath)
    ? await readJson<{ sessions: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
        indexPath
      )
    : { sessions: [] as Array<Record<string, unknown>> };
  const sessions = Array.isArray(existingIndex) ? existingIndex : existingIndex.sessions;
  const currentStats = {
    tasksCompleted: taskManager.getAllTasks().filter((task) => task.status === 'completed').length,
    totalTasks: taskManager.getAllTasks().length
  };

  const previous = sessions.find((session) => session.id === sessionId);
  const createdAt =
    (previous?.createdAt as string | undefined) ||
    (previous?.created_at as string | undefined) ||
    now;
  const contextSummary = currentTaskId ? `processed ${currentTaskId}` : 'runtime idle';

  const session = {
    id: sessionId,
    name: 'runtime main loop',
    createdAt,
    created_at: createdAt,
    lastActive: now,
    last_active: now,
    status: 'active' as const,
    currentPhaseId,
    currentPhase: currentPhaseId,
    currentTaskId,
    currentTask: currentTaskId,
    contextSummary,
    context_summary: contextSummary,
    nextAction: 'continue ready-task loop',
    next_action: 'continue ready-task loop',
    workflowContext,
    stats: currentStats
  };

  const snapshot = {
    session: {
      id: sessionId,
      name: 'runtime main loop',
      createdAt,
      lastActive: now,
      status: 'active' as const,
      currentPhaseId,
      currentTaskId,
      contextSummary,
      nextAction: 'continue ready-task loop',
      workflowContext: workflowContext ?? undefined,
      stats: currentStats
    },
    tasksSnapshot: taskManager.getAllTasks(),
    phasesSnapshot: taskManager.getAllPhases(),
    resumeGuidance: currentTaskId
      ? `Resume task ${currentTaskId} in phase ${currentPhaseId}`
      : 'Resume ready-task loop'
  };

  const index = sessions.filter((session) => session.id !== sessionId);
  index.push(session);
  index.sort((left, right) =>
    new Date(String(right.lastActive ?? right.last_active)).getTime() -
    new Date(String(left.lastActive ?? left.last_active)).getTime()
  );

  await writeJson(snapshotPath, snapshot);
  await writeJson(indexPath, { sessions: index });
}

async function updateRuntime(
  basePath: string,
  updates: Partial<WorkspaceRuntime>
): Promise<void> {
  const workspace = await loadWorkspaceState(basePath);
  const runtime: WorkspaceRuntime = {
    ...workspace.runtime,
    ...updates,
    workflowContext:
      updates.workflowContext === undefined
        ? workspace.runtime.workflowContext
        : normalizeWorkflowContext(updates.workflowContext),
    updatedAt: new Date().toISOString()
  };

  await writeJson(workspace.paths.runtime, runtime);
}

export async function setRuntimeWorkflowContext(
  basePath: string,
  workflowContext: WorkspaceWorkflowContext | null
): Promise<void> {
  await updateRuntime(basePath, { workflowContext });
}
