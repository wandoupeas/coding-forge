import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace, loadWorkspaceState } from '../../core/workspace.js';
import { recordSuperpowersRunCommand } from '../../cli/commands/superpowers.js';
import { saveSession } from '../../core/session.js';

describe('superpowers command', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-superpowers-command-'));
    await createWorkspace(workspaceDir, { projectName: 'superpowers-command' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('records a workflow run and links it back to the related task metadata', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeFile(
      workspace.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T100',
              phase: 'P1',
              title: 'Plan implementation',
              status: 'ready',
              assignee: 'pm',
              depends_on: [],
              priority: 1,
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      workspace.paths.runtime,
      JSON.stringify(
        {
          ...workspace.runtime,
          status: 'active',
          sessionId: 'sess-100',
          phaseId: 'P1',
          taskId: 'T100',
          summary: 'planning in progress'
        },
        null,
        2
      ),
      'utf-8'
    );
    await saveSession(
      'sess-100',
      [
        {
          id: 'T100',
          phase: 'P1',
          title: 'Plan implementation',
          status: 'ready',
          assignee: 'pm',
          depends_on: [],
          priority: 1,
          created_at: '2026-03-30T00:00:00.000Z',
          updated_at: '2026-03-30T00:00:00.000Z'
        }
      ],
      [],
      {
        name: 'planning',
        currentTaskId: 'T100',
        currentPhaseId: 'P1',
        basePath: workspaceDir
      }
    );
    await mkdir(join(workspaceDir, 'docs', 'superpowers', 'plans'), { recursive: true });
    await writeFile(
      join(workspaceDir, 'docs', 'superpowers', 'plans', 'demo-plan.md'),
      '# Demo plan',
      'utf-8'
    );

    const recorded = await recordSuperpowersRunCommand(
      'writing-plans',
      {
        summary: 'Converted the approved spec into an execution plan',
        task: 'T100',
        session: 'sess-100',
        artifact: ['plan:docs/superpowers/plans/demo-plan.md'],
        owner: 'pm',
        wave: 'wave-1',
        thread: 'thread-42',
        json: true
      },
      workspaceDir
    );

    expect(recorded.workflow).toBe('writing-plans');
    expect(recorded.artifacts).toEqual([
      expect.objectContaining({
        kind: 'plan',
        path: 'docs/superpowers/plans/demo-plan.md'
      })
    ]);
    expect(recorded.metadata).toMatchObject({
      owner: 'pm',
      waveId: 'wave-1',
      threadId: 'thread-42'
    });

    const runsPayload = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'superpowers-runs.json'), 'utf-8')
    ) as {
      runs: Array<{ id: string; workflow: string; taskId?: string }>;
    };
    expect(runsPayload.runs).toHaveLength(1);
    expect(runsPayload.runs[0]).toMatchObject({
      id: recorded.id,
      workflow: 'writing-plans',
      taskId: 'T100'
    });

    const savedTasks = JSON.parse(await readFile(workspace.paths.tasks, 'utf-8')) as {
      tasks: Array<{ metadata?: Record<string, unknown>; workflowContext?: Record<string, unknown> }>;
    };
    expect(savedTasks.tasks[0]?.metadata).toMatchObject({
      superpowers_run: {
        runId: recorded.id,
        workflow: 'writing-plans'
      }
    });
    expect(savedTasks.tasks[0]?.workflowContext).toMatchObject({
      workflow: 'writing-plans',
      runId: recorded.id,
      owner: 'pm',
      waveId: 'wave-1',
      threadId: 'thread-42'
    });

    const savedRuntime = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'runtime.json'), 'utf-8')
    ) as { workflowContext?: Record<string, unknown> };
    expect(savedRuntime.workflowContext).toMatchObject({
      workflow: 'writing-plans',
      runId: recorded.id,
      owner: 'pm',
      waveId: 'wave-1',
      threadId: 'thread-42'
    });

    const sessionIndex = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'sessions', 'index.json'), 'utf-8')
    ) as { sessions: Array<{ workflowContext?: Record<string, unknown> }> };
    expect(sessionIndex.sessions[0]?.workflowContext).toMatchObject({
      workflow: 'writing-plans',
      runId: recorded.id,
      owner: 'pm',
      waveId: 'wave-1',
      threadId: 'thread-42'
    });

    const threadLinks = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'threads.json'), 'utf-8')
    ) as {
      threads: Array<{ id: string; workflow: string; runId?: string; artifacts: string[] }>;
    };
    expect(threadLinks.threads[0]).toMatchObject({
      id: 'thread-42',
      workflow: 'writing-plans',
      runId: recorded.id
    });
    expect(threadLinks.threads[0]?.artifacts).toContain('docs/superpowers/plans/demo-plan.md');
  });

  it('rejects record requests without any persisted artifacts', async () => {
    await expect(
      recordSuperpowersRunCommand(
        'writing-plans',
        {
          summary: 'missing artifact payload',
          artifact: [],
          json: true
        },
        workspaceDir
      )
    ).rejects.toThrow('至少提供一个 --artifact');
  });

  it('infers artifact kinds from plain paths and supports text output mode', async () => {
    await writeFile(
      join(workspaceDir, '.webforge', 'knowledge', 'decisions', 'compact-note.md'),
      '# compact note',
      'utf-8'
    );

    const recorded = await recordSuperpowersRunCommand(
      'strategic-compact',
      {
        summary: 'created a compact handoff',
        artifact: ['.webforge/knowledge/decisions/compact-note.md']
      },
      workspaceDir
    );

    expect(recorded.artifacts[0]).toMatchObject({
      kind: 'compact-handoff',
      path: '.webforge/knowledge/decisions/compact-note.md'
    });
    expect(readConsoleOutput()).toContain('Superpowers Workflow 已记录');
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
