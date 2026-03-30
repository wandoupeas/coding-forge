/**
 * Session state service unit tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createMockPhase, createMockTask } from '../index.js';
import {
  getLatestSession,
  loadSession,
  listSessions,
  pauseSession,
  saveSession
} from '../../core/session.js';

let sandboxDir = '';

describe('session state service', () => {
  beforeEach(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-session-'));
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-30T10:00:00.000Z'));
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (sandboxDir) {
      await rm(sandboxDir, { recursive: true, force: true });
      sandboxDir = '';
    }
  });

  it('writes a resume-friendly session record and guidance', async () => {
    const tasks = [
      createMockTask({ id: 'T001', status: 'completed' }),
      createMockTask({ id: 'T002', status: 'in_progress' })
    ];
    const phases = [
      createMockPhase({ id: 'P1', status: 'completed' }),
      createMockPhase({ id: 'P2', status: 'in_progress' })
    ];

    await saveSession('sess-001', tasks, phases, {
      name: 'runtime loop',
      currentPhaseId: 'P2',
      currentTaskId: 'T002',
      context: 'continue implementing the runtime loop',
      basePath: sandboxDir
    });

    const index = JSON.parse(
      await readFile(
        join(sandboxDir, '.webforge', 'sessions', 'index.json'),
        'utf-8'
      )
    ) as { sessions: Array<Record<string, unknown>> };

    expect(Array.isArray(index.sessions)).toBe(true);
    expect(index.sessions).toHaveLength(1);
    expect(index.sessions[0]).toMatchObject({
      id: 'sess-001',
      name: 'runtime loop',
      status: 'active',
      created_at: '2026-03-30T10:00:00.000Z',
      last_active: '2026-03-30T10:00:00.000Z',
      currentPhase: 'P2',
      currentTask: 'T002',
      currentPhaseId: 'P2',
      currentTaskId: 'T002',
      contextSummary: 'continue implementing the runtime loop',
      context_summary: 'continue implementing the runtime loop',
      stats: {
        tasksCompleted: 1,
        totalTasks: 2
      }
    });

    const sessions = await listSessions(sandboxDir);
    expect(sessions[0]).toMatchObject({
      id: 'sess-001',
      currentPhaseId: 'P2',
      currentTaskId: 'T002'
    });

    const loaded = (await loadSession('sess-001', sandboxDir)) as any;
    expect(loaded.session.id).toBe('sess-001');
    expect(loaded.resumeGuidance).toContain('T002');
    expect(loaded.resumeGuidance).toContain('P2');
    expect(loaded.resumeGuidance).toContain('continue implementing the runtime loop');
  });

  it('returns the newest session even when it is paused', async () => {
    await saveSession(
      'sess-old',
      [createMockTask({ id: 'T001', status: 'completed' })],
      [createMockPhase({ id: 'P1', status: 'completed' })],
      {
        name: 'older active',
        currentPhaseId: 'P1',
        currentTaskId: 'T001',
        basePath: sandboxDir
      }
    );

    vi.setSystemTime(new Date('2026-03-30T11:00:00.000Z'));

    await saveSession(
      'sess-new',
      [createMockTask({ id: 'T002', status: 'in_progress' })],
      [createMockPhase({ id: 'P2', status: 'in_progress' })],
      {
        name: 'newer paused',
        currentPhaseId: 'P2',
        currentTaskId: 'T002',
        basePath: sandboxDir
      }
    );

    const sessionPath = join(sandboxDir, '.webforge', 'sessions', 'sess-new.json');
    const sessionFile = JSON.parse(await readFile(sessionPath, 'utf-8')) as {
      session: Record<string, unknown>;
      tasksSnapshot: unknown[];
      phasesSnapshot: unknown[];
    };
    sessionFile.session.status = 'paused';
    await writeFile(sessionPath, JSON.stringify(sessionFile, null, 2), 'utf-8');

    const indexPath = join(sandboxDir, '.webforge', 'sessions', 'index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf-8')) as {
      sessions: Array<Record<string, unknown>>;
    };
    index.sessions[1].status = 'paused';
    index.sessions[1].last_active = '2026-03-30T11:00:00.000Z';
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    const latest = await getLatestSession(sandboxDir);

    expect(latest?.id).toBe('sess-new');
    expect(latest?.status).toBe('paused');
  });

  it('keeps session status changes when pausing', async () => {
    await saveSession(
      'sess-003',
      [createMockTask({ id: 'T003', status: 'in_progress' })],
      [createMockPhase({ id: 'P3', status: 'in_progress' })],
      {
        name: 'pausable session',
        currentPhaseId: 'P3',
        currentTaskId: 'T003',
        basePath: sandboxDir
      }
    );

    await pauseSession('sess-003', sandboxDir);

    const loaded = (await loadSession('sess-003', sandboxDir)) as any;
    expect(loaded.session.status).toBe('paused');

    const index = JSON.parse(
      await readFile(
        join(sandboxDir, '.webforge', 'sessions', 'index.json'),
        'utf-8'
      )
    ) as { sessions: Array<Record<string, unknown>> };
    expect(index.sessions[0].status).toBe('paused');
  });

  it('preserves paused status across later session saves', async () => {
    const tasks = [createMockTask({ id: 'T004', status: 'in_progress' })];
    const phases = [createMockPhase({ id: 'P4', status: 'in_progress' })];

    await saveSession('sess-004', tasks, phases, {
      name: 'sticky pause',
      currentPhaseId: 'P4',
      currentTaskId: 'T004',
      basePath: sandboxDir
    });
    await pauseSession('sess-004', sandboxDir);
    await saveSession('sess-004', tasks, phases, {
      context: 'resume later',
      basePath: sandboxDir
    });

    const loaded = await loadSession('sess-004', sandboxDir);
    expect(loaded?.session.status).toBe('paused');
    expect(loaded?.session.contextSummary).toBe('resume later');
  });

  it('normalizes legacy snake_case snapshot fields when loading a session', async () => {
    const sessionPath = join(sandboxDir, '.webforge', 'sessions', 'legacy-001.json');
    await mkdir(join(sandboxDir, '.webforge', 'sessions'), { recursive: true });
    await writeFile(
      sessionPath,
      JSON.stringify(
        {
          session: {
            id: 'legacy-001',
            name: 'legacy snapshot',
            created_at: '2026-03-29T10:00:00.000Z',
            last_active: '2026-03-29T11:00:00.000Z',
            status: 'paused',
            currentPhase: 'P9',
            currentTask: 'T9',
            context_summary: 'legacy context',
            next_action: 'legacy next step'
          },
          tasksSnapshot: [],
          phasesSnapshot: [],
          resumeGuidance: ''
        },
        null,
        2
      ),
      'utf-8'
    );

    const loaded = await loadSession('legacy-001', sandboxDir);
    expect(loaded?.session).toMatchObject({
      id: 'legacy-001',
      name: 'legacy snapshot',
      createdAt: '2026-03-29T10:00:00.000Z',
      status: 'paused',
      currentPhaseId: 'P9',
      currentTaskId: 'T9',
      contextSummary: 'legacy context',
      nextAction: 'legacy next step'
    });
  });

  it('reads legacy bare-array session indexes through the session service', async () => {
    const sessionsDir = join(sandboxDir, '.webforge', 'sessions');
    await mkdir(sessionsDir, { recursive: true });
    await writeFile(
      join(sessionsDir, 'index.json'),
      JSON.stringify(
        [
          {
            id: 'legacy-old',
            name: 'old',
            created_at: '2026-03-29T09:00:00.000Z',
            last_active: '2026-03-29T09:30:00.000Z',
            status: 'paused',
            stats: {
              tasksCompleted: 1,
              totalTasks: 2
            }
          },
          {
            id: 'legacy-new',
            name: 'new',
            created_at: '2026-03-29T10:00:00.000Z',
            last_active: '2026-03-29T10:30:00.000Z',
            status: 'active',
            stats: {
              tasksCompleted: 2,
              totalTasks: 3
            }
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    const latest = await getLatestSession(sandboxDir);
    expect(latest?.id).toBe('legacy-new');
    expect(latest?.lastActive).toBe('2026-03-29T10:30:00.000Z');
  });

  it('keeps every session discoverable when multiple sessions save concurrently', async () => {
    vi.useRealTimers();

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        saveSession(
          `sess-parallel-${index}`,
          [createMockTask({ id: `T${index}`, status: 'in_progress' })],
          [createMockPhase({ id: `P${index}`, status: 'in_progress' })],
          {
            name: `parallel-${index}`,
            currentPhaseId: `P${index}`,
            currentTaskId: `T${index}`,
            basePath: sandboxDir
          }
        )
      )
    );

    const sessions = await listSessions(sandboxDir);
    expect(sessions).toHaveLength(8);
    expect(
      new Set(sessions.map(session => session.id)).size
    ).toBe(8);
  }, 10000);
});
