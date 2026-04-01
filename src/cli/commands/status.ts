/**
 * status 命令 - 查看当前 workspace 状态摘要
 */

import { Command } from 'commander';
import { loadWorkspaceState } from '../../core/workspace.js';
import logger from '../utils/logger.js';

export interface StatusCommandOptions {
  json?: boolean;
}

export function createStatusCommand(): Command {
  return new Command('status')
    .description('查看当前 workspace 状态摘要')
    .option('--json', '输出 JSON 格式')
    .action(async (options: StatusCommandOptions) => {
      try {
        await statusCommand(options);
      } catch (error) {
        logger.error(`获取状态失败: ${error}`);
        process.exit(1);
      }
    });
}

export async function statusCommand(options: StatusCommandOptions = {}): Promise<void> {
  const workspace = await loadWorkspaceState(process.cwd());

  const { runtime, tasks, phases, indexes } = workspace;

  // 统计任务状态
  const taskStats = {
    total: tasks.tasks.length,
    completed: tasks.tasks.filter((t) => t.status === 'completed').length,
    inProgress: tasks.tasks.filter((t) => t.status === 'in_progress').length,
    ready: tasks.tasks.filter((t) => t.status === 'ready').length,
    blocked: tasks.tasks.filter((t) => t.status === 'blocked').length,
    pending: tasks.tasks.filter((t) => t.status === 'pending').length
  };

  // 当前阶段
  const currentPhase = phases.phases.find((p) => p.id === runtime.phaseId);

  // 当前任务
  const currentTask = tasks.tasks.find((t) => t.id === runtime.taskId);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          runtime: {
            status: runtime.status,
            sessionId: runtime.sessionId,
            phaseId: runtime.phaseId,
            taskId: runtime.taskId,
            summary: runtime.summary,
            updatedAt: runtime.updatedAt
          },
          tasks: taskStats,
          phases: {
            total: phases.phases.length,
            current: currentPhase?.name ?? null
          },
          knowledge: indexes.knowledge.length,
          deliverables: indexes.deliverables.length,
          sessions: indexes.sessions.length
        },
        null,
        2
      )
    );
    return;
  }

  // 文本输出
  logger.h1('📊 WebForge 状态');
  console.log();

  logger.h2('Runtime');
  console.log(`  状态: ${runtime.status}`);
  console.log(`  会话: ${runtime.sessionId ?? '无'}`);
  console.log(`  阶段: ${currentPhase?.name ?? runtime.phaseId ?? '无'}`);
  console.log(`  任务: ${currentTask?.title ?? runtime.taskId ?? '无'}`);
  console.log(`  更新: ${new Date(runtime.updatedAt).toLocaleString()}`);
  console.log();

  logger.h2('任务统计');
  console.log(`  总计: ${taskStats.total}`);
  console.log(`  ✅ 已完成: ${taskStats.completed}`);
  console.log(`  🔄 进行中: ${taskStats.inProgress}`);
  console.log(`  📋 就绪: ${taskStats.ready}`);
  console.log(`  ⏸️  阻塞: ${taskStats.blocked}`);
  console.log(`  ⏳ 待处理: ${taskStats.pending}`);
  console.log();

  logger.h2('索引');
  console.log(`  知识文档: ${indexes.knowledge.length}`);
  console.log(`  交付物: ${indexes.deliverables.length}`);
  console.log(`  会话: ${indexes.sessions.length}`);
  console.log();

  if (runtime.summary) {
    logger.h2('摘要');
    console.log(`  ${runtime.summary}`);
  }
}
