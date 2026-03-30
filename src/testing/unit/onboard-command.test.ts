import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace } from '../../core/workspace.js';
import { LogManager } from '../../core/logger.js';
import { saveSession } from '../../core/session.js';
import { buildOnboardingSummary, onboardCommand } from '../../cli/commands/onboard.js';

describe('onboard command', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-onboard-'));
    await createWorkspace(workspaceDir, { projectName: 'onboard' });
    await writeFile(join(workspaceDir, 'AGENTS.md'), '# test', 'utf-8');
    await mkdir(join(workspaceDir, 'docs', 'methodology'), { recursive: true });
    await writeFile(join(workspaceDir, 'docs', 'agent-guide.md'), '# agent guide', 'utf-8');
    await writeFile(
      join(workspaceDir, 'docs', 'methodology', 'superpowers-integration.md'),
      '# superpowers',
      'utf-8'
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('builds a unified onboarding summary for agents', async () => {
    const runtimeLog = new LogManager('runtime', workspaceDir, 'onboard-runtime-session');
    await runtimeLog.addEntry('info', 'runtime_completed', {
      metadata: {
        completed: 0,
        failed: 0,
        blocked: 0,
        deliverables: 0
      }
    });
    await runtimeLog.end();

    const summary = await buildOnboardingSummary(workspaceDir);

    expect(summary.canProceed).toBe(true);
    expect(summary.status).toBe('ready');
    expect(summary.doctor.summary.fail).toBe(0);
    expect(summary.resume.shouldRead).toContain('AGENTS.md');
    expect(summary.runtimeLogCommand).toBe('webforge logs runtime onboard-runtime-session');
    expect(summary.recommendedActions[0]).toContain('执行当前下一步');
  });

  it('supports json output for a single onboarding handshake', async () => {
    const runtimeLog = new LogManager('runtime', workspaceDir, 'onboard-json-session');
    await runtimeLog.addEntry('warning', 'permission_blocked', {
      taskId: 'T001',
      workerId: 'backend',
      metadata: {
        permissionProfile: 'read-only',
        reason: 'read-only permission profile'
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

    await onboardCommand({ json: true }, workspaceDir);

    const payload = JSON.parse(readConsoleOutput());
    expect(payload.canProceed).toBe(true);
    expect(payload.doctor.summary.fail).toBe(0);
    expect(payload.resume.runtimeLog.sessionId).toBe('onboard-json-session');
    expect(payload.runtimeLogCommand).toBe('webforge logs runtime onboard-json-session');
  });

  it('adds explicit guidance when the latest runtime context has drifted from the current workspace', async () => {
    await mkdir(join(workspaceDir, '.worktrees', 'current'), { recursive: true });
    await mkdir(join(workspaceDir, '.worktrees', 'legacy'), { recursive: true });
    await mkdir(join(workspaceDir, 'docs', 'superpowers', 'plans'), { recursive: true });
    await writeFile(
      join(workspaceDir, 'docs', 'superpowers', 'plans', 'current-plan.md'),
      '# current plan',
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, 'docs', 'superpowers', 'plans', 'legacy-plan.md'),
      '# legacy plan',
      'utf-8'
    );
    const runtimeLog = new LogManager('runtime', workspaceDir, 'runtime-legacy');
    await runtimeLog.addEntry('info', 'runtime_completed', {
      metadata: {
        completed: 1,
        failed: 0,
        blocked: 0,
        deliverables: 1
      }
    });
    await runtimeLog.end();

    await writeFile(
      join(workspaceDir, '.webforge', 'runtime.json'),
      JSON.stringify(
        {
          version: '0.2',
          status: 'active',
          updatedAt: '2026-03-30T12:00:00.000Z',
          sessionId: 'runtime-current',
          phaseId: 'P1',
          taskId: 'T-current',
          summary: 'current runtime',
          workflowContext: {
            workflow: 'subagent-driven-development',
            runId: 'run-current',
            branch: 'feature/current',
            worktreePath: '.worktrees/current',
            threadId: 'thread-current',
            artifacts: ['docs/superpowers/plans/current-plan.md']
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'sessions', 'runtime-current.json'),
      JSON.stringify(
        {
          session: {
            id: 'runtime-current',
            name: 'Current Session',
            createdAt: '2026-03-30T12:00:00.000Z',
            lastActive: '2026-03-30T12:00:00.000Z',
            status: 'active',
            workflowContext: {
              workflow: 'subagent-driven-development',
              runId: 'run-current',
              branch: 'feature/current',
              worktreePath: '.worktrees/current',
              threadId: 'thread-current',
              artifacts: ['docs/superpowers/plans/current-plan.md']
            },
            stats: {
              tasksCompleted: 1,
              totalTasks: 1
            }
          },
          tasksSnapshot: [],
          phasesSnapshot: [],
          resumeGuidance: 'resume current workspace'
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'sessions', 'index.json'),
      JSON.stringify(
        {
          sessions: [
            {
              id: 'runtime-current',
              name: 'Current Session',
              createdAt: '2026-03-30T12:00:00.000Z',
              created_at: '2026-03-30T12:00:00.000Z',
              lastActive: '2026-03-30T12:00:00.000Z',
              last_active: '2026-03-30T12:00:00.000Z',
              status: 'active',
              workflowContext: {
                workflow: 'subagent-driven-development',
                runId: 'run-current',
                branch: 'feature/current',
                worktreePath: '.worktrees/current',
                threadId: 'thread-current',
                artifacts: ['docs/superpowers/plans/current-plan.md']
              },
              stats: {
                tasksCompleted: 1,
                totalTasks: 1
              }
            },
            {
              id: 'runtime-legacy',
              name: 'Legacy Session',
              createdAt: '2026-03-30T11:00:00.000Z',
              created_at: '2026-03-30T11:00:00.000Z',
              lastActive: '2026-03-30T11:00:00.000Z',
              last_active: '2026-03-30T11:00:00.000Z',
              status: 'completed',
              workflowContext: {
                workflow: 'writing-plans',
                runId: 'run-legacy',
                branch: 'feature/legacy',
                worktreePath: '.worktrees/legacy',
                threadId: 'thread-legacy',
                artifacts: ['docs/superpowers/plans/legacy-plan.md']
              },
              stats: {
                tasksCompleted: 1,
                totalTasks: 1
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
      join(workspaceDir, '.webforge', 'threads.json'),
      JSON.stringify(
        {
          threads: [
            {
              id: 'thread-current',
              recordedAt: '2026-03-30T12:00:00.000Z',
              workflow: 'subagent-driven-development',
              summary: 'current thread',
              runId: 'run-current',
              branch: 'feature/current',
              worktreePath: '.worktrees/current',
              artifacts: ['docs/superpowers/plans/current-plan.md']
            },
            {
              id: 'thread-legacy',
              recordedAt: '2026-03-30T11:00:00.000Z',
              workflow: 'writing-plans',
              summary: 'legacy thread',
              runId: 'run-legacy',
              branch: 'feature/legacy',
              worktreePath: '.worktrees/legacy',
              artifacts: ['docs/superpowers/plans/legacy-plan.md']
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    const summary = await buildOnboardingSummary(workspaceDir);

    expect(summary.resume.runtimeLog.contextDrift.status).toBe('drifted');
    expect(summary.recommendedActions).toContain(
      '最近 runtime 与当前 workspace 上下文已漂移，先运行 webforge logs runtime runtime-legacy 并核对 drift: workflow: writing-plans -> subagent-driven-development, runId: run-legacy -> run-current, threadId: thread-legacy -> thread-current, branch: feature/legacy -> feature/current, worktreePath: .worktrees/legacy -> .worktrees/current, threadLinkage.threadId: thread-legacy -> thread-current, threadLinkage.workflow: writing-plans -> subagent-driven-development, threadLinkage.runId: run-legacy -> run-current, threadLinkage.branch: feature/legacy -> feature/current, threadLinkage.worktreePath: .worktrees/legacy -> .worktrees/current'
    );
  });

  it('surfaces recovery readiness when workflow context and latest run are recoverable', async () => {
    await saveSession('sess-prev', [], [], {
      name: 'compact origin',
      context: 'read this before continuing wave a',
      nextAction: 'resume wave a after compact',
      basePath: workspaceDir
    });
    await mkdir(join(workspaceDir, '.worktrees', 'wave-a'), { recursive: true });
    await mkdir(join(workspaceDir, 'docs', 'superpowers', 'plans'), { recursive: true });
    await writeFile(
      join(workspaceDir, 'docs', 'superpowers', 'plans', 'wave-a-plan.md'),
      '# wave a plan',
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'runtime.json'),
      JSON.stringify(
        {
          version: '0.2',
          status: 'active',
          updatedAt: '2026-03-30T00:00:00.000Z',
          sessionId: 'sess-wave-a',
          phaseId: 'P1',
          taskId: 'T001',
          summary: 'resume wave a',
          workflowContext: {
            workflow: 'subagent-driven-development',
            runId: 'spr-wave-a',
            branch: 'feature/wave-a',
            worktreePath: '.worktrees/wave-a',
            waveId: 'wave-a',
            threadId: 'thread-a',
            compactFromSession: 'sess-prev',
            artifacts: ['docs/superpowers/plans/wave-a-plan.md']
          }
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
              id: 'spr-wave-a',
              workflow: 'subagent-driven-development',
              recordedAt: '2026-03-30T00:00:00.000Z',
              summary: 'wave a ready',
              taskId: 'T001',
              sessionId: 'sess-wave-a',
              artifacts: [
                {
                  kind: 'plan',
                  path: 'docs/superpowers/plans/wave-a-plan.md'
                }
              ],
              metadata: {
                branch: 'feature/wave-a',
                worktreePath: '.worktrees/wave-a',
                threadId: 'thread-a',
                compactFromSession: 'sess-prev'
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
      join(workspaceDir, '.webforge', 'threads.json'),
      JSON.stringify(
        {
          threads: [
            {
              id: 'thread-a',
              recordedAt: '2026-03-30T00:00:00.000Z',
              workflow: 'subagent-driven-development',
              summary: 'thread a linked',
              runId: 'spr-wave-a',
              sessionId: 'sess-wave-a',
              branch: 'feature/wave-a',
              worktreePath: '.worktrees/wave-a',
              artifacts: ['docs/superpowers/plans/wave-a-plan.md']
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    const summary = await buildOnboardingSummary(workspaceDir);

    expect(summary.recoveryReadiness.overallStatus).toBe('ready');
    expect(summary.recoveryReadiness.workflowContext).toMatchObject({
      status: 'ready',
      branch: 'feature/wave-a',
      worktreePath: '.worktrees/wave-a',
      threadId: 'thread-a',
      compactFromSession: 'sess-prev',
      missingCompactSessionId: null
    });
    expect(summary.recommendedActions).toContain(
      '沿当前 workflow context 恢复：branch=feature/wave-a, worktree=.worktrees/wave-a'
    );
    expect(summary.recommendedActions).toContain(
      '如果这次恢复来自 compact，先读 .webforge/sessions/sess-prev.json'
    );
    expect(summary.recommendedActions).toContain(
      '如果沿 thread 恢复，先读 .webforge/threads.json 并核对 thread-a'
    );
    expect(summary.recoveryReadiness.threadLinkage).toMatchObject({
      status: 'ready',
      workflow: 'subagent-driven-development',
      threadId: 'thread-a',
      worktreePath: '.worktrees/wave-a',
      missingThreadId: null
    });
    expect(summary.shouldRead).toContain('.webforge/sessions/sess-prev.json');
    expect(summary.shouldRead).toContain('.webforge/threads.json');
  });

  it('marks onboarding recovery readiness as blocked when workflow pointers are broken', async () => {
    await writeFile(
      join(workspaceDir, '.webforge', 'runtime.json'),
      JSON.stringify(
        {
          version: '0.2',
          status: 'active',
          updatedAt: '2026-03-30T00:00:00.000Z',
          sessionId: 'sess-broken',
          phaseId: 'P2',
          taskId: 'T099',
          summary: 'broken recovery context',
          workflowContext: {
            workflow: 'strategic-compact',
            runId: 'spr-broken',
            branch: 'feature/compact',
            worktreePath: '.worktrees/missing-compact',
            threadId: 'thread-broken',
            compactFromSession: 'sess-old',
            artifacts: ['docs/superpowers/plans/missing-handoff.md']
          }
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
              id: 'spr-broken',
              workflow: 'strategic-compact',
              recordedAt: '2026-03-30T00:00:00.000Z',
              summary: 'broken compact handoff',
              sessionId: 'sess-broken',
              artifacts: [
                {
                  kind: 'compact-handoff',
                  path: 'docs/superpowers/plans/missing-handoff.md'
                }
              ],
              metadata: {
                branch: 'feature/compact',
                worktreePath: '.worktrees/missing-compact',
                threadId: 'thread-broken',
                compactFromSession: 'sess-old'
              }
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    const summary = await buildOnboardingSummary(workspaceDir);

    expect(summary.canProceed).toBe(false);
    expect(summary.recoveryReadiness.overallStatus).toBe('blocked');
    expect(summary.recoveryReadiness.workflowContext).toMatchObject({
      status: 'blocked',
      missingArtifacts: ['docs/superpowers/plans/missing-handoff.md'],
      missingWorktreePath: '.worktrees/missing-compact',
      missingCompactSessionId: 'sess-old'
    });
    expect(summary.recoveryReadiness.latestSuperpowersRun).toMatchObject({
      status: 'blocked',
      missingArtifacts: ['docs/superpowers/plans/missing-handoff.md'],
      missingWorktreePath: '.worktrees/missing-compact',
      missingCompactSessionId: 'sess-old'
    });
    expect(summary.recoveryReadiness.threadLinkage).toMatchObject({
      status: 'blocked',
      threadId: 'thread-broken',
      missingThreadId: 'thread-broken'
    });
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
