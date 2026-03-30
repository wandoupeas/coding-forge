import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  autoCheckpoint,
  createCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  loadCheckpoint,
  rollbackToCheckpoint
} from '../../core/checkpoint.js';
import { createDeliverable } from '../../core/deliverable.js';
import { createMockPhase, createMockTask } from '../index.js';

describe('checkpoint service', () => {
  let sandboxDir = '';

  beforeEach(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-checkpoint-'));
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-30T12:00:00.000Z'));
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (sandboxDir) {
      await rm(sandboxDir, { recursive: true, force: true });
      sandboxDir = '';
    }
  });

  it('creates, lists, loads, and deletes checkpoints', async () => {
    const tasks = [createMockTask({ id: 'T001', status: 'completed' })];
    const phases = [createMockPhase({ id: 'P1', status: 'completed' })];

    const created = await createCheckpoint('initial', tasks, phases, {
      description: 'manual checkpoint',
      gitCommit: 'abc123',
      basePath: sandboxDir
    });

    expect(created).toMatchObject({
      name: 'initial',
      description: 'manual checkpoint',
      gitCommit: 'abc123'
    });
    expect(created.deliverables).toEqual([]);
    expect(created.tasks).not.toBe(tasks);
    expect(created.phases).not.toBe(phases);

    const loaded = await loadCheckpoint(created.id, sandboxDir);
    expect(loaded?.name).toBe('initial');

    const listed = await listCheckpoints(sandboxDir);
    expect(listed.map((item) => item.id)).toEqual([created.id]);

    expect(await deleteCheckpoint(created.id, sandboxDir)).toBe(true);
    expect(await deleteCheckpoint(created.id, sandboxDir)).toBe(false);
    expect(await loadCheckpoint(created.id, sandboxDir)).toBeNull();
  });

  it('sorts checkpoints newest first and ignores broken files', async () => {
    await createCheckpoint('older', [], [], { basePath: sandboxDir });
    vi.setSystemTime(new Date('2026-03-30T12:05:00.000Z'));
    const newer = await createCheckpoint('newer', [], [], { basePath: sandboxDir });

    await writeFile(
      join(sandboxDir, '.webforge', 'checkpoints', 'broken.json'),
      '{broken',
      'utf-8'
    );

    const checkpoints = await listCheckpoints(sandboxDir);

    expect(checkpoints[0]?.id).toBe(newer.id);
    expect(checkpoints).toHaveLength(2);
  });

  it('generates unique checkpoint ids even when the clock is frozen', async () => {
    const first = await createCheckpoint('first', [], [], { basePath: sandboxDir });
    const second = await createCheckpoint('second', [], [], { basePath: sandboxDir });

    expect(first.id).not.toBe(second.id);
  });

  it('creates rollback checkpoints before restoring a snapshot', async () => {
    const original = await createCheckpoint(
      'release-ready',
      [createMockTask({ id: 'T010', status: 'completed' })],
      [createMockPhase({ id: 'P9', status: 'completed', name: 'Release' })],
      { basePath: sandboxDir }
    );

    vi.setSystemTime(new Date('2026-03-30T12:01:00.000Z'));
    const restored = await rollbackToCheckpoint(original.id, sandboxDir);

    expect(restored).toMatchObject({
      tasks: [{ id: 'T010' }],
      phases: [{ id: 'P9' }]
    });

    const persistedTasks = JSON.parse(
      await readFile(join(sandboxDir, '.webforge', 'tasks.json'), 'utf-8')
    ) as { tasks: Array<Record<string, unknown>> };
    const persistedPhases = JSON.parse(
      await readFile(join(sandboxDir, '.webforge', 'phases.json'), 'utf-8')
    ) as { phases: Array<Record<string, unknown>> };
    expect(persistedTasks.tasks[0]?.id).toBe('T010');
    expect(persistedPhases.phases[0]?.id).toBe('P9');

    const checkpoints = await listCheckpoints(sandboxDir);
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints.some((item) => item.name.startsWith('Rollback from'))).toBe(true);
    expect(await rollbackToCheckpoint('missing', sandboxDir)).toBeNull();
  });

  it('snapshots deliverable files into the checkpoint directory', async () => {
    const deliverable = await createDeliverable(
      'T050',
      'document',
      'Checkpoint Spec',
      '# checkpoint snapshot',
      'backend',
      sandboxDir
    );

    const checkpoint = await createCheckpoint('snapshot deliverables', [], [], {
      basePath: sandboxDir
    });

    expect(checkpoint.deliverables).toHaveLength(1);
    expect(checkpoint.deliverables[0]?.snapshotPath).toContain(
      `.webforge/checkpoints/${checkpoint.id}/deliverables/`
    );
    await expect(
      readFile(join(sandboxDir, checkpoint.deliverables[0]!.snapshotPath), 'utf-8')
    ).resolves.toBe('# checkpoint snapshot');
    expect(checkpoint.deliverables[0]).toMatchObject({
      id: deliverable.id,
      path: deliverable.path
    });
  });

  it('falls back to indexed content when the original deliverable file is missing', async () => {
    const deliverable = await createDeliverable(
      'T051',
      'document',
      'Missing Source',
      '# indexed snapshot fallback',
      'backend',
      sandboxDir
    );

    await rm(join(sandboxDir, deliverable.path), { force: true });

    const checkpoint = await createCheckpoint('snapshot fallback', [], [], {
      basePath: sandboxDir
    });

    expect(checkpoint.deliverables).toHaveLength(1);
    await expect(
      readFile(join(sandboxDir, checkpoint.deliverables[0]!.snapshotPath), 'utf-8')
    ).resolves.toBe('# indexed snapshot fallback');
  });

  it('can restore deliverable files and index from a checkpoint snapshot', async () => {
    const deliverable = await createDeliverable(
      'T052',
      'document',
      'Rollback Snapshot',
      '# original rollback snapshot',
      'backend',
      sandboxDir
    );

    const checkpoint = await createCheckpoint('restore deliverables', [], [], {
      basePath: sandboxDir
    });

    await writeFile(join(sandboxDir, deliverable.path), '# mutated content', 'utf-8');
    await writeFile(
      join(sandboxDir, '.webforge', 'deliverables', 'index.json'),
      JSON.stringify(
        {
          items: [
            {
              ...deliverable,
              title: 'Mutated Title',
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

    const restored = await rollbackToCheckpoint(checkpoint.id, sandboxDir, {
      restoreDeliverables: true
    });

    expect(restored?.deliverables).toHaveLength(1);
    await expect(readFile(join(sandboxDir, deliverable.path), 'utf-8')).resolves.toBe(
      '# original rollback snapshot'
    );

    const deliverablesIndex = JSON.parse(
      await readFile(join(sandboxDir, '.webforge', 'deliverables', 'index.json'), 'utf-8')
    ) as { items: Array<Record<string, unknown>> };
    expect(deliverablesIndex.items[0]).toMatchObject({
      id: deliverable.id,
      title: 'Rollback Snapshot',
      status: 'pending_review'
    });
  });

  it('creates auto checkpoints at configured milestones only', async () => {
    const tasks = [
      createMockTask({ id: 'T001', status: 'completed' }),
      createMockTask({ id: 'T002', status: 'pending' }),
      createMockTask({ id: 'T003', status: 'pending' }),
      createMockTask({ id: 'T004', status: 'pending' })
    ];
    const phases = [createMockPhase({ id: 'P1', status: 'in_progress', name: 'Core' })];

    await autoCheckpoint(tasks, phases, sandboxDir);
    let checkpoints = await listCheckpoints(sandboxDir);
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0]?.name).toContain('25%');

    vi.setSystemTime(new Date('2026-03-30T12:02:00.000Z'));
    await autoCheckpoint(
      [
        createMockTask({ id: 'T001', status: 'completed' }),
        createMockTask({ id: 'T002', status: 'completed' }),
        createMockTask({ id: 'T003', status: 'pending' }),
        createMockTask({ id: 'T004', status: 'pending' })
      ],
      phases,
      sandboxDir
    );

    checkpoints = await listCheckpoints(sandboxDir);
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints.some((item) => item.name.includes('50%'))).toBe(true);
  });
});
