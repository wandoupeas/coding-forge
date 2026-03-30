import type {
  AgentConfig,
  AgentDeliverableDraft,
  AgentExecutionInput,
  AgentExecutionResult
} from '../context.js';

export interface AgentHandler {
  execute(
    input: AgentExecutionInput,
    config: AgentConfig
  ): Promise<AgentExecutionResult>;
}

export function createDefaultAgentHandler(): AgentHandler {
  return {
    async execute(input, config) {
      const deliverable = buildDefaultDeliverable(input, config);

      return {
        success: true,
        summary: `${config.name} completed ${input.task.id}`,
        deliverables: [deliverable],
        needsReview: true,
        metadata: {
          role: config.role,
          skills: config.skills
        }
      };
    }
  };
}

function buildDefaultDeliverable(
  input: AgentExecutionInput,
  config: AgentConfig
): AgentDeliverableDraft {
  return {
    type: detectDeliverableType(input.task.title),
    title: `${input.task.title} 交付物`,
    content: [
      `# ${input.task.title}`,
      '',
      `- Task ID: ${input.task.id}`,
      `- Phase: ${input.context.phase.id} ${input.context.phase.name}`,
      `- Worker Role: ${config.role}`,
      `- Knowledge Items: ${input.context.knowledge.items.length}`,
      `- Existing Deliverables: ${input.context.deliverables.task.length}`,
      '',
      '## Task Description',
      '',
      input.task.description || '暂无补充描述。',
      '',
      '## Context Notes',
      '',
      input.context.sessions.active
        ? `当前活动会话: ${input.context.sessions.active.id}`
        : '当前没有活动会话。'
    ].join('\n')
  };
}

function detectDeliverableType(title: string): AgentDeliverableDraft['type'] {
  const normalized = title.toLowerCase();

  if (normalized.includes('测试') || normalized.includes('test')) {
    return 'test';
  }
  if (
    normalized.includes('实现') ||
    normalized.includes('开发') ||
    normalized.includes('code')
  ) {
    return 'code';
  }
  if (normalized.includes('配置') || normalized.includes('config')) {
    return 'config';
  }
  if (normalized.includes('设计') || normalized.includes('ui')) {
    return 'design';
  }

  return 'document';
}
