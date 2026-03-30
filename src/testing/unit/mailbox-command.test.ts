import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace } from '../../core/workspace.js';
import { Mailbox } from '../../core/mailbox.js';
import {
  clearMailbox,
  listMailboxes,
  readMailbox
} from '../../cli/commands/mailbox.js';

describe('mailbox command branches', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-mailbox-command-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('lists empty mailbox roots gracefully', async () => {
    await listMailboxes(workspaceDir);
    expect(readConsoleOutput()).toContain('当前没有发现任何 mailbox。');
  });

  it('discovers workers from config and mailbox files, including zero-unread workers', async () => {
    await createWorkspace(workspaceDir, { projectName: 'mailbox-cli' });

    const sender = new Mailbox('backend', workspaceDir);
    await sender.init();
    await sender.send('pm', 'notification', 'hello pm');

    await listMailboxes(workspaceDir);
    const output = readConsoleOutput();
    expect(output).toContain('pm');
    expect(output).toContain('frontend');
    expect(output).toContain('(1 未读)');
    expect(output).toContain('(0 未读)');
  });

  it('renders different empty states for unread-only and all-message views', async () => {
    await createWorkspace(workspaceDir, { projectName: 'mailbox-empty' });

    await readMailbox('qa', {}, workspaceDir);
    expect(readConsoleOutput()).toContain('没有未读消息');

    vi.mocked(console.log).mockClear();
    await readMailbox('qa', { all: true }, workspaceDir);
    expect(readConsoleOutput()).toContain('邮箱为空');
  });

  it('clears a mailbox and reports success', async () => {
    await createWorkspace(workspaceDir, { projectName: 'mailbox-clear' });

    const sender = new Mailbox('pm', workspaceDir);
    await sender.init();
    await sender.send('backend', 'notification', 'to be cleared');

    await clearMailbox('backend', workspaceDir);
    expect(readConsoleOutput()).toContain('已清空 backend 的邮箱');

    vi.mocked(console.log).mockClear();
    await readMailbox('backend', { all: true }, workspaceDir);
    expect(readConsoleOutput()).toContain('邮箱为空');
  });
});

function readConsoleOutput(): string {
  return vi
    .mocked(console.log)
    .mock.calls
    .flat()
    .map((value) => String(value))
    .join('\n');
}
