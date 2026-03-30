import type { ExecutionContext } from '../core/context.js';
import type { DeliverableType } from '../core/deliverable.js';
import type {
  AgentPermissionProfile,
  AgentProvider,
  Task
} from '../types/index.js';

export interface AgentRuntimeProfile {
  provider: AgentProvider;
  fallbackProvider?: AgentProvider;
  permissionProfile: AgentPermissionProfile;
  model?: string;
  command?: string;
}

export interface AgentConfig {
  name: string;
  role: string;
  systemPrompt: string;
  skills: string[];
  runtimeProfile: AgentRuntimeProfile;
}

export interface AgentExecutionInput {
  task: Task;
  context: ExecutionContext;
}

export interface AgentDeliverableDraft {
  type: DeliverableType;
  title: string;
  content: string;
}

export interface AgentExecutionResult {
  success: boolean;
  summary: string;
  deliverables?: AgentDeliverableDraft[];
  needsReview: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export function summarizeExecutionContext(context: ExecutionContext): string {
  return [
    `task=${context.task.id}`,
    `phase=${context.phase.id}`,
    `knowledge=${context.knowledge.items.length}`,
    `deliverables=${context.deliverables.task.length}`,
    `sessions=${context.sessions.related.length}`,
    `skills=${context.superpowers.taskSkills.length}`,
    `capabilities=${context.superpowers.capabilities.length}`,
    `workflow=${context.workflowContext?.workflow ?? 'none'}`,
    `permission=${context.permissions.profile}`,
    `ready=${context.observation.counts.readyTasks}`,
    `pendingReview=${context.observation.counts.pendingReview}`
  ].join(', ');
}
