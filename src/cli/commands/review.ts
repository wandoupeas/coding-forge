/**
 * review 命令 - 审核交付物
 */

import { Command } from 'commander';
import logger from '../utils/logger.js';
import { Mailbox } from '../../core/mailbox.js';
import {
  listDeliverables,
  reviewDeliverable,
  type Deliverable
} from '../../core/deliverable.js';

export interface ReviewOptions {
  approve?: boolean;
  reject?: boolean;
  comment?: string;
  all?: boolean;
}

export function createReviewCommand(basePath: string = process.cwd()): Command {
  return new Command('review')
    .description('审核交付物，可传 deliverable ID 或 task ID')
    .argument('<target>', 'deliverable ID 或 task ID')
    .option('--approve', '通过审核')
    .option('--reject', '拒绝审核')
    .option('-m, --comment <comment>', '审核说明')
    .option('--all', '按 task ID 审核时包含非 pending_review 的交付物')
    .action(async (target: string, options: ReviewOptions) => {
      try {
        await reviewCommand(target, options, basePath);
      } catch (error) {
        logger.error(`审核失败: ${error}`);
        process.exit(1);
      }
    });
}

export async function reviewCommand(
  target: string,
  options: ReviewOptions,
  basePath: string = process.cwd()
): Promise<void> {
  if (options.approve && options.reject) {
    throw new Error('不能同时指定 --approve 和 --reject');
  }

  const approved = options.reject ? false : true;
  const deliverables = await listDeliverables(undefined, basePath);
  const resolved = resolveReviewTargets(deliverables, target, options.all === true);

  if (resolved.targets.length === 0) {
    logger.info(
      resolved.mode === 'task'
        ? `任务 ${target} 当前没有可审核的交付物`
        : `没有找到目标 ${target} 对应的交付物`
    );
    return;
  }

  const reviewedAt = new Date().toISOString();
  const reviewerMailbox = new Mailbox('reviewer', basePath);

  for (const deliverable of resolved.targets) {
    await reviewDeliverable(deliverable.id, approved, options.comment, basePath);
    await reviewerMailbox.send(
      deliverable.createdBy,
      'approval_result',
      buildReviewMessageContent(deliverable, approved, options.comment),
      {
        taskId: deliverable.taskId,
        metadata: {
          deliverableId: deliverable.id,
          taskId: deliverable.taskId,
          approved,
          comment: options.comment ?? null,
          reviewedAt
        }
      }
    );
  }

  logger.h1(approved ? '✅ 审核通过' : '❌ 审核拒绝');
  logger.info(`目标: ${target} (${resolved.mode})`);
  logger.info(`更新数量: ${resolved.targets.length}`);
  if (options.comment) {
    logger.info(`说明: ${options.comment}`);
  }

  for (const deliverable of resolved.targets) {
    console.log(
      `  • ${deliverable.id} ${deliverable.title} -> ${approved ? 'approved' : 'rejected'}`
    );
  }
}

function buildReviewMessageContent(
  deliverable: Deliverable,
  approved: boolean,
  comment?: string
): string {
  const decision = approved ? '通过' : '拒绝';
  const suffix = comment ? `：${comment}` : '';
  return `交付物 ${deliverable.id} (${deliverable.title}) 已${decision}审核${suffix}`;
}

function resolveReviewTargets(
  deliverables: Deliverable[],
  target: string,
  includeAllTaskDeliverables: boolean
): { mode: 'deliverable' | 'task'; targets: Deliverable[] } {
  const deliverableMatch = deliverables.find((deliverable) => deliverable.id === target);
  if (deliverableMatch) {
    return {
      mode: 'deliverable',
      targets: [deliverableMatch]
    };
  }

  const taskMatches = deliverables.filter((deliverable) => deliverable.taskId === target);
  if (taskMatches.length === 0) {
    return {
      mode: /^T/i.test(target) ? 'task' : 'deliverable',
      targets: []
    };
  }

  return {
    mode: 'task',
    targets: includeAllTaskDeliverables
      ? taskMatches
      : taskMatches.filter((deliverable) => deliverable.status === 'pending_review')
  };
}
