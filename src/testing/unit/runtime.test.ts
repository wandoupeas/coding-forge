import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace, loadWorkspaceState } from '../../core/workspace.js';
import type { AgentExecutionInput, AgentExecutionResult } from '../../agent/context.js';
import { getLog } from '../../core/logger.js';
import { Mailbox } from '../../core/mailbox.js';
import { runReadyTasks } from '../../core/runtime.js';
import { loadConfig, saveConfig } from '../../utils/config.js';

describe('runtime loop', () => {
  let workspaceDir = '';

  afterEach(async () => {
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('claims ready tasks, builds context, persists deliverables, and unlocks dependents', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-runtime-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-loop' });

    await writeFile(
      state.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: '设计运行时主循环',
              description: '实现 runtime loop',
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
                runId: 'spr-plan-001',
                owner: 'pm',
                waveId: 'wave-1',
                threadId: 'thread-42',
                branch: 'feature/runtime-loop',
                worktreePath: '.worktrees/runtime-loop',
                artifacts: ['docs/superpowers/plans/runtime-loop.md']
              }
            },
            {
              id: 'T002',
              phase: 'P1',
              title: '补充后续任务',
              status: 'pending',
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

    const execute = vi.fn<
      [AgentExecutionInput],
      Promise<AgentExecutionResult>
    >(async ({ task, context }) => ({
      success: true,
      summary: `completed ${task.id} in ${context.phase.id}`,
      needsReview: true,
      metadata: {
        adapterProvider: 'custom-test'
      },
      deliverables: [
        {
          type: 'document',
          title: `${task.title} 交付物`,
          content: `# ${task.title}\n\nphase=${context.phase.id}`
        }
      ]
    }));

    const result = await runReadyTasks(workspaceDir, {
      createAgent: () => ({ execute }),
      limit: 1,
      sessionId: 'runtime-test-session'
    });

    expect(result).toMatchObject({
      processed: 1,
      completed: 1,
      failed: 0,
      blocked: 0,
      deliverables: 1
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0].task.id).toBe('T001');
    expect(execute.mock.calls[0]?.[0].context.task.id).toBe('T001');
    expect(execute.mock.calls[0]?.[0].context.superpowers).toMatchObject({
      enabled: true,
      executionMode: 'subagent',
      taskSkills: ['backend-patterns'],
      suggestedWorkflow: 'brainstorming'
    });
    expect(execute.mock.calls[0]?.[0].context.workflowContext).toMatchObject({
      workflow: 'writing-plans',
      runId: 'spr-plan-001',
      branch: 'feature/runtime-loop',
      waveId: 'wave-1',
      threadId: 'thread-42'
    });
    expect(execute.mock.calls[0]?.[0].context.permissions).toMatchObject({
      profile: 'workspace-write',
      canWriteWorkspace: true,
      requiresApproval: false
    });
    expect(execute.mock.calls[0]?.[0].context.observation.counts.readyTasks).toBe(0);

    const updatedState = await loadWorkspaceState(workspaceDir);
    expect(updatedState.tasks.tasks.find((task) => task.id === 'T001')).toMatchObject({
      status: 'completed',
      metadata: {
        agent_summary: 'completed T001 in P1',
        agent_metadata: {
          adapterProvider: 'custom-test',
          harness: {
            permissionProfile: 'workspace-write',
            executionMode: 'subagent',
            taskSkills: ['backend-patterns'],
            suggestedWorkflow: 'brainstorming',
            observation: {
              readyTasks: 0,
              blockedTasks: 0,
              pendingReview: 0
            }
          }
        }
      }
    });
    expect(updatedState.tasks.tasks.find((task) => task.id === 'T002')?.status).toBe('ready');
    expect(updatedState.indexes.deliverables).toHaveLength(1);
    expect(updatedState.runtime).toMatchObject({
      status: 'idle',
      taskId: null,
      summary: 'Processed 1 task(s): 1 completed, 0 failed, 0 blocked',
      workflowContext: {
        workflow: 'writing-plans',
        runId: 'spr-plan-001',
        branch: 'feature/runtime-loop',
        waveId: 'wave-1',
        threadId: 'thread-42'
      }
    });
    const log = await getLog('runtime-test-session', workspaceDir);
    expect(log?.entries.map((entry) => entry.message)).toEqual([
      'before_execute',
      'after_execute',
      'runtime_completed'
    ]);
    expect(log?.entries[0]?.metadata).toMatchObject({
      phaseId: 'P1',
      permissionProfile: 'workspace-write',
      superpowers: {
        taskSkills: ['backend-patterns']
      }
    });

    const sessionIndex = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'sessions', 'index.json'), 'utf-8')
    ) as { sessions: Array<Record<string, unknown>> };
    expect(sessionIndex.sessions[0]).toMatchObject({
      id: 'runtime-test-session',
      currentTask: 'T001',
      currentPhase: 'P1',
      workflowContext: {
        workflow: 'writing-plans',
        runId: 'spr-plan-001',
        branch: 'feature/runtime-loop',
        waveId: 'wave-1',
        threadId: 'thread-42'
      }
    });

    const sessionSnapshot = JSON.parse(
      await readFile(join(workspaceDir, '.webforge', 'sessions', 'runtime-test-session.json'), 'utf-8')
    ) as {
      session: Record<string, unknown>;
    };
    expect(sessionSnapshot.session.workflowContext).toMatchObject({
      workflow: 'writing-plans',
      runId: 'spr-plan-001',
      branch: 'feature/runtime-loop',
      waveId: 'wave-1',
      threadId: 'thread-42'
    });

    const reviewerMailbox = new Mailbox('reviewer', workspaceDir);
    await reviewerMailbox.init();
    const approvalRequests = await reviewerMailbox.receive({ unreadOnly: true, limit: 10 });
    expect(approvalRequests).toHaveLength(1);
    expect(approvalRequests[0]).toMatchObject({
      from: 'backend',
      to: 'reviewer',
      type: 'approval_request',
      task_id: 'T001'
    });
    expect(approvalRequests[0]?.metadata).toMatchObject({
      taskId: 'T001',
      deliverableType: 'document'
    });
  });

  it('marks task failed when agent execution fails', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-runtime-fail-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-loop-fail' });

    await writeFile(
      state.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: '失败任务',
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

    const result = await runReadyTasks(workspaceDir, {
      createAgent: () => ({
        execute: vi.fn(async () => ({
          success: false,
          summary: 'failed T001',
          needsReview: false,
          error: 'agent failed',
          metadata: {
            adapterProvider: 'custom-test'
          }
        }))
      }),
      sessionId: 'runtime-failure-session'
    });

    expect(result).toMatchObject({
      processed: 1,
      completed: 0,
      failed: 1,
      blocked: 0,
      deliverables: 0
    });

    const updatedState = await loadWorkspaceState(workspaceDir);
    expect(updatedState.tasks.tasks[0]).toMatchObject({
      status: 'failed',
      metadata: {
        error: 'agent failed',
        agent_summary: 'failed T001',
        agent_metadata: {
          adapterProvider: 'custom-test'
        }
      }
    });
    expect(updatedState.runtime).toMatchObject({
      status: 'idle',
      taskId: null,
      summary: 'Processed 1 task(s): 0 completed, 1 failed, 0 blocked'
    });
  });

  it('does not emit approval requests when deliverables do not require review', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-runtime-no-review-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-no-review' });

    await writeFile(
      state.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: '无需审核任务',
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

    await runReadyTasks(workspaceDir, {
      createAgent: () => ({
        execute: vi.fn(async () => ({
          success: true,
          summary: 'completed T001',
          needsReview: false,
          deliverables: [
            {
              type: 'document',
              title: '无需审核交付物',
              content: '# no review'
            }
          ]
        }))
      }),
      sessionId: 'runtime-no-review-session'
    });

    const reviewerMailbox = new Mailbox('reviewer', workspaceDir);
    await reviewerMailbox.init();
    await expect(reviewerMailbox.receive({ unreadOnly: true, limit: 10 })).resolves.toEqual([]);
  });

  it('forces approval requests when the permission profile requires approval', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-runtime-approval-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-approval' });
    const config = await loadConfig(workspaceDir);
    config.agent = {
      provider: 'stub',
      fallback_provider: 'stub',
      permission_profile: 'approval-required'
    };
    await saveConfig(config, workspaceDir);

    await writeFile(
      state.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: '需要审批边界的任务',
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

    const result = await runReadyTasks(workspaceDir, {
      createAgent: () => ({
        execute: vi.fn(async () => ({
          success: true,
          summary: 'completed T001',
          needsReview: false,
          deliverables: [
            {
              type: 'document',
              title: '审批边界交付物',
              content: '# review me'
            }
          ]
        }))
      }),
      sessionId: 'runtime-approval-session'
    });

    expect(result).toMatchObject({
      processed: 1,
      completed: 1,
      failed: 0,
      blocked: 0,
      deliverables: 1
    });

    const reviewerMailbox = new Mailbox('reviewer', workspaceDir);
    await reviewerMailbox.init();
    const requests = await reviewerMailbox.receive({ unreadOnly: true, limit: 10 });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.type).toBe('approval_request');
  });

  it('blocks ready tasks when runtime is running under a read-only profile', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-runtime-readonly-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-readonly' });
    const config = await loadConfig(workspaceDir);
    config.agent = {
      provider: 'stub',
      fallback_provider: 'stub',
      permission_profile: 'read-only'
    };
    await saveConfig(config, workspaceDir);

    await writeFile(
      state.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: '只读环境中的任务',
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

    const execute = vi.fn(async () => ({
      success: true,
      summary: 'should not execute',
      needsReview: false
    }));

    const result = await runReadyTasks(workspaceDir, {
      createAgent: () => ({ execute }),
      sessionId: 'runtime-readonly-session'
    });

    expect(result).toMatchObject({
      processed: 1,
      completed: 0,
      failed: 0,
      blocked: 1,
      deliverables: 0
    });
    expect(execute).not.toHaveBeenCalled();

    const updatedState = await loadWorkspaceState(workspaceDir);
    expect(updatedState.tasks.tasks[0]).toMatchObject({
      status: 'blocked',
      metadata: {
        blocked_reason: 'read-only permission profile',
        required_permission: 'workspace-write',
        agent_metadata: {
          adapterMode: 'permission-blocked',
          harness: {
            permissionProfile: 'read-only'
          }
        }
      }
    });
    expect(updatedState.runtime).toMatchObject({
      status: 'blocked',
      summary: 'Processed 1 task(s): 0 completed, 0 failed, 1 blocked'
    });

    const log = await getLog('runtime-readonly-session', workspaceDir);
    expect(log?.entries.map((entry) => entry.message)).toEqual([
      'before_execute',
      'permission_blocked',
      'runtime_completed'
    ]);
    expect(log?.entries[1]?.metadata).toMatchObject({
      reason: 'read-only permission profile',
      permissionProfile: 'read-only'
    });
  });
});
