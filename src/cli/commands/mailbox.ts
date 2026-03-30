/**
 * mailbox 命令 - mailbox 观察与维护入口
 */

import { Command } from 'commander';
import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';
import { Mailbox } from '../../core/mailbox.js';
import { loadConfig } from '../../utils/config.js';

const MAILBOX_DIR = '.webforge/mailboxes';

export function createMailboxCommand(): Command {
  return new Command('mailbox')
    .description('查看或维护 Worker mailbox')
    .addCommand(createListCommand())
    .addCommand(createReadCommand())
    .addCommand(createClearCommand());
}

function createListCommand(): Command {
  return new Command('list')
    .description('列出已发现的 mailbox')
    .action(async () => {
      try {
        await listMailboxes();
      } catch (error) {
        logger.error(`列出失败: ${error}`);
        process.exit(1);
      }
    });
}

function createReadCommand(): Command {
  return new Command('read')
    .description('读取指定 Worker 的 mailbox')
    .argument('<worker>', 'Worker ID')
    .option('-a, --all', '显示全部消息（默认仅显示未读）')
    .option('-m, --mark-read', '将当前读取结果标记为已读')
    .action(async (workerId: string, options: { all?: boolean; markRead?: boolean }) => {
      try {
        await readMailbox(workerId, options);
      } catch (error) {
        logger.error(`读取失败: ${error}`);
        process.exit(1);
      }
    });
}

function createClearCommand(): Command {
  return new Command('clear')
    .description('清空指定 Worker 的 mailbox')
    .argument('<worker>', 'Worker ID')
    .action(async (workerId: string) => {
      try {
        await clearMailbox(workerId);
      } catch (error) {
        logger.error(`清空失败: ${error}`);
        process.exit(1);
      }
    });
}

export async function listMailboxes(basePath: string = process.cwd()): Promise<void> {
  logger.h1('📬 Worker 邮箱列表');

  const workers = await discoverMailboxWorkers(basePath);
  if (workers.length === 0) {
    logger.info('当前没有发现任何 mailbox。');
    return;
  }

  for (const workerId of workers) {
    const mailbox = new Mailbox(workerId, basePath);
    await mailbox.init();
    const unreadCount = await mailbox.getUnreadCount();
    const icon = unreadCount > 0 ? '🔔' : '📭';

    console.log(
      `  ${icon} ${workerId.padEnd(12)} ${
        unreadCount > 0 ? `(${unreadCount} 未读)` : '(0 未读)'
      }`
    );
  }
}

export async function readMailbox(
  workerId: string,
  options: { all?: boolean; markRead?: boolean },
  basePath: string = process.cwd()
): Promise<void> {
  logger.h1(`📬 ${workerId} 的邮箱`);

  const mailbox = new Mailbox(workerId, basePath);
  await mailbox.init();

  const messages = await mailbox.receive({
    unreadOnly: !options.all,
    markAsRead: options.markRead
  });

  if (messages.length === 0) {
    logger.info(options.all ? '邮箱为空' : '没有未读消息');
    return;
  }

  for (const message of messages) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  ID: ${message.id}`);
    console.log(`  来自: ${message.from}`);
    console.log(`  类型: ${message.type}`);
    console.log(`  时间: ${new Date(message.timestamp).toLocaleString()}`);
    console.log(`  内容: ${message.content}`);
    if (message.task_id) {
      console.log(`  关联任务: ${message.task_id}`);
    }
    console.log(`  状态: ${message.read ? '已读' : '未读'}`);
  }

  console.log(`\n共 ${messages.length} 条消息`);
}

export async function clearMailbox(
  workerId: string,
  basePath: string = process.cwd()
): Promise<void> {
  const mailbox = new Mailbox(workerId, basePath);
  await mailbox.init();
  await mailbox.clear();
  logger.success(`已清空 ${workerId} 的邮箱`);
}

async function discoverMailboxWorkers(basePath: string): Promise<string[]> {
  const workers = new Set<string>();

  try {
    const config = await loadConfig(basePath);
    for (const workerId of config.workers) {
      workers.add(workerId);
    }
  } catch {
    // config 不是 mailbox 观察面的强依赖
  }

  const mailboxRoot = join(basePath, MAILBOX_DIR);
  if (existsSync(mailboxRoot)) {
    const entries = await readdir(mailboxRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        workers.add(entry.name.slice(0, -'.jsonl'.length));
      }
    }
  }

  return Array.from(workers).sort();
}
