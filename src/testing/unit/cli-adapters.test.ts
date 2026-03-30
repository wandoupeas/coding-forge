import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace, loadWorkspaceState } from '../../core/workspace.js';
import { runCommand } from '../../cli/commands/run.js';
import { buildResumeSummary } from '../../cli/commands/resume.js';
import { dashboardCommand } from '../../cli/commands/dashboard.js';
import { listMailboxes, readMailbox } from '../../cli/commands/mailbox.js';
import { LogManager } from '../../core/logger.js';
import { saveSession } from '../../core/session.js';
import { Mailbox } from '../../core/mailbox.js';
import { loadConfig, saveConfig } from '../../utils/config.js';

describe('cli adapters', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-cli-'));
    await createWorkspace(workspaceDir, { projectName: 'cli-adapters' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('run 命令通过 runtime core 执行 ready 队列', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeFile(
      workspace.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: 'runtime adapter task',
              status: 'ready',
              assignee: 'backend',
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

    await runCommand({ limit: 1 }, workspaceDir);

    const updatedState = await loadWorkspaceState(workspaceDir);
    expect(updatedState.tasks.tasks[0]?.status).toBe('completed');
    expect(updatedState.tasks.tasks[0]?.metadata).toMatchObject({
      agent_metadata: {
        adapterProvider: 'stub'
      }
    });
    expect(updatedState.indexes.deliverables).toHaveLength(1);
    expect(readConsoleOutput()).toContain('Runtime 执行结果');
  });

  it('resume 基于 session 与 runtime 生成 next action', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeFile(
      workspace.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: 'resume task',
              status: 'ready',
              assignee: 'backend',
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
          phaseId: 'P1',
          taskId: 'T001',
          summary: 'Running T001'
        },
        null,
        2
      ),
      'utf-8'
    );

    const reloaded = await loadWorkspaceState(workspaceDir);
    await saveSession('resume-session', reloaded.tasks.tasks, reloaded.phases.phases, {
      name: 'runtime main loop',
      currentTaskId: 'T001',
      currentPhaseId: 'P1',
      context: 'resume later',
      nextAction: 'continue ready-task loop',
      basePath: workspaceDir
    });

    const summary = await buildResumeSummary(workspaceDir);

    expect(summary.sessionId).toBe('resume-session');
    expect(summary.runtimeStatus).toBe('active');
    expect(summary.guidance).toContain('resume later');
    expect(summary.nextAction).toContain('resume later');
  });

  it('resume 支持 JSON 简报输出，供 agent 直接消费', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    const config = await loadConfig(workspaceDir);
    config.agent = {
      provider: 'stub',
      fallback_provider: 'stub',
      permission_profile: 'approval-required'
    };
    await saveConfig(config, workspaceDir);
    await writeFile(
      workspace.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T010',
              phase: 'P1',
              title: 'json resume task',
              status: 'ready',
              assignee: 'backend',
              depends_on: [],
              priority: 1,
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z',
              metadata: {
                superpowers: true,
                execution: 'subagent',
                skills: ['backend-patterns']
              },
              workflowContext: {
                workflow: 'writing-plans',
                runId: 'spr-010',
                branch: 'feature/api-contract',
                worktreePath: '.worktrees/api-contract',
                waveId: 'wave-1',
                threadId: 'thread-7',
                compactFromSession: 'sess-000',
                artifacts: ['docs/superpowers/plans/latest-plan.md']
              }
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'superpowers.json'),
      JSON.stringify(
        {
          required: ['writing-plans'],
          execution: 'subagent'
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'superpowers-runs.json'),
      JSON.stringify(
        {
          runs: [
            {
              id: 'spr-010',
              workflow: 'writing-plans',
              recordedAt: '2026-03-30T00:00:00.000Z',
              summary: 'latest implementation plan',
              taskId: 'T010',
              artifacts: [
                {
                  kind: 'plan',
                  path: 'docs/superpowers/plans/latest-plan.md'
                }
              ]
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'threads.json'),
      JSON.stringify(
        {
          threads: [
            {
              id: 'thread-7',
              recordedAt: '2026-03-30T00:00:00.000Z',
              workflow: 'writing-plans',
              summary: 'api contract thread',
              runId: 'spr-010',
              branch: 'feature/api-contract',
              worktreePath: '.worktrees/api-contract',
              artifacts: ['docs/superpowers/plans/latest-plan.md']
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    const reloaded = await loadWorkspaceState(workspaceDir);
    await saveSession('sess-000', reloaded.tasks.tasks, reloaded.phases.phases, {
      name: 'compact origin',
      context: 'read this before continuing the post-compact session',
      nextAction: 'continue from compact origin',
      basePath: workspaceDir
    });
    await mkdir(join(workspaceDir, '.worktrees', 'api-contract'), { recursive: true });
    await mkdir(join(workspaceDir, 'docs', 'superpowers', 'plans'), { recursive: true });
    await writeFile(
      join(workspaceDir, 'docs', 'superpowers', 'plans', 'latest-plan.md'),
      '# latest plan',
      'utf-8'
    );
    const sender = new Mailbox('pm', workspaceDir);
    await sender.init();
    await sender.send('backend', 'notification', 'check the API contract');
    const runtimeLog = new LogManager('runtime', workspaceDir, 'resume-runtime-session');
    await runtimeLog.addEntry('warning', 'permission_blocked', {
      taskId: 'T010',
      workerId: 'backend',
      metadata: {
        permissionProfile: 'approval-required'
      }
    });
    await runtimeLog.addEntry('info', 'runtime_completed', {
      metadata: {
        completed: 0,
        failed: 0,
        blocked: 1,
        deliverables: 0
      }
    });
    await runtimeLog.end();

    const { resumeCommand } = await import('../../cli/commands/resume.js');
    await resumeCommand({ json: true }, workspaceDir);

    const payload = JSON.parse(readConsoleOutput());
    expect(payload.readyCount).toBe(1);
    expect(payload.nextAction).toContain('Resume session compact origin');
    expect(payload.shouldRead).toContain('AGENTS.md');
    expect(payload.shouldRead).toContain('docs/superpowers/plans/latest-plan.md');
    expect(payload.shouldRead).toContain('.webforge/sessions/sess-000.json');
    expect(payload.shouldRead).toContain('.webforge/threads.json');
    expect(payload.permissions).toMatchObject({
      profile: 'approval-required',
      canWriteWorkspace: false,
      requiresApproval: true
    });
    expect(payload.superpowers).toMatchObject({
      enabled: true,
      executionMode: 'subagent',
      taskSkills: ['backend-patterns'],
      requiredSkills: ['writing-plans'],
      suggestedWorkflow: 'subagent-driven-development'
    });
    expect(payload.superpowers.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'writing-plans',
          recommended: true
        }),
        expect.objectContaining({
          id: 'subagent-driven-development',
          recommended: true
        })
      ])
    );
    expect(payload.observation.unreadMessages).toBe(1);
    expect(payload.runtimeLog).toMatchObject({
      sessionId: 'resume-runtime-session',
      lastEvent: 'runtime_completed',
      lastTaskId: 'T010',
      permissionProfile: 'approval-required',
      command: 'webforge logs runtime resume-runtime-session',
      contextDrift: {
        status: 'drifted'
      }
    });
    expect(payload.runtimeLog.workflowContext).toBeNull();
    expect(payload.runtimeLog.threadLinkage.status).toBe('none');
    expect(payload.runtimeLog.currentWorkflowContext).toMatchObject({
      source: 'current',
      workflow: 'writing-plans',
      threadId: 'thread-7'
    });
    expect(payload.runtimeLog.currentThreadLinkage).toMatchObject({
      status: 'ready',
      threadId: 'thread-7'
    });
    expect(payload.runtimeLog.contextDrift.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('missing log workflowContext')])
    );
    expect(payload.latestSuperpowersRun).toMatchObject({
      id: 'spr-010',
      workflow: 'writing-plans',
      summary: 'latest implementation plan'
    });
    expect(payload.workflowContext).toMatchObject({
      workflow: 'writing-plans',
      runId: 'spr-010',
      branch: 'feature/api-contract',
      worktreePath: '.worktrees/api-contract',
      waveId: 'wave-1',
      threadId: 'thread-7',
      artifacts: ['docs/superpowers/plans/latest-plan.md']
    });
    expect(payload.threadLinkage).toMatchObject({
      status: 'ready',
      threadId: 'thread-7',
      workflow: 'writing-plans',
      runId: 'spr-010',
      branch: 'feature/api-contract',
      worktreePath: '.worktrees/api-contract',
      missingThreadId: null
    });
  });

  it('dashboard 只渲染 workspace 观察信息', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeFile(
      workspace.paths.runtime,
      JSON.stringify(
        {
          ...workspace.runtime,
          workflowContext: {
            workflow: 'writing-plans',
            runId: 'spr-001',
            branch: 'feature/dashboard',
            worktreePath: '.worktrees/dashboard',
            waveId: 'wave-2',
            threadId: 'thread-dashboard',
            compactFromSession: 'sess-dashboard-origin',
            artifacts: ['docs/superpowers/plans/latest-plan.md']
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      workspace.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: 'dashboard ready task',
              status: 'ready',
              assignee: 'backend',
              depends_on: [],
              priority: 1,
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            },
            {
              id: 'T002',
              phase: 'P1',
              title: 'dashboard blocked task',
              status: 'blocked',
              assignee: 'qa',
              depends_on: ['T001'],
              priority: 2,
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
    const stateWithTasks = await loadWorkspaceState(workspaceDir);
    await saveSession('sess-dashboard-origin', stateWithTasks.tasks.tasks, stateWithTasks.phases.phases, {
      name: 'dashboard origin',
      context: 'resume dashboard after compact',
      nextAction: 'read dashboard context',
      basePath: workspaceDir
    });
    await writeFile(
      join(workspaceDir, '.webforge', 'threads.json'),
      JSON.stringify(
        {
          threads: [
            {
              id: 'thread-dashboard',
              recordedAt: '2026-03-30T00:00:00.000Z',
              workflow: 'writing-plans',
              summary: 'dashboard thread',
              runId: 'spr-001',
              branch: 'feature/dashboard',
              worktreePath: '.worktrees/dashboard',
              artifacts: ['docs/superpowers/plans/latest-plan.md']
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await mkdir(join(workspaceDir, '.worktrees', 'dashboard'), { recursive: true });
    await mkdir(join(workspaceDir, 'docs', 'superpowers', 'plans'), { recursive: true });
    await writeFile(
      join(workspaceDir, 'docs', 'superpowers', 'plans', 'latest-plan.md'),
      '# dashboard plan',
      'utf-8'
    );
    await writeFile(
      workspace.paths.deliverablesIndex,
      JSON.stringify(
        {
          items: [
            {
              id: 'del-001',
              taskId: 'T001',
              type: 'document',
              title: 'dashboard pending spec',
              path: '.webforge/deliverables/del-001.md',
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
    const runtimeLog = new LogManager('runtime', workspaceDir, 'runtime-dashboard-session');
    await runtimeLog.addEntry('warning', 'permission_blocked', {
      taskId: 'T002',
      workerId: 'backend',
      metadata: {
        permissionProfile: 'read-only',
        reason: 'read-only permission profile',
        observation: {
          counts: {
            readyTasks: 1,
            blockedTasks: 1,
            pendingReview: 1,
            unreadMessages: 0
          }
        }
      }
    });
    await runtimeLog.addEntry('info', 'runtime_completed', {
      metadata: {
        completed: 0,
        failed: 0,
        blocked: 1,
        deliverables: 0
      }
    });
    await runtimeLog.end();

    await dashboardCommand({}, workspaceDir);

    const output = readConsoleOutput();
    expect(output).toContain('Agent 简报');
    expect(output).toContain('建议先读');
    expect(output).toContain('Runtime 状态');
    expect(output).toContain('最近 Runtime 观察');
    expect(output).toContain('permission_blocked');
    expect(output).toContain('read-only');
    expect(output).toContain('T001');
    expect(output).toContain('待审核交付物');
    expect(output).toContain('阻塞任务');
    expect(output).toContain('当前 Workflow Context');
    expect(output).toContain('当前 Thread Linkage');
    expect(output).toContain('feature/dashboard');
    expect(output).toContain('.worktrees/dashboard');
    expect(output).toContain('thread-dashboard');
    expect(output).toContain('compact from: sess-dashboard-origin');
    expect(output).toContain('compact=ok');
    expect(output).toContain('status: ready');
  });

  it('dashboard 在 thread linkage 缺失时直接显示阻塞信号', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
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

    await dashboardCommand({}, workspaceDir);

    const output = readConsoleOutput();
    expect(output).toContain('当前 Thread Linkage');
    expect(output).toContain('thread-missing');
    expect(output).toContain('status: blocked');
    expect(output).toContain('missing thread object=thread-missing');
  });

  it('dashboard 在没有 workflow context 和 runtime 日志时保持简洁输出', async () => {
    await dashboardCommand({}, workspaceDir);

    const output = readConsoleOutput();
    expect(output).toContain('Agent 简报');
    expect(output).toContain('Runtime 状态');
    expect(output).not.toContain('当前 Workflow Context');
    expect(output).not.toContain('最近 Runtime 观察');
  });

  it('mailbox 命令只观察真实 mailbox 状态', async () => {
    const sender = new Mailbox('qa', workspaceDir);
    await sender.init();
    await sender.send('pm', 'notification', 'hello runtime mailbox');

    await listMailboxes(workspaceDir);
    expect(readConsoleOutput()).toContain('pm');
    expect(readConsoleOutput()).toContain('1 未读');

    vi.mocked(console.log).mockClear();

    await readMailbox('pm', { markRead: true }, workspaceDir);
    expect(readConsoleOutput()).toContain('hello runtime mailbox');
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
