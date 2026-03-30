import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace } from '../../core/workspace.js';
import { LogManager } from '../../core/logger.js';
import { runtimeLogsCommand } from '../../cli/commands/logs.js';
import { writeJson, writeText } from '../../utils/file.js';

describe('logs command', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-logs-command-'));
    await createWorkspace(workspaceDir, { projectName: 'logs-command' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('renders the latest runtime log summary and event stream', async () => {
    const manager = new LogManager('runtime', workspaceDir, 'runtime-log-session');
    await manager.addEntry('info', 'before_execute', {
      taskId: 'T001',
      workerId: 'backend',
      metadata: {
        permissionProfile: 'workspace-write',
        stage: 'before_execute',
        observation: {
          counts: {
            readyTasks: 1,
            blockedTasks: 0,
            pendingReview: 0,
            unreadMessages: 0
          }
        }
      }
    });
    await manager.addEntry('success', 'after_execute', {
      taskId: 'T001',
      workerId: 'backend',
      metadata: {
        permissionProfile: 'workspace-write',
        result: 'completed'
      }
    });
    await manager.addEntry('info', 'runtime_completed', {
      metadata: {
        completed: 1,
        failed: 0,
        blocked: 0,
        deliverables: 1
      }
    });
    await manager.end();
    await writeText(
      join(workspaceDir, '.webforge/knowledge/parsed/thread-notes.md'),
      '# thread notes\n'
    );
    await writeJson(join(workspaceDir, '.webforge/runtime.json'), {
      version: '0.2',
      status: 'idle',
      updatedAt: '2026-03-30T09:00:00.000Z',
      sessionId: 'runtime-log-session',
      phaseId: 'P1',
      taskId: null,
      summary: 'latest runtime summary',
      workflowContext: {
        workflow: 'subagent-driven-development',
        runId: 'run-runtime-001',
        owner: 'superpowers',
        waveId: 'wave-01',
        threadId: 'thread-runtime-001',
        branch: 'feature/runtime-observation',
        worktreePath: workspaceDir,
        artifacts: ['.webforge/knowledge/parsed/thread-notes.md']
      }
    });
    await writeJson(join(workspaceDir, '.webforge/threads.json'), {
      threads: [
        {
          id: 'thread-runtime-001',
          recordedAt: '2026-03-30T09:00:00.000Z',
          workflow: 'subagent-driven-development',
          summary: 'runtime thread',
          runId: 'run-runtime-001',
          branch: 'feature/runtime-observation',
          worktreePath: workspaceDir,
          artifacts: ['.webforge/knowledge/parsed/thread-notes.md']
        }
      ]
    });

    await runtimeLogsCommand(undefined, {}, workspaceDir);

    const output = readConsoleOutput();
    expect(output).toContain('Runtime 日志');
    expect(output).toContain('runtime-log-session');
    expect(output).toContain('completed=1');
    expect(output).toContain('日志恢复快照');
    expect(output).toContain('当前工作区恢复快照');
    expect(output).toContain('workflow context: ready (runtime)');
    expect(output).toContain('thread linkage: ready');
    expect(output).toContain('上下文漂移');
    expect(output).toContain('status: aligned');
    expect(output).toContain('事件流');
    expect(output).toContain('before_execute');
    expect(output).toContain('after_execute');
  });

  it('supports json output for a specific runtime session', async () => {
    const manager = new LogManager('runtime', workspaceDir, 'runtime-json-session');
    await manager.addEntry('warning', 'permission_blocked', {
      taskId: 'T900',
      workerId: 'backend',
      metadata: {
        permissionProfile: 'read-only',
        reason: 'read-only permission profile',
        observation: {
          counts: {
            readyTasks: 0,
            blockedTasks: 1,
            pendingReview: 0,
            unreadMessages: 0
          }
        }
      }
    });
    await manager.addEntry('info', 'runtime_completed', {
      metadata: {
        completed: 0,
        failed: 0,
        blocked: 1,
        deliverables: 0
      }
    });
    await manager.end();
    await writeText(
      join(workspaceDir, '.webforge/knowledge/parsed/current-notes.md'),
      '# current notes\n'
    );
    await writeJson(join(workspaceDir, '.webforge/runtime.json'), {
      version: '0.2',
      status: 'idle',
      updatedAt: '2026-03-30T10:06:00.000Z',
      sessionId: 'runtime-current-session',
      phaseId: null,
      taskId: null,
      summary: 'current workspace runtime',
      workflowContext: null
    });
    await writeJson(join(workspaceDir, '.webforge/sessions/index.json'), {
      sessions: [
        {
          id: 'runtime-current-session',
          name: 'Current Workspace Session',
          createdAt: '2026-03-30T10:06:00.000Z',
          created_at: '2026-03-30T10:06:00.000Z',
          lastActive: '2026-03-30T10:06:00.000Z',
          last_active: '2026-03-30T10:06:00.000Z',
          status: 'active',
          workflowContext: {
            workflow: 'strategic-compact',
            runId: 'run-current-001',
            owner: 'superpowers',
            threadId: 'thread-current-001',
            branch: 'feature/current-workspace',
            worktreePath: workspaceDir,
            artifacts: ['.webforge/knowledge/parsed/current-notes.md']
          },
          stats: {
            tasksCompleted: 1,
            totalTasks: 1
          }
        },
        {
          id: 'runtime-json-session',
          name: 'Runtime JSON Session',
          createdAt: '2026-03-30T10:00:00.000Z',
          created_at: '2026-03-30T10:00:00.000Z',
          lastActive: '2026-03-30T10:05:00.000Z',
          last_active: '2026-03-30T10:05:00.000Z',
          status: 'paused',
          workflowContext: {
            workflow: 'gsd-thread',
            runId: 'run-json-001',
            owner: 'superpowers',
            threadId: 'thread-json-001',
            branch: 'feature/json-observation',
            worktreePath: 'tmp/missing-worktree',
            artifacts: ['docs/missing-thread-artifact.md']
          },
          stats: {
            tasksCompleted: 0,
            totalTasks: 1
          }
        }
      ]
    });
    await writeJson(join(workspaceDir, '.webforge/threads.json'), {
      threads: [
        {
          id: 'thread-json-001',
          recordedAt: '2026-03-30T10:05:00.000Z',
          workflow: 'gsd-thread',
          summary: 'json thread',
          runId: 'run-json-001',
          branch: 'feature/json-observation',
          worktreePath: 'tmp/missing-worktree',
          artifacts: ['docs/missing-thread-artifact.md']
        },
        {
          id: 'thread-current-001',
          recordedAt: '2026-03-30T10:06:00.000Z',
          workflow: 'strategic-compact',
          summary: 'current thread',
          runId: 'run-current-001',
          branch: 'feature/current-workspace',
          worktreePath: workspaceDir,
          artifacts: ['.webforge/knowledge/parsed/current-notes.md']
        }
      ]
    });

    await runtimeLogsCommand('runtime-json-session', { json: true }, workspaceDir);

    const payload = JSON.parse(readConsoleOutput());
    expect(payload.sessionId).toBe('runtime-json-session');
    expect(payload.blocked).toBe(1);
    expect(payload.permissionProfile).toBe('read-only');
    expect(payload.workflowContext.source).toBe('session');
    expect(payload.workflowContext.status).toBe('blocked');
    expect(payload.workflowContext.threadId).toBe('thread-json-001');
    expect(payload.threadLinkage.status).toBe('blocked');
    expect(payload.threadLinkage.missingArtifacts).toContain('docs/missing-thread-artifact.md');
    expect(payload.threadLinkage.missingWorktreePath).toBe('tmp/missing-worktree');
    expect(payload.currentWorkflowContext.source).toBe('current');
    expect(payload.currentWorkflowContext.status).toBe('ready');
    expect(payload.currentWorkflowContext.threadId).toBe('thread-current-001');
    expect(payload.currentThreadLinkage.status).toBe('ready');
    expect(payload.currentThreadLinkage.threadId).toBe('thread-current-001');
    expect(payload.contextDrift.status).toBe('drifted');
    expect(payload.contextDrift.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('threadId'),
        expect.stringContaining('worktreePath')
      ])
    );
    expect(payload.events.map((event: { message: string }) => event.message)).toContain(
      'permission_blocked'
    );
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
