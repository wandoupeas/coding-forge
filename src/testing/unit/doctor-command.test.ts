import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace } from '../../core/workspace.js';
import { LogManager } from '../../core/logger.js';
import { Mailbox } from '../../core/mailbox.js';
import { buildDoctorReport, doctorCommand } from '../../cli/commands/doctor.js';

describe('doctor command', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-doctor-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('reports missing repo-side harness requirements', async () => {
    const report = await doctorCommand(workspaceDir);

    expect(report.summary.fail).toBeGreaterThan(0);
    expect(report.checks.find((check) => check.id === 'agents')).toMatchObject({
      status: 'fail'
    });
    expect(report.checks.find((check) => check.id === 'workspace')).toMatchObject({
      status: 'fail'
    });
    expect(readConsoleOutput()).toContain('先初始化或恢复 .webforge/');
    expect(readConsoleOutput()).toContain('补齐 AGENTS.md');
    expect(readConsoleOutput()).toContain('补齐 superpowers 集成文档');
  });

  it('reports a healthy repo-side harness when contract files exist', async () => {
    await createWorkspace(workspaceDir, { projectName: 'doctor-ok' });
    await writeFile(join(workspaceDir, 'AGENTS.md'), '# test', 'utf-8');
    await mkdir(join(workspaceDir, 'docs', 'methodology'), { recursive: true });
    await writeFile(join(workspaceDir, 'docs', 'agent-guide.md'), '# agent guide', 'utf-8');
    await writeFile(
      join(workspaceDir, 'docs', 'methodology', 'superpowers-integration.md'),
      '# superpowers',
      'utf-8'
    );

    const report = await doctorCommand(workspaceDir);

    expect(report.summary.fail).toBe(0);
    expect(report.summary.warn).toBe(0);
    expect(report.checks.find((check) => check.id === 'workspace-state')).toMatchObject({
      status: 'ok'
    });
    expect(report.checks.find((check) => check.id === 'runtime-observability')).toMatchObject({
      status: 'ok'
    });
    expect(report.checks.find((check) => check.id === 'runtime-context-drift')).toMatchObject({
      status: 'ok'
    });
    expect(report.checks.find((check) => check.id === 'checkpoint-observability')).toMatchObject({
      status: 'ok'
    });
    expect(readConsoleOutput()).toContain('WebForge Doctor');
    expect(readConsoleOutput()).toContain('可以直接让 Codex / Claude Code');
  });

  it('supports JSON doctor reports for agent consumption', async () => {
    await createWorkspace(workspaceDir, { projectName: 'doctor-json' });
    await writeFile(join(workspaceDir, 'AGENTS.md'), '# test', 'utf-8');
    await mkdir(join(workspaceDir, 'docs', 'methodology'), { recursive: true });
    await writeFile(join(workspaceDir, 'docs', 'agent-guide.md'), '# agent guide', 'utf-8');
    await writeFile(
      join(workspaceDir, 'docs', 'methodology', 'superpowers-integration.md'),
      '# superpowers',
      'utf-8'
    );

    const report = await doctorCommand({ json: true }, workspaceDir);
    const payload = JSON.parse(readConsoleOutput());

    expect(report.summary.fail).toBe(0);
    expect(payload.summary.fail).toBe(0);
    expect(payload.guidance[0]).toContain('仓库契约基本完整');
    expect(payload.checks.find((check: { id: string }) => check.id === 'runtime-observability')).toBeDefined();
    expect(payload.checks.find((check: { id: string }) => check.id === 'runtime-context-drift')).toBeDefined();
  });

  it('warns when agent profile is unreadable and fails when workspace state is broken', async () => {
    await mkdir(join(workspaceDir, '.webforge', 'knowledge'), { recursive: true });
    await mkdir(join(workspaceDir, '.webforge', 'deliverables'), { recursive: true });
    await mkdir(join(workspaceDir, '.webforge', 'sessions'), { recursive: true });
    await writeFile(join(workspaceDir, 'AGENTS.md'), '# test', 'utf-8');
    await mkdir(join(workspaceDir, 'docs', 'methodology'), { recursive: true });
    await writeFile(join(workspaceDir, 'docs', 'agent-guide.md'), '# agent guide', 'utf-8');
    await writeFile(
      join(workspaceDir, 'docs', 'methodology', 'superpowers-integration.md'),
      '# superpowers',
      'utf-8'
    );

    const report = await buildDoctorReport(workspaceDir);

    expect(report.checks.find((check) => check.id === 'agent-profile')).toMatchObject({
      status: 'warn'
    });
    expect(report.checks.find((check) => check.id === 'workspace-state')).toMatchObject({
      status: 'fail'
    });
  });

  it('warns on actionable observability signals such as unread mailboxes and pending review', async () => {
    await createWorkspace(workspaceDir, { projectName: 'doctor-observability' });
    await writeFile(join(workspaceDir, 'AGENTS.md'), '# test', 'utf-8');
    await mkdir(join(workspaceDir, 'docs', 'methodology'), { recursive: true });
    await writeFile(join(workspaceDir, 'docs', 'agent-guide.md'), '# agent guide', 'utf-8');
    await writeFile(
      join(workspaceDir, 'docs', 'methodology', 'superpowers-integration.md'),
      '# superpowers',
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'deliverables', 'index.json'),
      JSON.stringify(
        {
          items: [
            {
              id: 'del-001',
              taskId: 'T001',
              type: 'document',
              title: 'Needs review',
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
    const sender = new Mailbox('pm', workspaceDir);
    await sender.init();
    await sender.send('backend', 'notification', 'check unread mailbox');

    const report = await buildDoctorReport(workspaceDir);

    expect(report.checks.find((check) => check.id === 'mailbox-observability')).toMatchObject({
      status: 'warn'
    });
    expect(report.checks.find((check) => check.id === 'review-observability')).toMatchObject({
      status: 'warn'
    });
    expect(report.guidance).toContain('先检查 mailbox 未读消息，避免错过协作信号。');
    expect(report.guidance).toContain('先处理 pending_review 交付物，再继续推进新的实现。');
  });

  it('warns when the latest runtime context has drifted from the current workspace', async () => {
    await createWorkspace(workspaceDir, { projectName: 'doctor-runtime-drift' });
    await writeFile(join(workspaceDir, 'AGENTS.md'), '# test', 'utf-8');
    await mkdir(join(workspaceDir, 'docs', 'methodology'), { recursive: true });
    await mkdir(join(workspaceDir, '.worktrees', 'current'), { recursive: true });
    await mkdir(join(workspaceDir, '.worktrees', 'legacy'), { recursive: true });
    await mkdir(join(workspaceDir, 'docs', 'superpowers', 'plans'), { recursive: true });
    await writeFile(join(workspaceDir, 'docs', 'agent-guide.md'), '# agent guide', 'utf-8');
    await writeFile(
      join(workspaceDir, 'docs', 'methodology', 'superpowers-integration.md'),
      '# superpowers',
      'utf-8'
    );
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

    const report = await buildDoctorReport(workspaceDir);

    expect(report.checks.find((check) => check.id === 'runtime-context-drift')).toMatchObject({
      status: 'warn'
    });
    expect(
      report.checks.find((check) => check.id === 'runtime-context-drift')?.detail
    ).toContain('drifted:');
    expect(report.guidance).toContain(
      '最近 runtime 上下文与当前 workspace 已漂移，先运行 webforge logs runtime 并核对 drift，再决定是否沿当前上下文继续。'
    );
  });

  it('fails superpowers readiness when the latest workflow run points at missing artifacts', async () => {
    await createWorkspace(workspaceDir, { projectName: 'doctor-superpowers-readiness' });
    await writeFile(join(workspaceDir, 'AGENTS.md'), '# test', 'utf-8');
    await mkdir(join(workspaceDir, 'docs', 'methodology'), { recursive: true });
    await writeFile(join(workspaceDir, 'docs', 'agent-guide.md'), '# agent guide', 'utf-8');
    await writeFile(
      join(workspaceDir, 'docs', 'methodology', 'superpowers-integration.md'),
      '# superpowers',
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'superpowers-runs.json'),
      JSON.stringify(
        {
          runs: [
            {
              id: 'spr-001',
              workflow: 'writing-plans',
              recordedAt: '2026-03-30T00:00:00.000Z',
              summary: 'latest planning output',
              artifacts: [
                {
                  kind: 'plan',
                  path: 'docs/superpowers/plans/missing-plan.md'
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

    const report = await buildDoctorReport(workspaceDir);

    expect(report.checks.find((check) => check.id === 'superpowers-readiness')).toMatchObject({
      status: 'fail'
    });
    expect(report.guidance).toContain(
      '修复最近一次 superpowers workflow 记录指向的缺失产物、worktree 或 compact session，再依赖其恢复上下文。'
    );
  });

  it('fails workflow context readiness when runtime points at a missing worktree or artifact', async () => {
    await createWorkspace(workspaceDir, { projectName: 'doctor-workflow-context' });
    await writeFile(join(workspaceDir, 'AGENTS.md'), '# test', 'utf-8');
    await mkdir(join(workspaceDir, 'docs', 'methodology'), { recursive: true });
    await writeFile(join(workspaceDir, 'docs', 'agent-guide.md'), '# agent guide', 'utf-8');
    await writeFile(
      join(workspaceDir, 'docs', 'methodology', 'superpowers-integration.md'),
      '# superpowers',
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'runtime.json'),
      JSON.stringify(
        {
          version: '0.2',
          status: 'active',
          updatedAt: '2026-03-30T00:00:00.000Z',
          sessionId: 'sess-ctx',
          phaseId: 'P1',
          taskId: 'T001',
          summary: 'running with workflow context',
          workflowContext: {
            workflow: 'subagent-driven-development',
            branch: 'feature/runtime',
            worktreePath: '.worktrees/missing-runtime',
            waveId: 'wave-7',
            threadId: 'thread-runtime',
            compactFromSession: 'sess-compact-missing',
            artifacts: ['docs/superpowers/plans/missing-plan.md']
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    const report = await buildDoctorReport(workspaceDir);

    expect(report.checks.find((check) => check.id === 'workflow-context-readiness')).toMatchObject({
      status: 'fail'
    });
    expect(
      report.checks.find((check) => check.id === 'workflow-context-readiness')?.detail
    ).toContain('missing_compact_session=sess-compact-missing');
    expect(report.guidance).toContain(
      '修复当前 workflow context 指向的缺失 worktree、artifact 或 compact session，再继续沿该上下文恢复。'
    );
    expect(report.checks.find((check) => check.id === 'thread-linkage-readiness')).toMatchObject({
      status: 'fail',
      detail: 'missing_thread=thread-runtime'
    });
    expect(report.guidance).toContain('修复当前 thread linkage 缺失的索引、artifact 或 worktree，再沿该 thread 恢复。');
  });

  it('passes workflow context readiness when runtime points at a recoverable workflow context', async () => {
    await createWorkspace(workspaceDir, { projectName: 'doctor-workflow-context-ok' });
    await writeFile(join(workspaceDir, 'AGENTS.md'), '# test', 'utf-8');
    await mkdir(join(workspaceDir, 'docs', 'methodology'), { recursive: true });
    await writeFile(join(workspaceDir, 'docs', 'agent-guide.md'), '# agent guide', 'utf-8');
    await writeFile(
      join(workspaceDir, 'docs', 'methodology', 'superpowers-integration.md'),
      '# superpowers',
      'utf-8'
    );
    await mkdir(join(workspaceDir, '.worktrees', 'active-wave'), { recursive: true });
    await mkdir(join(workspaceDir, '.webforge', 'sessions'), { recursive: true });
    await mkdir(join(workspaceDir, 'docs', 'superpowers', 'plans'), { recursive: true });
    await writeFile(
      join(workspaceDir, 'docs', 'superpowers', 'plans', 'active-plan.md'),
      '# plan',
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'sessions', 'sess-compact-ok.json'),
      JSON.stringify({ session: { id: 'sess-compact-ok' } }, null, 2),
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'threads.json'),
      JSON.stringify(
        {
          threads: [
            {
              id: 'thread-plan',
              recordedAt: '2026-03-30T00:00:00.000Z',
              workflow: 'writing-plans',
              summary: 'thread is linked',
              runId: 'spr-ctx-ok',
              artifacts: ['docs/superpowers/plans/active-plan.md']
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      join(workspaceDir, '.webforge', 'runtime.json'),
      JSON.stringify(
        {
          version: '0.2',
          status: 'active',
          updatedAt: '2026-03-30T00:00:00.000Z',
          sessionId: 'sess-ctx-ok',
          phaseId: 'P2',
          taskId: 'T010',
          summary: 'running with valid workflow context',
          workflowContext: {
            workflow: 'writing-plans',
            branch: 'feature/planning',
            worktreePath: '.worktrees/active-wave',
            waveId: 'wave-2',
            threadId: 'thread-plan',
            compactFromSession: 'sess-compact-ok',
            artifacts: ['docs/superpowers/plans/active-plan.md']
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    const report = await buildDoctorReport(workspaceDir);

    expect(report.checks.find((check) => check.id === 'workflow-context-readiness')).toMatchObject({
      status: 'ok',
      detail:
        'workflow=writing-plans, branch=feature/planning, worktree=.worktrees/active-wave, wave=wave-2, thread=thread-plan, compact_from=sess-compact-ok'
    });
    expect(report.checks.find((check) => check.id === 'thread-linkage-readiness')).toMatchObject({
      status: 'ok',
      detail: 'thread=thread-plan, workflow=writing-plans, artifacts=1'
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
