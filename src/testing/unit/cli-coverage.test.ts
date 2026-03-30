import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace, loadWorkspaceState } from '../../core/workspace.js';
import {
  buildResumeSummary,
  resumeCommand
} from '../../cli/commands/resume.js';
import {
  createDeliverablesCommand,
  createRunCommand,
  runCommand
} from '../../cli/commands/run.js';

describe('cli coverage branches', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-cli-coverage-'));
    await createWorkspace(workspaceDir, { projectName: 'cli-coverage' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('resumes from workspace state when no session exists and suggests the next ready task', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeTasks(workspace.paths.tasks, [
      createTask('T001', '实现接口', 'ready', 2),
      createTask('T002', '补充测试', 'ready', 1)
    ]);

    const summary = await buildResumeSummary(workspaceDir);
    expect(summary.sessionId).toBeNull();
    expect(summary.guidance).toBeNull();
    expect(summary.nextAction).toContain('运行 T002: 补充测试');
    expect(summary.runtimeLog).toMatchObject({
      sessionId: null,
      command: null
    });

    await resumeCommand(workspaceDir);
    const output = readConsoleOutput();
    expect(output).toContain('没有找到历史会话');
    expect(output).toContain('ready tasks: 2');
  });

  it('prefers indexed nextAction when the latest session snapshot is missing', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeFile(
      workspace.paths.sessionsIndex,
      JSON.stringify(
        {
          sessions: [
            {
              id: 'sess-index-only',
              name: 'indexed session',
              createdAt: '2026-03-30T00:00:00.000Z',
              lastActive: '2026-03-30T01:00:00.000Z',
              status: 'active',
              nextAction: 'follow indexed guidance',
              stats: {
                tasksCompleted: 0,
                totalTasks: 0
              }
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    const summary = await buildResumeSummary(workspaceDir);
    expect(summary.sessionId).toBe('sess-index-only');
    expect(summary.guidance).toBe('follow indexed guidance');
    expect(summary.nextAction).toBe('follow indexed guidance');
  });

  it('falls back to active runtime task or no-ready guidance when session guidance is absent', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);

    await writeFile(
      workspace.paths.runtime,
      JSON.stringify(
        {
          ...workspace.runtime,
          status: 'active',
          taskId: 'T900',
          summary: 'runtime active'
        },
        null,
        2
      ),
      'utf-8'
    );

    const activeSummary = await buildResumeSummary(workspaceDir);
    expect(activeSummary.nextAction).toContain('检查运行时记录并继续处理 T900');

    await writeFile(
      workspace.paths.runtime,
      JSON.stringify(
        {
          ...workspace.runtime,
          status: 'idle',
          taskId: null,
          summary: 'runtime idle'
        },
        null,
        2
      ),
      'utf-8'
    );

    const idleSummary = await buildResumeSummary(workspaceDir);
    expect(idleSummary.nextAction).toContain('当前没有 ready task');
  });

  it('reports blocked thread linkage when workflow context references a missing thread object', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeTasks(workspace.paths.tasks, [createTask('T401', 'threaded task', 'ready', 1)]);
    await writeFile(
      workspace.paths.runtime,
      JSON.stringify(
        {
          ...workspace.runtime,
          workflowContext: {
            workflow: 'gsd-thread',
            threadId: 'thread-missing'
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    const summary = await buildResumeSummary(workspaceDir);

    expect(summary.threadLinkage).toMatchObject({
      status: 'blocked',
      threadId: 'thread-missing',
      missingThreadId: 'thread-missing'
    });
  });

  it('prefers pending review and blocked-task guidance when there is no session or ready work', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);

    await writeFile(
      workspace.paths.deliverablesIndex,
      JSON.stringify(
        {
          items: [
            {
              id: 'del-101',
              taskId: 'T101',
              type: 'document',
              title: 'Needs review',
              path: '.webforge/deliverables/del-101.md',
              createdBy: 'pm',
              createdAt: '2026-03-30T00:00:00.000Z',
              status: 'pending_review'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    const reviewSummary = await buildResumeSummary(workspaceDir);
    expect(reviewSummary.nextAction).toContain('待审核交付物 del-101');
    expect(reviewSummary.shouldRead).toContain('.webforge/deliverables/index.json');

    await writeFile(
      workspace.paths.deliverablesIndex,
      JSON.stringify({ items: [] }, null, 2),
      'utf-8'
    );
    await writeTasks(workspace.paths.tasks, [createTask('T301', 'blocked task', 'blocked', 1)]);

    const blockedSummary = await buildResumeSummary(workspaceDir);
    expect(blockedSummary.nextAction).toContain('先排查阻塞任务 T301');
  });

  it('renders dry-run warnings and limits the previewed ready queue', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeTasks(workspace.paths.tasks, [
      createTask('T001', '第一个任务', 'ready', 1),
      createTask('T002', '第二个任务', 'ready', 2)
    ]);

    await runCommand(
      {
        dryRun: true,
        limit: 1,
        auto: true,
        phase: 'P1',
        worker: 'backend',
        execution: 'inline',
        superpowers: false
      },
      workspaceDir
    );

    const output = readConsoleOutput();
    expect(output).toContain('`--auto` 已成为默认行为');
    expect(output).toContain('`--phase P1`');
    expect(output).toContain('`--worker backend`');
    expect(output).toContain('`--execution inline`');
    expect(output).toContain('`--no-superpowers`');
    expect(output).toContain('T001: 第一个任务');
    expect(output).not.toContain('T002: 第二个任务');
  });

  it('renders dry-run empty-state and covers commander limit parsing branches', async () => {
    const validCommand = createRunCommand();
    await validCommand.parseAsync(['node', 'run', '--limit', '1', '--dry-run']);

    expect(readConsoleOutput()).toContain('当前没有 ready task。');

    const invalidCommand = createRunCommand().exitOverride();
    await expect(
      invalidCommand.parseAsync(['node', 'run', '--limit', '0', '--dry-run'])
    ).rejects.toThrow(/Expected a positive integer/);
  });

  it('renders grouped deliverable listings and task-scoped review output', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeFile(
      workspace.paths.deliverablesIndex,
      JSON.stringify(
        {
          items: [
            {
              id: 'del-001',
              taskId: 'T001',
              type: 'document',
              title: 'Pending Spec',
              path: '.webforge/deliverables/del-001.md',
              createdBy: 'pm',
              createdAt: '2026-03-30T00:00:00.000Z',
              status: 'pending_review'
            },
            {
              id: 'del-002',
              taskId: 'T002',
              type: 'document',
              title: 'Approved Spec',
              path: '.webforge/deliverables/del-002.md',
              createdBy: 'backend',
              createdAt: '2026-03-30T00:00:00.000Z',
              status: 'approved'
            },
            {
              id: 'del-003',
              taskId: 'T003',
              type: 'document',
              title: 'Rejected Spec',
              path: '.webforge/deliverables/del-003.md',
              createdBy: 'qa',
              createdAt: '2026-03-30T00:00:00.000Z',
              status: 'rejected'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    await createDeliverablesCommand(workspaceDir).parseAsync(['node', 'deliverables']);
    const groupedOutput = readConsoleOutput();
    expect(groupedOutput).toContain('待审核');
    expect(groupedOutput).toContain('已通过');
    expect(groupedOutput).toContain('已拒绝');

    vi.mocked(console.log).mockClear();
    await createDeliverablesCommand(workspaceDir).parseAsync(['node', 'deliverables', 'T001']);
    const reviewOutput = readConsoleOutput();
    expect(reviewOutput).toContain('Pending Spec');
    expect(reviewOutput).toContain('pending_review');
  });
});

async function writeTasks(path: string, tasks: Array<Record<string, unknown>>): Promise<void> {
  await writeFile(path, JSON.stringify({ tasks }, null, 2), 'utf-8');
}

function createTask(
  id: string,
  title: string,
  status: string,
  priority: number
): Record<string, unknown> {
  return {
    id,
    phase: 'P1',
    title,
    status,
    assignee: 'backend',
    depends_on: [],
    priority,
    created_at: '2026-03-30T00:00:00.000Z',
    updated_at: '2026-03-30T00:00:00.000Z'
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
