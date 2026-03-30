import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Agent, reviewTaskDeliverables as reviewAgentDeliverables } from '../../agent/index.js';
import { summarizeExecutionContext } from '../../agent/context.js';
import { buildExecutionContext } from '../../core/context.js';
import { createWorkspace, loadWorkspaceState } from '../../core/workspace.js';
import {
  Worker,
  WorkerManager,
  inferWorkerForTask,
  reviewTaskDeliverables as reviewWorkerDeliverables
} from '../../core/worker.js';
import { TaskManager } from '../../core/task.js';
import { loadConfig, saveConfig } from '../../utils/config.js';

describe('agent and worker adapters', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-agent-worker-'));
    await createWorkspace(workspaceDir, { projectName: 'agent-worker' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('summarizes execution context and delegates agent execution to its handler', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeFile(
      workspace.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: 'agent task',
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

    const reloaded = await loadWorkspaceState(workspaceDir);
    const context = {
      workspace: {
        basePath: workspaceDir,
        paths: reloaded.paths
      },
      runtime: reloaded.runtime,
      task: reloaded.tasks.tasks[0],
      phase: reloaded.phases.phases[0],
      knowledge: {
        items: [],
        requirements: [],
        design: [],
        decisions: [],
        parsed: [],
        notes: []
      },
      deliverables: {
        items: [],
        task: []
      },
      sessions: {
        items: [],
        active: null,
        related: []
      },
      superpowers: {
        enabled: false,
        requiredSkills: [],
        taskSkills: [],
        executionMode: null,
        suggestedWorkflow: null,
        capabilities: []
      },
      permissions: {
        profile: 'workspace-write',
        canWriteWorkspace: true,
        requiresApproval: false,
        allowedActions: ['read:workspace', 'write:workspace', 'mutate:state'],
        blockedActions: ['external:side-effects']
      },
      observation: {
        counts: {
          readyTasks: 1,
          blockedTasks: 0,
          pendingReview: 0,
          unreadMessages: 0,
          knowledgeItems: 0,
          taskDeliverables: 0,
          relatedSessions: 0
        },
        readyTaskIds: ['T001'],
        blockedTaskIds: [],
        pendingReviewIds: [],
        workersWithUnread: [],
        mailbox: {
          workerId: null,
          unreadForWorker: 0
        }
      }
    };

    const handler = {
      execute: vi.fn(async () => ({
        success: true,
        summary: 'handled',
        needsReview: false
      }))
    };
    const agent = new Agent(
      {
        name: 'Test Agent',
        role: 'backend',
        systemPrompt: 'test',
        skills: ['node'],
        runtimeProfile: {
          provider: 'stub',
          permissionProfile: 'workspace-write'
        }
      },
      handler
    );

    const result = await agent.execute({
      task: reloaded.tasks.tasks[0],
      context
    });

    expect(result.summary).toBe('handled');
    expect(handler.execute).toHaveBeenCalledTimes(1);
    expect(summarizeExecutionContext(context)).toContain('task=T001');
    expect(summarizeExecutionContext(context)).toContain('permission=workspace-write');
  });

  it('covers worker role inference, execution, and manager helpers', async () => {
    expect(inferWorkerForTask({ title: '编写测试用例' } as any)).toBe('qa');
    expect(inferWorkerForTask({ title: '部署生产环境' } as any)).toBe('devops');
    expect(inferWorkerForTask({ title: '前端页面实现' } as any)).toBe('frontend');
    expect(inferWorkerForTask({ title: '需求分析' } as any)).toBe('pm');
    expect(inferWorkerForTask({ title: '系统架构设计' } as any)).toBe('tech-lead');
    expect(inferWorkerForTask({ title: '数据库迁移' } as any)).toBe('backend');

    const workspace = await loadWorkspaceState(workspaceDir);
    await writeFile(
      workspace.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: '实现后端接口',
              status: 'ready',
              assignee: '',
              depends_on: [],
              priority: 1,
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            },
            {
              id: 'T002',
              phase: 'P1',
              title: '执行测试',
              status: 'ready',
              assignee: 'backend',
              depends_on: [],
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

    const taskManager = new TaskManager(workspaceDir);
    await taskManager.load();

    const config = await loadConfig(workspaceDir);
    config.agent = {
      provider: 'codex',
      fallback_provider: 'stub',
      permission_profile: 'approval-required',
      command: '/tmp/webforge-missing-codex'
    };
    await saveConfig(config, workspaceDir);

    const worker = new Worker('backend', taskManager, workspaceDir);
    await worker.init();
    expect(worker.getId()).toBe('backend');
    expect(worker.getRole()).toBe('backend');
    expect(worker.getName()).toBe('Backend Developer');
    expect(worker.getMailbox()).toBeDefined();
    expect(worker.getAdapterProvider()).toBe('codex');

    const executionResult = await worker.executeTask(taskManager.getTask('T002')!);
    expect(executionResult.success).toBe(true);

    const adapterResult = await worker.execute({
      task: taskManager.getTask('T002')!,
      context: await buildExecutionContext(workspaceDir, 'T002')
    });
    expect(adapterResult.metadata).toMatchObject({
      adapterProvider: 'codex',
      adapterMode: 'bridge-fallback',
      permissionProfile: 'approval-required'
    });

    const manager = new WorkerManager(taskManager, workspaceDir);
    await manager.registerWorker('backend');
    expect(manager.getWorker('backend')).toBeDefined();
    expect(manager.getAllWorkers()).toHaveLength(1);

    await manager.assignTasks();
    await taskManager.load();
    expect(taskManager.getTask('T001')?.status).toBe('in_progress');

    await taskManager.updateTaskStatus('T001', 'ready');
    const round = await manager.executeRound();
    expect(round.completed).toBe(2);
    expect(round.failed).toBe(0);
  });

  it('renders deliverable review output for both agent and worker helpers', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    await writeFile(
      workspace.paths.deliverablesIndex,
      JSON.stringify(
        {
          items: [
            {
              id: 'del-001',
              taskId: 'T100',
              type: 'document',
              title: 'Spec',
              path: '.webforge/deliverables/del-001.md',
              createdBy: 'backend',
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

    await reviewAgentDeliverables('missing-task', workspaceDir);
    expect(vi.mocked(console.log).mock.calls.flat().map(String).join('\n')).toContain(
      '该任务没有交付物需要审核'
    );

    vi.mocked(console.log).mockClear();
    await reviewWorkerDeliverables('T100', workspaceDir);
    const output = vi.mocked(console.log).mock.calls.flat().map(String).join('\n');
    expect(output).toContain('Spec');
    expect(output).toContain('pending_review');
  });
});
