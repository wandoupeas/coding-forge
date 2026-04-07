import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace } from '../../core/workspace.js';
import { createRecordCommand } from '../../cli/commands/record.js';

describe('record command', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-record-command-'));
    await createWorkspace(workspaceDir, { projectName: 'record-command' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceDir);
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('updates wrapped sessions indexes when recording a completed task', async () => {
    await writeTasks(join(workspaceDir, '.webforge', 'tasks.json'));
    await writeRuntime(join(workspaceDir, '.webforge', 'runtime.json'));
    await writeSessionsIndex(join(workspaceDir, '.webforge', 'sessions', 'index.json'));

    await createRecordCommand().parseAsync([
      'node',
      'record',
      'task',
      'T100',
      '--summary',
      'recorded through regression test',
      '--deliverable',
      'docs/output.md'
    ]);

    const sessionsIndex = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'sessions', 'index.json'), 'utf-8')
    ) as { sessions: Array<Record<string, unknown>> };
    const deliverablesIndex = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'deliverables', 'index.json'), 'utf-8')
    ) as { items: Array<Record<string, unknown>> };

    expect(sessionsIndex.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sess-existing',
          currentTask: 'T100',
          currentPhase: 'P3',
          status: 'active'
        })
      ])
    );
    expect(deliverablesIndex.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 'T100',
          title: 'output.md',
          path: 'docs/output.md',
          status: 'completed'
        })
      ])
    );
  });
});

async function writeTasks(path: string): Promise<void> {
  await writeFile(
    path,
    JSON.stringify(
      {
        tasks: [
          {
            id: 'T100',
            phase: 'P3',
            title: 'record regression',
            description: 'before record command',
            status: 'in_progress',
            assignee: 'agent',
            depends_on: [],
            priority: 1,
            created_at: '2026-04-07T00:00:00.000Z',
            updated_at: '2026-04-07T00:00:00.000Z'
          }
        ]
      },
      null,
      2
    ),
    'utf-8'
  );
}

async function writeRuntime(path: string): Promise<void> {
  await writeFile(
    path,
    JSON.stringify(
      {
        version: '0.2',
        status: 'idle',
        updatedAt: '2026-04-07T00:00:00.000Z',
        sessionId: 'sess-existing',
        phaseId: 'P3',
        taskId: 'T100',
        summary: 'before record',
        workflowContext: null
      },
      null,
      2
    ),
    'utf-8'
  );
}

async function writeSessionsIndex(path: string): Promise<void> {
  await writeFile(
    path,
    JSON.stringify(
      {
        sessions: [
          {
            id: 'sess-existing',
            name: 'Existing Session',
            createdAt: '2026-04-07T00:00:00.000Z',
            created_at: '2026-04-07T00:00:00.000Z',
            lastActive: '2026-04-07T00:00:00.000Z',
            last_active: '2026-04-07T00:00:00.000Z',
            status: 'paused',
            currentPhaseId: 'P1',
            currentPhase: 'P1',
            currentTaskId: 'T001',
            currentTask: 'T001',
            stats: {
              tasksCompleted: 1,
              totalTasks: 2
            }
          }
        ]
      },
      null,
      2
    ),
    'utf-8'
  );
}
