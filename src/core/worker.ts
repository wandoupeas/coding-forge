/**
 * Worker 系统
 * 保留身份、配置、邮箱和 Agent 访问能力
 */

import type { AgentExecutionInput, AgentExecutionResult } from '../agent/context.js';
import { Agent } from '../agent/index.js';
import type { Task, WorkerConfig } from '../types/index.js';
import { normalizeRuntimeProfile } from '../agent/adapters/index.js';
import {
  createDefaultAgentProfileConfig,
  createDefaultWorkerConfig,
  loadConfig,
  loadWorkerConfig
} from '../utils/config.js';
import logger from '../cli/utils/logger.js';
import { listDeliverables } from './deliverable.js';
import { buildExecutionContext } from './context.js';
import { Mailbox } from './mailbox.js';
import { TaskManager } from './task.js';

export function inferWorkerForTask(task: Task): string {
  const title = task.title.toLowerCase();

  if (title.includes('测试')) return 'qa';
  if (title.includes('部署') || title.includes('运维')) return 'devops';
  if (title.includes('前端') || title.includes('ui')) return 'frontend';
  if (title.includes('需求') || title.includes('prd')) return 'pm';
  if (title.includes('架构') || title.includes('设计')) return 'tech-lead';

  return 'backend';
}

export class Worker {
  private readonly id: string;
  private readonly basePath: string;
  private readonly taskManager: TaskManager;
  private readonly mailbox: Mailbox;
  private config: WorkerConfig;
  private agent: Agent;

  constructor(id: string, taskManager: TaskManager, basePath: string = process.cwd()) {
    this.id = id;
    this.basePath = basePath;
    this.taskManager = taskManager;
    this.mailbox = new Mailbox(id, basePath);
    this.config = createDefaultWorkerConfig(id);
    this.agent = new Agent({
      name: this.config.name,
      role: this.config.role,
      systemPrompt: this.config.system_prompt,
      skills: this.config.skills,
      runtimeProfile: normalizeRuntimeProfile(createDefaultAgentProfileConfig())
    });
  }

  async init(): Promise<void> {
    await this.mailbox.init();

    try {
      this.config = await loadWorkerConfig(this.id, this.basePath);
    } catch {
      this.config = createDefaultWorkerConfig(this.id);
      logger.warning(`Worker ${this.id} 使用默认配置`);
    }

    let runtimeProfile = normalizeRuntimeProfile(createDefaultAgentProfileConfig());
    try {
      const projectConfig = await loadConfig(this.basePath);
      runtimeProfile = normalizeRuntimeProfile(projectConfig.agent);
    } catch {
      logger.warning(`Workspace ${this.basePath} 未加载到 agent profile，已回退到 stub adapter`);
    }

    this.agent = new Agent({
      name: this.config.name,
      role: this.config.role,
      systemPrompt: this.config.system_prompt,
      skills: this.config.skills,
      runtimeProfile
    });
  }

  async claimTask(taskId: string): Promise<boolean> {
    const task = await this.taskManager.claimTask(taskId, this.id);
    return task !== undefined;
  }

  async execute(input: AgentExecutionInput): Promise<AgentExecutionResult> {
    return this.agent.execute(input);
  }

  async executeTask(task: Task): Promise<{ success: boolean; output?: string; error?: string }> {
    const context = await buildExecutionContext(this.basePath, task.id, {
      workerId: this.id
    });
    const result = await this.execute({ task, context });

    return {
      success: result.success,
      output: result.summary,
      error: result.error
    };
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.config.name;
  }

  getRole(): string {
    return this.config.role;
  }

  getAdapterProvider(): string {
    return this.agent.getAdapterProvider();
  }

  getMailbox(): Mailbox {
    return this.mailbox;
  }
}

export class WorkerManager {
  private readonly workers: Map<string, Worker> = new Map();
  private readonly taskManager: TaskManager;
  private readonly basePath: string;

  constructor(taskManager: TaskManager, basePath: string = process.cwd()) {
    this.taskManager = taskManager;
    this.basePath = basePath;
  }

  async registerWorker(workerId: string): Promise<Worker> {
    const worker = new Worker(workerId, this.taskManager, this.basePath);
    await worker.init();
    this.workers.set(workerId, worker);
    return worker;
  }

  getWorker(id: string): Worker | undefined {
    return this.workers.get(id);
  }

  getAllWorkers(): Worker[] {
    return Array.from(this.workers.values());
  }

  async assignTasks(): Promise<void> {
    await this.taskManager.load();
    const readyTasks = this.taskManager.getReadyTasks();

    for (const task of readyTasks) {
      if (task.assignee) {
        continue;
      }

      const workerId = inferWorkerForTask(task);
      const worker = this.workers.get(workerId);
      if (worker) {
        await worker.claimTask(task.id);
      }
    }
  }

  async executeRound(): Promise<{ completed: number; waitingReview: number; failed: number }> {
    await this.taskManager.load();

    const readyTasks = this.taskManager
      .getReadyTasks()
      .filter((task) => task.assignee && this.workers.has(task.assignee));

    let completed = 0;
    let failed = 0;

    for (const task of readyTasks) {
      const worker = this.workers.get(task.assignee);
      if (!worker) {
        continue;
      }

      const result = await worker.executeTask(task);
      if (result.success) {
        completed += 1;
      } else {
        failed += 1;
      }
    }

    return {
      completed,
      waitingReview: 0,
      failed
    };
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

  console.log(`\n💡 使用 webforge review ${taskId} 来审核交付物`);
}
