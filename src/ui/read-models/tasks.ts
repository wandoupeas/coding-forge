import { loadWorkspaceState } from '../../core/workspace.js';
import type { Task, TaskStatus } from '../../types/index.js';

export interface TaskStatusCounts {
  total: number;
  pending: number;
  ready: number;
  inProgress: number;
  blocked: number;
  completed: number;
  failed: number;
  pendingReview: number;
}

export interface TaskReadModelItem {
  id: string;
  phaseId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee: string;
  priority: number;
  dependsOn: string[];
  blockedBy: string[];
  updatedAt: string;
  workflow: string | null;
}

export interface TasksReadModel {
  counts: TaskStatusCounts;
  items: TaskReadModelItem[];
  ready: TaskReadModelItem[];
  inProgress: TaskReadModelItem[];
  blocked: TaskReadModelItem[];
  pendingReview: TaskReadModelItem[];
}

export async function buildTasksReadModel(basePath: string = process.cwd()): Promise<TasksReadModel> {
  const workspace = await loadWorkspaceState(basePath);
  const pendingReviewTaskIds = new Set(
    workspace.indexes.deliverables
      .filter((deliverable) => deliverable.status === 'pending_review')
      .map((deliverable) => deliverable.taskId)
  );
  const items = workspace.tasks.tasks
    .map((task) => toTaskReadModelItem(task))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    counts: {
      total: items.length,
      pending: countByStatus(items, 'pending'),
      ready: countByStatus(items, 'ready'),
      inProgress: countByStatus(items, 'in_progress'),
      blocked: countByStatus(items, 'blocked'),
      completed: countByStatus(items, 'completed'),
      failed: countByStatus(items, 'failed'),
      pendingReview: items.filter((item) => pendingReviewTaskIds.has(item.id)).length
    },
    items,
    ready: items.filter((item) => item.status === 'ready'),
    inProgress: items.filter((item) => item.status === 'in_progress'),
    blocked: items.filter((item) => item.status === 'blocked'),
    pendingReview: items.filter((item) => pendingReviewTaskIds.has(item.id))
  };
}

function toTaskReadModelItem(task: Task): TaskReadModelItem {
  return {
    id: task.id,
    phaseId: task.phase,
    title: task.title,
    description: task.description,
    status: task.status,
    assignee: task.assignee,
    priority: task.priority,
    dependsOn: task.depends_on,
    blockedBy: task.blocked_by ?? [],
    updatedAt: task.updated_at,
    workflow: task.workflowContext?.workflow ?? null
  };
}

function countByStatus(items: TaskReadModelItem[], status: TaskStatus): number {
  return items.filter((item) => item.status === status).length;
}
