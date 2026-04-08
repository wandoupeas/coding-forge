import { readFile, rm, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command } from 'commander';
import { createWorkspace } from '../../core/workspace.js';
import { writeJson } from '../../utils/file.js';
import { createTaskCommand } from '../../cli/commands/task.js';
import { createSessionCommand } from '../../cli/commands/session.js';
import { createLearnCommand } from '../../cli/commands/learn.js';
import { statusCommand } from '../../cli/commands/status.js';

describe('stateful cli commands', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-cli-stateful-'));
    await createWorkspace(workspaceDir, { projectName: 'cli-stateful' });
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceDir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('covers status and task command flows with json and text output', async () => {
    await seedTaskKnowledgeIndex(workspaceDir);

    await runCommand(
      createTaskCommand(),
      [
        'create',
        'T100',
        '--title',
        'Implement API',
        '--phase',
        'P1',
        '--description',
        'Build the backend API surface for the release',
        '--priority',
        '1',
        '--assignee',
        'backend',
        '--execution-mode',
        'manual',
        '--modules',
        'backend',
        'architecture'
      ]
    );
    await runCommand(
      createTaskCommand(),
      [
        'create',
        'T101',
        '--title',
        'Write tests',
        '--phase',
        'P1',
        '--description',
        'Backfill release verification tests',
        '--priority',
        '2',
        '--depends-on',
        'T100',
        '--knowledge',
        'ADR-001'
      ]
    );
    await runCommand(
      createTaskCommand(),
      [
        'update',
        'T100',
        '--status',
        'ready',
        '--modules',
        'testing',
        'architecture',
        '--add-knowledge',
        'Testing playbook'
      ]
    );
    await runCommand(
      createTaskCommand(),
      [
        'update',
        'T101',
        '--status',
        'completed',
        '--priority',
        '1',
        '--remove-knowledge',
        'ADR-001'
      ]
    );

    const tasksPayload = await readJsonOutput(async () => {
      await runCommand(createTaskCommand(), ['list', '--json']);
    });
    expect(tasksPayload).toHaveLength(2);
    expect(tasksPayload[0]).toMatchObject({ id: 'T100', status: 'ready' });
    expect(tasksPayload[1]).toMatchObject({ id: 'T101', status: 'completed' });

    const shownTask = await readJsonOutput(async () => {
      await runCommand(createTaskCommand(), ['show', 'T100', '--json']);
    });
    expect(shownTask).toMatchObject({
      id: 'T100',
      status: 'ready',
      modules: ['testing', 'architecture']
    });
    expect(shownTask.knowledgeRefs).toEqual(
      expect.arrayContaining([
        '.webforge/knowledge/design/testing-playbook.md',
        '.webforge/knowledge/decisions/ADR-001-clean-architecture.md'
      ])
    );

    await runCommand(createTaskCommand(), ['list', '--ready']);
    await runCommand(createTaskCommand(), ['show', 'T101']);

    await writeJson(join(workspaceDir, '.webforge', 'runtime.json'), {
      version: '0.2',
      status: 'active',
      updatedAt: '2026-04-08T00:00:00.000Z',
      sessionId: 'sess-100',
      phaseId: 'P1',
      taskId: 'T100',
      summary: 'Release prep in progress',
      workflowContext: null
    });

    const statusPayload = await readJsonOutput(async () => {
      await statusCommand({ json: true });
    });
    expect(statusPayload).toMatchObject({
      runtime: {
        status: 'active',
        sessionId: 'sess-100',
        taskId: 'T100'
      },
      tasks: {
        total: 2,
        ready: 1,
        completed: 1
      },
      phases: {
        current: expect.any(String)
      }
    });

    vi.mocked(console.log).mockClear();
    await statusCommand();
    expect(flatConsoleOutput()).toContain('WebForge 状态');
    expect(flatConsoleOutput()).toContain('Release prep in progress');
  });

  it('covers session command lifecycle operations', async () => {
    await seedTaskKnowledgeIndex(workspaceDir);
    await writeJson(join(workspaceDir, '.webforge', 'tasks.json'), {
      tasks: [
        {
          id: 'T200',
          phase: 'P1',
          title: 'Coordinate release',
          status: 'ready',
          assignee: 'pm',
          depends_on: [],
          priority: 1,
          created_at: '2026-04-08T00:00:00.000Z',
          updated_at: '2026-04-08T00:00:00.000Z'
        }
      ]
    });

    const created = await readJsonOutput(async () => {
      await runCommand(createSessionCommand(), [
        'create',
        'sess-200',
        '--name',
        'release-handoff',
        '--phase',
        'P1',
        '--task',
        'T200',
        '--context',
        'Prepare the release handoff',
        '--json'
      ]);
    });
    expect(created).toMatchObject({
      success: true,
      session: {
        id: 'sess-200',
        currentTaskId: 'T200'
      }
    });

    await runCommand(createSessionCommand(), ['list']);

    const listed = await readJsonOutput(async () => {
      await runCommand(createSessionCommand(), ['list', '--json', '--limit', '2']);
    });
    expect(listed.total).toBeGreaterThanOrEqual(2);
    expect(listed.sessions.map((session: { id: string }) => session.id)).toContain('sess-200');

    const current = await readJsonOutput(async () => {
      await runCommand(createSessionCommand(), ['current', '--json']);
    });
    expect(current.session).toMatchObject({
      id: 'sess-200',
      name: 'release-handoff'
    });

    await runCommand(createSessionCommand(), ['current']);

    const updatedContext = await readJsonOutput(async () => {
      await runCommand(createSessionCommand(), [
        'context',
        'sess-200',
        '--thread-id',
        'thread-200',
        '--wave-id',
        'wave-3',
        '--owner',
        'pm',
        '--json'
      ]);
    });
    expect(updatedContext.workflowContext).toMatchObject({
      threadId: 'thread-200',
      waveId: 'wave-3',
      owner: 'pm'
    });

    const paused = await readJsonOutput(async () => {
      await runCommand(createSessionCommand(), ['pause', 'sess-200', '--json']);
    });
    expect(paused).toMatchObject({
      success: true,
      sessionId: 'sess-200',
      status: 'paused'
    });

    const completed = await readJsonOutput(async () => {
      await runCommand(createSessionCommand(), ['complete', 'sess-200', '--json']);
    });
    expect(completed).toMatchObject({
      success: true,
      sessionId: 'sess-200',
      status: 'completed'
    });

    const resumed = await readJsonOutput(async () => {
      await runCommand(createSessionCommand(), ['resume', 'sess-200', '--json']);
    });
    expect(resumed.session).toMatchObject({
      id: 'sess-200',
      status: 'completed'
    });
    expect(resumed.resumeGuidance).toContain('Resume phase P1 / task T200');

    await runCommand(createSessionCommand(), ['resume', 'sess-200']);
  });

  it('covers learn command recording, review, and reminder flows', async () => {
    await writeJson(join(workspaceDir, '.webforge', 'tasks.json'), {
      tasks: [
        {
          id: 'T300',
          phase: 'P1',
          title: 'Publish release',
          status: 'in_progress',
          assignee: 'agent',
          depends_on: [],
          priority: 1,
          created_at: '2026-04-08T00:00:00.000Z',
          updated_at: '2026-04-08T00:00:00.000Z'
        }
      ]
    });
    await writeJson(join(workspaceDir, '.webforge', 'runtime.json'), {
      version: '0.2',
      status: 'active',
      updatedAt: '2026-04-08T00:00:00.000Z',
      sessionId: 'sess-300',
      phaseId: 'P1',
      taskId: 'T300',
      summary: 'Learning command smoke test',
      workflowContext: null
    });

    await runCommand(createLearnCommand(), [
      'record',
      '发布前遗漏覆盖率检查',
      '--category',
      'workflow',
      '--severity',
      'high',
      '--description',
      '在发布前没有先跑完整覆盖率',
      '--fix',
      '补跑 test:coverage 并修复阻塞项',
      '--cause',
      '只关注局部测试',
      '--prevention',
      '发布前先跑完整 prepublishOnly'
    ]);

    const errorsPayload = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'learning', 'errors.json'), 'utf-8')
    ) as { errors: Array<{ id: string; title: string }> };
    const errorId = errorsPayload.errors[0]?.id;
    expect(errorId).toBeDefined();

    await runCommand(createLearnCommand(), ['list', '--limit', '5']);
    await runCommand(createLearnCommand(), ['show', errorId]);

    await runCommand(createLearnCommand(), [
      'lesson',
      '发布前先跑完整链路',
      '--content',
      '先执行 build、smoke 和 coverage，再开始真正发布。',
      '--category',
      'workflow',
      '--priority',
      'high',
      '--errors',
      errorId,
      '--tasks',
      'T300'
    ]);

    await runCommand(createLearnCommand(), ['lessons', '--priority', 'high']);
    await runCommand(createLearnCommand(), ['review', '--limit', '1']);
    await runCommand(createLearnCommand(), ['report']);

    const reminders = await readJsonOutput(async () => {
      await runCommand(createLearnCommand(), ['remind', '--task', 'T300', '--json']);
    });
    expect(reminders.reminders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining('发布前')
        })
      ])
    );

    await runCommand(createLearnCommand(), ['remind', '--task', 'T300']);
  });
});

async function runCommand(command: Command, args: string[]): Promise<void> {
  await command.parseAsync(args, { from: 'user' });
}

async function readJsonOutput<T>(run: () => Promise<void>): Promise<T> {
  vi.mocked(console.log).mockClear();
  await run();
  const output = vi
    .mocked(console.log)
    .mock.calls
    .map((call) => call.map((value) => String(value)).join(' '))
    .reverse()
    .find((value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    });

  if (!output) {
    throw new Error('No JSON console output captured');
  }

  return JSON.parse(output) as T;
}

function flatConsoleOutput(): string {
  return vi
    .mocked(console.log)
    .mock.calls
    .flat()
    .map((value) => String(value))
    .join('\n');
}

async function seedTaskKnowledgeIndex(workspaceDir: string): Promise<void> {
  await writeJson(join(workspaceDir, '.webforge', 'knowledge', 'index.json'), [
    {
      id: 'K001',
      type: 'design',
      title: 'Backend guidelines',
      path: '.webforge/knowledge/design/backend-guidelines.md',
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-08T00:00:00.000Z'
    },
    {
      id: 'K002',
      type: 'design',
      title: 'Testing playbook',
      path: '.webforge/knowledge/design/testing-playbook.md',
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-08T00:00:00.000Z'
    },
    {
      id: 'K003',
      type: 'decision',
      title: 'ADR-001 Clean architecture',
      path: '.webforge/knowledge/decisions/ADR-001-clean-architecture.md',
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-08T00:00:00.000Z'
    }
  ]);
}
