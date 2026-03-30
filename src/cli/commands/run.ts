/**
 * run 命令 - runtime 兼容入口
 * CLI 仅负责参数解析和结果渲染，真正执行交给 core/runtime。
 */

import { Command } from 'commander';
import logger from '../utils/logger.js';
import { reviewTaskDeliverables } from '../../agent/index.js';
import { listDeliverables } from '../../core/deliverable.js';
import { runReadyTasks, type RuntimeRunResult } from '../../core/runtime.js';
import { loadWorkspaceState } from '../../core/workspace.js';
import type { Task } from '../../types/index.js';

export interface RunOptions {
  dryRun?: boolean;
  limit?: number;
  phase?: string;
  worker?: string;
  auto?: boolean;
  superpowers?: boolean;
  execution?: 'subagent' | 'inline';
  session?: string;
}

export function createRunCommand(): Command {
  return new Command('run')
    .description('执行 ready 队列中的任务（兼容层，内部走 runtime core）')
    .option('-d, --dry-run', '仅预览 runtime 将要执行的 ready 队列')
    .option('-n, --limit <count>', '最多执行的 ready 任务数', parsePositiveInteger)
    .option('-p, --phase <id>', '兼容选项：保留旧参数，但当前 runtime 不直接按 phase 过滤')
    .option('-w, --worker <role>', '兼容选项：保留旧参数，但当前 runtime 不直接按 worker 过滤')
    .option('--auto', '兼容选项：runtime 已默认按 ready 队列批量执行')
    .option('-s, --superpowers', '兼容选项：superpowers 由规划与技能体系决定', true)
    .option('-e, --execution <mode>', '兼容选项：CLI 不再直接切换 execution mode', 'subagent')
    .option('--session <id>', '覆盖默认生成的 runtime session id')
    .action(async (options: RunOptions) => {
      try {
        await runCommand(options);
      } catch (error) {
        logger.error(`运行失败: ${error}`);
        process.exit(1);
      }
    });
}

export async function runCommand(
  options: RunOptions,
  basePath: string = process.cwd()
): Promise<void> {
  logger.h1('🚀 Runtime 执行入口');
  renderCompatibilityWarnings(options);

  if (options.dryRun) {
    await renderDryRun(basePath, options.limit);
    return;
  }

  const result = await runReadyTasks(basePath, {
    limit: options.limit,
    sessionId: options.session
  });

  renderRunSummary(result);
}

function renderCompatibilityWarnings(options: RunOptions): void {
  if (options.auto) {
    logger.info('`--auto` 已成为默认行为，runtime 会按 ready 队列连续处理任务。');
  }

  if (options.phase) {
    logger.warning(
      `当前兼容层尚未将 \`--phase ${options.phase}\` 下推到 runtime core，已按全局 ready 队列执行。`
    );
  }

  if (options.worker) {
    logger.warning(
      `当前兼容层尚未将 \`--worker ${options.worker}\` 下推到 runtime core，已按任务分配规则执行。`
    );
  }

  if (options.execution && options.execution !== 'subagent') {
    logger.warning(
      `\`--execution ${options.execution}\` 仅为兼容保留；执行模式现在由 agent 自身和 skills 决定。`
    );
  }

  if (options.superpowers === false) {
    logger.warning(
      '`--no-superpowers` 仅为兼容保留；CLI 不再直接切换 superpowers，相关行为由规划结果与技能路由决定。'
    );
  }
}

async function renderDryRun(basePath: string, limit?: number): Promise<void> {
  const workspace = await loadWorkspaceState(basePath);
  const readyTasks = getReadyTasks(workspace.tasks.tasks, limit);

  logger.h2('Runtime 预览');
  logger.info(`status: ${workspace.runtime.status}`);
  logger.info(`session: ${workspace.runtime.sessionId ?? 'none'}`);
  logger.info(`summary: ${workspace.runtime.summary}`);
  logger.info(`ready tasks: ${readyTasks.length}`);

  if (readyTasks.length > 0) {
    console.log();
    logger.h2('即将执行的任务');
    for (const task of readyTasks.slice(0, 5)) {
      console.log(`  ${task.id}: ${task.title} (${task.assignee}) [${task.phase}]`);
    }
  } else {
    logger.info('当前没有 ready task。');
  }
}

function renderRunSummary(result: RuntimeRunResult): void {
  console.log();
  logger.h2('Runtime 执行结果');
  logger.info(`session: ${result.sessionId}`);
  logger.info(`processed: ${result.processed}`);
  logger.info(`completed: ${result.completed}`);
  logger.info(`failed: ${result.failed}`);
  logger.info(`blocked: ${result.blocked}`);
  logger.info(`deliverables: ${result.deliverables}`);
  console.log();
  logger.info('下一步:');
  logger.list([
    'webforge dashboard        # 查看 runtime / task / session 状态',
    'webforge resume           # 查看恢复建议与 next action',
    'webforge deliverables     # 查看交付物'
  ]);
}

function getReadyTasks(tasks: Task[], limit?: number): Task[] {
  const readyTasks = tasks
    .filter((task) => task.status === 'ready')
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      const createdAtDiff =
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return left.id.localeCompare(right.id);
    });

  if (limit === undefined) {
    return readyTasks;
  }

  return readyTasks.slice(0, limit);
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }

  return parsed;
}

export function createDeliverablesCommand(basePath: string = process.cwd()): Command {
  return new Command('deliverables')
    .description('查看交付物')
    .argument('[task-id]', '任务 ID')
    .action(async (taskId?: string) => {
      if (taskId) {
        await reviewTaskDeliverables(taskId, basePath);
        return;
      }

      const deliverables = await listDeliverables(undefined, basePath);
      console.log(`\n📦 所有交付物 (${deliverables.length}):\n`);

      const grouped = {
        pending_review: deliverables.filter((item) => item.status === 'pending_review'),
        approved: deliverables.filter((item) => item.status === 'approved'),
        rejected: deliverables.filter((item) => item.status === 'rejected')
      };

      if (grouped.pending_review.length > 0) {
        console.log('⏳ 待审核:');
        for (const item of grouped.pending_review) {
          console.log(`   • ${item.taskId}: ${item.title}`);
        }
        console.log();
      }

      if (grouped.approved.length > 0) {
        console.log('✅ 已通过:');
        for (const item of grouped.approved) {
          console.log(`   • ${item.taskId}: ${item.title}`);
        }
        console.log();
      }

      if (grouped.rejected.length > 0) {
        console.log('❌ 已拒绝:');
        for (const item of grouped.rejected) {
          console.log(`   • ${item.taskId}: ${item.title}`);
        }
      }
    });
}
