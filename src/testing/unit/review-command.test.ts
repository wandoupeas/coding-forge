import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace, loadWorkspaceState } from '../../core/workspace.js';
import { createReviewCommand, reviewCommand } from '../../cli/commands/review.js';
import { Mailbox } from '../../core/mailbox.js';

describe('review command', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-review-'));
    await createWorkspace(workspaceDir, { projectName: 'review-command' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('approves a deliverable by deliverable id', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeDeliverables(workspace.paths.deliverablesIndex, [
      buildDeliverable('del-001', 'T001', 'pending_review')
    ]);

    await reviewCommand('del-001', { approve: true, comment: 'looks good' }, workspaceDir);

    const items = await readDeliverables(workspace.paths.deliverablesIndex);
    expect(items[0]).toMatchObject({
      id: 'del-001',
      status: 'approved',
      reviewComment: 'looks good'
    });

    const backendMailbox = new Mailbox('backend', workspaceDir);
    await backendMailbox.init();
    const messages = await backendMailbox.receive({ unreadOnly: true });
    expect(messages[0]).toMatchObject({
      from: 'reviewer',
      to: 'backend',
      type: 'approval_result',
      task_id: 'T001'
    });
    expect(messages[0]?.content).toContain('已通过审核');
    expect(messages[0]?.metadata).toMatchObject({
      deliverableId: 'del-001',
      taskId: 'T001',
      approved: true,
      comment: 'looks good'
    });
  });

  it('rejects only pending deliverables when the target is a task id', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeDeliverables(workspace.paths.deliverablesIndex, [
      buildDeliverable('del-001', 'T001', 'pending_review'),
      buildDeliverable('del-002', 'T001', 'approved'),
      buildDeliverable('del-003', 'T002', 'pending_review')
    ]);

    await reviewCommand('T001', { reject: true, comment: 'needs changes' }, workspaceDir);

    const items = await readDeliverables(workspace.paths.deliverablesIndex);
    expect(items.find((item) => item.id === 'del-001')).toMatchObject({
      status: 'rejected',
      reviewComment: 'needs changes'
    });
    expect(items.find((item) => item.id === 'del-002')).toMatchObject({
      status: 'approved'
    });
    expect(items.find((item) => item.id === 'del-003')).toMatchObject({
      status: 'pending_review'
    });

    const backendMailbox = new Mailbox('backend', workspaceDir);
    await backendMailbox.init();
    const messages = await backendMailbox.receive({ unreadOnly: true, limit: 10 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      type: 'approval_result',
      task_id: 'T001'
    });
    expect(messages[0]?.metadata).toMatchObject({
      deliverableId: 'del-001',
      approved: false
    });
  });

  it('can include all task deliverables when --all is enabled', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeDeliverables(workspace.paths.deliverablesIndex, [
      buildDeliverable('del-001', 'T001', 'pending_review'),
      buildDeliverable('del-002', 'T001', 'approved')
    ]);

    await reviewCommand('T001', { approve: true, all: true }, workspaceDir);

    const items = await readDeliverables(workspace.paths.deliverablesIndex);
    expect(items.filter((item) => item.status === 'approved')).toHaveLength(2);

    const backendMailbox = new Mailbox('backend', workspaceDir);
    await backendMailbox.init();
    const messages = await backendMailbox.receive({ unreadOnly: true, limit: 10 });
    expect(messages).toHaveLength(2);
  });

  it('reports empty targets and rejects conflicting flags', async () => {
    await reviewCommand('T404', { approve: true }, workspaceDir);
    expect(readConsoleOutput()).toContain('当前没有可审核的交付物');

    await expect(
      reviewCommand('T001', { approve: true, reject: true }, workspaceDir)
    ).rejects.toThrow(/不能同时指定 --approve 和 --reject/);
  });

  it('parses the CLI command and updates the workspace', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeDeliverables(workspace.paths.deliverablesIndex, [
      buildDeliverable('del-001', 'T009', 'pending_review')
    ]);

    await createReviewCommand(workspaceDir).parseAsync([
      'node',
      'review',
      'T009',
      '--approve',
      '--comment',
      'ship it'
    ]);

    const items = await readDeliverables(workspace.paths.deliverablesIndex);
    expect(items[0]).toMatchObject({
      status: 'approved',
      reviewComment: 'ship it'
    });
  });
});

async function writeDeliverables(path: string, items: object[]): Promise<void> {
  await writeFile(path, JSON.stringify({ items }, null, 2), 'utf-8');
}

async function readDeliverables(path: string): Promise<Array<Record<string, unknown>>> {
  const payload = JSON.parse(await readFile(path, 'utf-8')) as { items: Array<Record<string, unknown>> };
  return payload.items;
}

function buildDeliverable(
  id: string,
  taskId: string,
  status: 'pending_review' | 'approved' | 'rejected'
): Record<string, unknown> {
  return {
    id,
    taskId,
    type: 'document',
    title: `${id}-title`,
    path: `.webforge/deliverables/${id}.md`,
    createdBy: 'backend',
    createdAt: '2026-03-30T00:00:00.000Z',
    status
  };
}

function readConsoleOutput(): string {
  return vi
    .mocked(console.log)
    .mock.calls
    .flat()
    .map((value) => String(value))
    .join('\n');
}
