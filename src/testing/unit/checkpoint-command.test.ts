import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createCheckpoint, listCheckpoints } from '../../core/checkpoint.js';
import { createDeliverable } from '../../core/deliverable.js';
import {
  listCheckpointsCommand,
  rollbackCommand
} from '../../cli/commands/checkpoint.js';
import { createWorkspace } from '../../core/workspace.js';
import { createMockPhase, createMockTask } from '../index.js';

describe('checkpoint command', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-checkpoint-command-'));
    await createWorkspace(workspaceDir, { projectName: 'checkpoint-command' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-30T12:00:00.000Z'));
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('lists checkpoints through the cli adapter', async () => {
    const checkpoint = await createCheckpoint(
      'manual checkpoint',
      [createMockTask({ id: 'T001', status: 'completed' })],
      [createMockPhase({ id: 'P1', status: 'completed' })],
      {
        description: 'checkpoint description',
        basePath: workspaceDir
      }
    );

    const listed = await listCheckpointsCommand(workspaceDir);

    expect(listed.map((item) => item.id)).toEqual([checkpoint.id]);
    expect(readConsoleOutput()).toContain('检查点列表');
    expect(readConsoleOutput()).toContain('manual checkpoint');
  });

  it('rolls back tasks, phases, and deliverables through the cli adapter', async () => {
    const deliverable = await createDeliverable(
      'T100',
      'document',
      'CLI Rollback Spec',
      '# cli rollback snapshot',
      'backend',
      workspaceDir
    );

    const checkpoint = await createCheckpoint(
      'release baseline',
      [createMockTask({ id: 'T100', status: 'completed' })],
      [createMockPhase({ id: 'P4', status: 'completed', name: 'Release' })],
      { basePath: workspaceDir }
    );

    await writeFile(
      join(workspaceDir, '.webforge', 'tasks.json'),
      JSON.stringify(
        {
          tasks: [createMockTask({ id: 'T999', title: 'mutated task', status: 'ready' })]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'phases.json'),
      JSON.stringify(
        {
          phases: [createMockPhase({ id: 'P9', name: 'Mutated', status: 'in_progress' })]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(join(workspaceDir, deliverable.path), '# mutated content', 'utf-8');
    await writeFile(
      join(workspaceDir, '.webforge', 'deliverables', 'index.json'),
      JSON.stringify(
        {
          items: [
            {
              ...deliverable,
              title: 'Mutated Deliverable',
              content: '# mutated content',
              status: 'approved'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    await rollbackCommand(
      checkpoint.id,
      { restoreDeliverables: true },
      workspaceDir
    );

    const persistedTasks = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'tasks.json'), 'utf-8')
    ) as { tasks: Array<Record<string, unknown>> };
    const persistedPhases = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'phases.json'), 'utf-8')
    ) as { phases: Array<Record<string, unknown>> };
    const deliverablesIndex = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'deliverables', 'index.json'), 'utf-8')
    ) as { items: Array<Record<string, unknown>> };

    expect(persistedTasks.tasks[0]?.id).toBe('T100');
    expect(persistedPhases.phases[0]?.id).toBe('P4');
    expect(deliverablesIndex.items[0]).toMatchObject({
      id: deliverable.id,
      title: 'CLI Rollback Spec',
      status: 'pending_review'
    });
    await expect(readFile(join(workspaceDir, deliverable.path), 'utf-8')).resolves.toBe(
      '# cli rollback snapshot'
    );

    const checkpoints = await listCheckpoints(workspaceDir);
    expect(checkpoints).toHaveLength(2);
    expect(readConsoleOutput()).toContain('检查点已恢复');
  });
});

function readConsoleOutput(): string {
  const spy = vi.mocked(console.log);
  return stripAnsi(
    spy.mock.calls
      .flat()
      .map((value) => String(value))
      .join('\n')
  );
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}
