/**
 * checkpoint 命令 - 查看与回滚检查点
 */

import { Command } from 'commander';
import logger from '../utils/logger.js';
import {
  listCheckpoints,
  rollbackToCheckpoint,
  type Checkpoint
} from '../../core/checkpoint.js';

export interface CheckpointRollbackOptions {
  restoreDeliverables?: boolean;
}

export function createCheckpointCommand(basePath: string = process.cwd()): Command {
  const command = new Command('checkpoint').description('查看与回滚 workspace 检查点');

  command
    .command('list')
    .description('列出所有检查点')
    .action(async () => {
      try {
        await listCheckpointsCommand(basePath);
      } catch (error) {
        logger.error(`读取检查点失败: ${error}`);
        process.exit(1);
      }
    });

  command
    .command('rollback')
    .description('回滚到指定检查点')
    .argument('<checkpoint-id>', '检查点 ID')
    .option('--restore-deliverables', '同时恢复交付物文件和 deliverables index')
    .action(async (checkpointId: string, options: CheckpointRollbackOptions) => {
      try {
        await rollbackCommand(checkpointId, options, basePath);
      } catch (error) {
        logger.error(`回滚失败: ${error}`);
        process.exit(1);
      }
    });

  return command;
}

export async function listCheckpointsCommand(
  basePath: string = process.cwd()
): Promise<Checkpoint[]> {
  const checkpoints = await listCheckpoints(basePath);

  logger.h1('🧷 检查点列表');
  if (checkpoints.length === 0) {
    logger.info('当前 workspace 没有可用检查点。');
    return checkpoints;
  }

  logger.info(`总数: ${checkpoints.length}`);
  console.log();

  for (const checkpoint of checkpoints) {
    console.log(`  • ${checkpoint.id}`);
    console.log(`    ${checkpoint.name}`);
    console.log(`    ${new Date(checkpoint.createdAt).toLocaleString()}`);
    if (checkpoint.description) {
      console.log(`    ${checkpoint.description}`);
    }
    if (checkpoint.deliverables.length > 0) {
      console.log(`    deliverables: ${checkpoint.deliverables.length}`);
    }
    console.log();
  }

  return checkpoints;
}

export async function rollbackCommand(
  checkpointId: string,
  options: CheckpointRollbackOptions,
  basePath: string = process.cwd()
): Promise<void> {
  const restored = await rollbackToCheckpoint(checkpointId, basePath, {
    restoreDeliverables: options.restoreDeliverables === true
  });

  if (!restored) {
    logger.warning(`没有找到检查点 ${checkpointId}`);
    return;
  }

  logger.h1('↩ 检查点已恢复');
  logger.info(`checkpoint: ${checkpointId}`);
  logger.info(`tasks: ${restored.tasks.length}`);
  logger.info(`phases: ${restored.phases.length}`);

  if (options.restoreDeliverables) {
    logger.info(`deliverables: ${restored.deliverables?.length ?? 0}`);
  } else {
    logger.info('deliverables: 未恢复（如需恢复请加 --restore-deliverables）');
  }

  console.log();
  logger.info('下一步:');
  logger.list([
    'webforge dashboard                 # 查看回滚后的 runtime / task 状态',
    'webforge checkpoint list           # 查看当前检查点',
    'webforge deliverables              # 检查交付物状态'
  ]);
}
