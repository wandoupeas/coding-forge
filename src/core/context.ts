import { resolve } from 'path';
import {
  buildObservationSnapshot,
  loadPermissionHints,
  loadSuperpowersHints,
  type ObservationSnapshot,
  type PermissionHints,
  type SuperpowersHints
} from './harness-hints.js';
import {
  getRuntimeWorkflowContext,
  getSessionWorkflowContext,
  getTaskWorkflowContext,
  pickWorkflowContext
} from './workflow-context.js';
import { loadWorkspaceState } from './workspace.js';
import type {
  Phase,
  Task,
  WorkspaceDeliverableIndexEntry,
  WorkspaceKnowledgeIndexEntry,
  WorkspacePaths,
  WorkspaceRuntime,
  WorkspaceSessionIndexEntry,
  WorkspaceWorkflowContext
} from '../types/index.js';

export interface ExecutionContext {
  workspace: {
    basePath: string;
    paths: WorkspacePaths;
  };
  runtime: WorkspaceRuntime;
  task: Task;
  phase: Phase;
  knowledge: {
    items: WorkspaceKnowledgeIndexEntry[];
    requirements: WorkspaceKnowledgeIndexEntry[];
    design: WorkspaceKnowledgeIndexEntry[];
    decisions: WorkspaceKnowledgeIndexEntry[];
    parsed: WorkspaceKnowledgeIndexEntry[];
    notes: WorkspaceKnowledgeIndexEntry[];
  };
  deliverables: {
    items: WorkspaceDeliverableIndexEntry[];
    task: WorkspaceDeliverableIndexEntry[];
  };
  sessions: {
    items: WorkspaceSessionIndexEntry[];
    active: WorkspaceSessionIndexEntry | null;
    related: WorkspaceSessionIndexEntry[];
  };
  superpowers: SuperpowersHints;
  workflowContext: WorkspaceWorkflowContext | null;
  permissions: PermissionHints;
  observation: ObservationSnapshot;
}

export async function buildExecutionContext(
  basePath: string,
  taskId: string,
  options: { workerId?: string } = {}
): Promise<ExecutionContext> {
  const workspace = await loadWorkspaceState(basePath);
  const task = workspace.tasks.tasks.find((item) => item.id === taskId);

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const phase = workspace.phases.phases.find((item) => item.id === task.phase);
  if (!phase) {
    throw new Error(`Phase not found for task ${taskId}: ${task.phase}`);
  }

  const knowledgeItems = workspace.indexes.knowledge;
  const deliverables = workspace.indexes.deliverables;
  const sessions = workspace.indexes.sessions;
  const relatedSessions = sessions.filter(
    (session) =>
      session.currentTask === taskId ||
      (!session.currentTask && session.currentPhase === phase.id)
  );
  const activeSession =
    pickMostRecentSession(relatedSessions.filter((session) => session.status === 'active')) ||
    pickMostRecentSession(relatedSessions);
  const workflowContext = pickWorkflowContext(
    getTaskWorkflowContext(task),
    getSessionWorkflowContext(activeSession),
    getRuntimeWorkflowContext(workspace.runtime)
  );
  const [superpowers, permissions, observation] = await Promise.all([
    loadSuperpowersHints(basePath, task),
    loadPermissionHints(basePath),
    buildObservationSnapshot(basePath, workspace, {
      taskId,
      relatedSessionCount: relatedSessions.length,
      workerId: options.workerId
    })
  ]);

  return {
    workspace: {
      basePath: resolve(basePath),
      paths: workspace.paths
    },
    runtime: workspace.runtime,
    task,
    phase,
    knowledge: {
      items: knowledgeItems,
      requirements: knowledgeItems.filter((item) => item.type === 'requirement'),
      design: knowledgeItems.filter((item) => item.type === 'design'),
      decisions: knowledgeItems.filter((item) => item.type === 'decision'),
      parsed: knowledgeItems.filter((item) => item.type === 'parsed'),
      notes: knowledgeItems.filter((item) => item.type === 'note')
    },
    deliverables: {
      items: deliverables,
      task: deliverables.filter((item) => item.taskId === taskId)
    },
    sessions: {
      items: sessions,
      active: activeSession,
      related: relatedSessions
    },
    superpowers,
    workflowContext,
    permissions,
    observation
  };
}

function pickMostRecentSession(
  sessions: WorkspaceSessionIndexEntry[]
): WorkspaceSessionIndexEntry | null {
  if (sessions.length === 0) {
    return null;
  }

  return sessions.reduce((latest, current) =>
    new Date(current.lastActive).getTime() > new Date(latest.lastActive).getTime()
      ? current
      : latest
  );
}
