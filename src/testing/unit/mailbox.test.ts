/**
 * 邮箱系统单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Mailbox } from '../../core/mailbox.js';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Mailbox', () => {
  let mailbox: Mailbox;
  let sandboxDir = '';

  beforeEach(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-mailbox-'));
    mailbox = new Mailbox('backend', sandboxDir);
    await mailbox.init();
  });

  afterEach(async () => {
    if (sandboxDir) {
      try {
        await rm(sandboxDir, { recursive: true, force: true });
      } catch {
        // 忽略删除错误
      }
      sandboxDir = '';
    }
  });

  describe('Message Sending', () => {
    it('应该发送消息到指定邮箱', async () => {
      const msg = await mailbox.send(
        'pm',
        'task_assign',
        '请完成这个任务'
      );

      expect(msg.from).toBe('backend');
      expect(msg.to).toBe('pm');
      expect(msg.type).toBe('task_assign');
      expect(msg.content).toBe('请完成这个任务');
    });

    it('应该为消息生成唯一 ID', async () => {
      const msg1 = await mailbox.send('pm', 'notification', '消息1');
      const msg2 = await mailbox.send('pm', 'notification', '消息2');

      expect(msg1.id).not.toBe(msg2.id);
    });

    it('应该包含 ISO 格式时间戳', async () => {
      const msg = await mailbox.send('pm', 'notification', '测试');

      expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Message Receiving', () => {
    it('应该读取指定数量的消息', async () => {
      const pmMailbox = new Mailbox('pm', sandboxDir);
      await pmMailbox.init();

      // 发送多条消息
      await mailbox.send('pm', 'notification', '消息1');
      await mailbox.send('pm', 'notification', '消息2');
      await mailbox.send('pm', 'notification', '消息3');

      const messages = await pmMailbox.receive({ limit: 2 });
      expect(messages.length).toBe(2);
    });

    it('应该支持过滤未读消息', async () => {
      const pmMailbox = new Mailbox('pm', sandboxDir);
      await pmMailbox.init();

      await mailbox.send('pm', 'notification', '测试消息');

      const unread = await pmMailbox.receive({ unreadOnly: true });
      expect(unread.length).toBe(1);
      expect(unread[0].read).toBe(false);
    });

    it('waitFor 应该只消费匹配的未读消息', async () => {
      const pmMailbox = new Mailbox('pm', sandboxDir);
      const frontendMailbox = new Mailbox('frontend', sandboxDir);
      await pmMailbox.init();
      await frontendMailbox.init();

      await mailbox.send('pm', 'notification', '保留的未读消息');
      await frontendMailbox.send('pm', 'task_complete', '匹配的消息');

      const match = await pmMailbox.waitFor('task_complete', {
        from: 'frontend',
        timeout: 50
      });

      expect(match?.content).toBe('匹配的消息');
      expect(await pmMailbox.getUnreadCount()).toBe(1);

      const unread = await pmMailbox.receive({ unreadOnly: true });
      expect(unread).toHaveLength(1);
      expect(unread[0].content).toBe('保留的未读消息');
    });

    it('应该在标记已读时更新未读计数', async () => {
      const pmMailbox = new Mailbox('pm', sandboxDir);
      await pmMailbox.init();

      await mailbox.send('pm', 'notification', '消息1');
      await mailbox.send('pm', 'notification', '消息2');

      const firstRead = await pmMailbox.receive({
        unreadOnly: true,
        markAsRead: true,
        limit: 1
      });

      expect(firstRead).toHaveLength(1);
      expect(firstRead[0].read).toBe(true);
      expect(await pmMailbox.getUnreadCount()).toBe(1);
    });

    it('应该在并发发送时保留所有消息', async () => {
      const pmMailbox = new Mailbox('pm', sandboxDir);
      await pmMailbox.init();

      await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          mailbox.send('pm', 'notification', `并发消息${index}`)
        )
      );

      const messages = await pmMailbox.receive({ limit: 20 });
      expect(messages).toHaveLength(20);
      expect(new Set(messages.map(message => message.content)).size).toBe(20);
    });

    it('应该原子消费消息，避免同一条消息被两个消费者重复领取', async () => {
      const pmMailbox = new Mailbox('pm', sandboxDir);
      await pmMailbox.init();

      await mailbox.send('pm', 'notification', 'only once');

      const [first, second] = await Promise.all([
        pmMailbox.receive({ unreadOnly: true, markAsRead: true, limit: 1 }),
        pmMailbox.receive({ unreadOnly: true, markAsRead: true, limit: 1 })
      ]);

      const consumed = [first, second].filter(messages => messages.length > 0);
      expect(consumed).toHaveLength(1);
      expect(consumed[0][0].content).toBe('only once');
      expect(await pmMailbox.getUnreadCount()).toBe(0);
    });

    it('应该把已读状态写入 sidecar，而不是回写 mailbox 日志', async () => {
      const pmMailbox = new Mailbox('pm', sandboxDir);
      await pmMailbox.init();

      await mailbox.send('pm', 'notification', 'message-1');
      await mailbox.send('pm', 'notification', 'message-2');

      await pmMailbox.receive({
        unreadOnly: true,
        markAsRead: true,
        limit: 1
      });

      const rawMailbox = await readFile(
        join(sandboxDir, '.webforge', 'mailboxes', 'pm.jsonl'),
        'utf-8'
      );
      const rawState = JSON.parse(
        await readFile(
          join(sandboxDir, '.webforge', 'mailboxes', '.state', 'pm.json'),
          'utf-8'
        )
      ) as { readMessageIds: string[] };

      expect(rawMailbox).toContain('"read":false');
      expect(rawState.readMessageIds).toHaveLength(1);
    });
  });

  describe('Broadcast', () => {
    it('应该发送消息到所有 Worker 邮箱', async () => {
      const recipients = ['pm', 'frontend', 'qa'];
      const messages = await mailbox.broadcast(
        'notification',
        '广播消息',
        recipients
      );

      expect(messages.length).toBe(3);
      expect(messages.every(m => m.from === 'backend')).toBe(true);
    });
  });
});
