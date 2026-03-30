/**
 * Agent 标准执行门面
 * 仅负责接受标准化输入并委托给 handler
 */

import { listDeliverables } from '../core/deliverable.js';
import logger from '../cli/utils/logger.js';
import {
  AgentConfig,
  AgentExecutionInput,
  AgentExecutionResult
} from './context.js';
import { createAgentAdapter, type AgentAdapter } from './adapters/index.js';
import type { AgentExecutionEngine } from './adapters/base.js';

export type AgentTask = AgentExecutionInput;
export type AgentResult = AgentExecutionResult;
export { AgentConfig } from './context.js';

export class Agent {
  private readonly config: AgentConfig;
  private readonly executor: AgentExecutionEngine;

  constructor(
    config: AgentConfig,
    executor: AgentExecutionEngine = createAgentAdapter(config.runtimeProfile)
  ) {
    this.config = config;
    this.executor = executor;
  }

  async execute(input: AgentExecutionInput): Promise<AgentExecutionResult> {
    return this.executor.execute(input, this.config);
  }

  getAdapterProvider(): string {
    const candidate = this.executor as Partial<AgentAdapter>;
    return candidate.provider ?? 'custom';
  }
}

export async function reviewTaskDeliverables(
  taskId: string,
  basePath: string = process.cwd()
): Promise<void> {
  const deliverables = await listDeliverables(taskId, basePath);

  if (deliverables.length === 0) {
    logger.info('该任务没有交付物需要审核');
    return;
  }

  console.log(`\n📋 任务 "${taskId}" 的交付物:`);

  for (const deliverable of deliverables) {
    console.log(`\n  📄 ${deliverable.title}`);
    console.log(`     路径: ${deliverable.path}`);
    console.log(`     状态: ${deliverable.status}`);
  }

  console.log(`\n💡 使用 webforge review ${taskId} --approve 来审核交付物`);
}
