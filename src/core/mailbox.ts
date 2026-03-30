/**
 * 邮箱系统核心模块
 * 实现 Worker 间的异步消息通信
 */

import { Message, MessageType } from '../types/index.js';
import { readText, writeText, readJson, writeJson } from '../utils/file.js';
import { ensureDir } from '../utils/file.js';
import { dirname } from 'path';
import { join } from 'path';
import { existsSync } from 'fs';
import { appendFile } from 'fs/promises';
import { withFileLock } from '../utils/lock.js';

const MAILBOX_DIR = '.webforge/mailboxes';

interface MailboxReadState {
  readMessageIds: string[];
}

/**
 * 邮箱管理器
 */
export class Mailbox {
  private workerId: string;
  private basePath: string;
  private mailboxPath: string;
  private statePath: string;
  private mailboxLockPath: string;

  constructor(workerId: string, basePath: string = process.cwd()) {
    this.workerId = workerId;
    this.basePath = basePath;
    this.mailboxPath = join(basePath, MAILBOX_DIR, `${workerId}.jsonl`);
    this.statePath = join(basePath, MAILBOX_DIR, '.state', `${workerId}.json`);
    this.mailboxLockPath = join(basePath, MAILBOX_DIR, '.locks', `${workerId}.lock`);
  }

  /**
   * 初始化邮箱
   */
  async init(): Promise<void> {
    await ensureDir(join(this.basePath, MAILBOX_DIR));
    await ensureDir(dirname(this.statePath));
    await ensureDir(dirname(this.mailboxLockPath));
  }

  /**
   * 发送消息到指定 Worker
   */
  async send(
    to: string,
    type: MessageType,
    content: string,
    options?: {
      taskId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Message> {
    const message: Message = {
      id: this.generateMessageId(),
      from: this.workerId,
      to,
      type,
      content,
      task_id: options?.taskId,
      timestamp: new Date().toISOString(),
      read: false,
      metadata: options?.metadata
    };

    const targetMailbox = join(this.basePath, MAILBOX_DIR, `${to}.jsonl`);
    const targetLock = join(this.basePath, MAILBOX_DIR, '.locks', `${to}.lock`);
    await withFileLock(targetLock, async () => {
      await this.appendMessage(targetMailbox, message);
    });

    return message;
  }

  /**
   * 广播消息给所有 Worker
   */
  async broadcast(
    type: MessageType,
    content: string,
    recipients: string[],
    options?: {
      taskId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Message[]> {
    const messages: Message[] = [];

    for (const recipient of recipients) {
      if (recipient !== this.workerId) {
        const msg = await this.send(recipient, type, content, options);
        messages.push(msg);
      }
    }

    return messages;
  }

  /**
   * 接收消息
   */
  async receive(options?: {
    limit?: number;
    unreadOnly?: boolean;
    markAsRead?: boolean;
  }): Promise<Message[]> {
    if (options?.markAsRead) {
      return withFileLock(this.mailboxLockPath, async () => {
        const messages = await this.loadMessages();
        const filtered = options?.unreadOnly
          ? messages.filter(message => !message.read)
          : messages;
        const limit = options?.limit ?? 10;
        const result = filtered.slice(-limit);
        const unreadIds = result
          .filter(message => !message.read)
          .map(message => message.id);

        if (unreadIds.length > 0) {
          await this.markMessageIdsAsRead(unreadIds);
          for (const msg of result) {
            msg.read = true;
          }
        }

        return result;
      });
    }

    const messages = await this.loadMessages();
    let filtered = messages;
    if (options?.unreadOnly) {
      filtered = filtered.filter(m => !m.read);
    }

    const limit = options?.limit ?? 10;
    return filtered.slice(-limit);
  }

  /**
   * 等待特定类型的消息
   */
  async waitFor(
    type: MessageType,
    options?: {
      from?: string;
      taskId?: string;
      timeout?: number;
    }
  ): Promise<Message | null> {
    const timeout = options?.timeout ?? 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const match = await withFileLock(this.mailboxLockPath, async () => {
        const messages = await this.loadMessages();
        const unread = messages.filter(message => !message.read);
        const found = unread.find(message => {
          if (message.type !== type) return false;
          if (options?.from && message.from !== options.from) return false;
          if (options?.taskId && message.task_id !== options.taskId) return false;
          return true;
        });

        if (!found) {
          return null;
        }

        await this.markMessageIdsAsRead([found.id]);

        return {
          ...found,
          read: true
        };
      });

      if (match) {
        return match;
      }

      // 等待一段时间后重试
      await sleep(1000);
    }

    return null;
  }

  /**
   * 获取未读消息数量
   */
  async getUnreadCount(): Promise<number> {
    const messages = await this.loadMessages();
    return messages.filter(m => !m.read).length;
  }

  /**
   * 清空邮箱
   */
  async clear(): Promise<void> {
    await withFileLock(this.mailboxLockPath, async () => {
      await writeText(this.mailboxPath, '');
      await this.saveReadState({ readMessageIds: [] });
    });
  }

  // ==================== 私有方法 ====================

  private async loadMessages(): Promise<Message[]> {
    try {
      const content = await readText(this.mailboxPath);
      const lines = content.trim().split('\n').filter(Boolean);
      const readState = await this.loadReadState();
      const readIds = new Set(readState.readMessageIds);

      return lines.map(line => {
        const message = JSON.parse(line) as Message;
        return {
          ...message,
          read: message.read === true || readIds.has(message.id)
        };
      });
    } catch {
      return [];
    }
  }

  private async appendMessage(path: string, message: Message): Promise<void> {
    const line = JSON.stringify(message) + '\n';
    await ensureDir(dirname(path));
    await appendFile(path, line, 'utf-8');
  }

  private async markMessageIdsAsRead(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const current = await this.loadReadState();
    const merged = new Set(current.readMessageIds);

    for (const id of ids) {
      merged.add(id);
    }

    await this.saveReadState({ readMessageIds: Array.from(merged) });
  }

  private async loadReadState(): Promise<MailboxReadState> {
    try {
      if (!existsSync(this.statePath)) {
        return { readMessageIds: [] };
      }

      const state = await readJson<MailboxReadState>(this.statePath);
      if (!Array.isArray(state.readMessageIds)) {
        return { readMessageIds: [] };
      }

      return state;
    } catch {
      return { readMessageIds: [] };
    }
  }

  private async saveReadState(state: MailboxReadState): Promise<void> {
    await writeJson(this.statePath, state);
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取所有 Worker 的邮箱
 */
export async function getAllMailboxes(
  workerIds: string[],
  basePath?: string
): Promise<Mailbox[]> {
  return workerIds.map(id => new Mailbox(id, basePath));
}
