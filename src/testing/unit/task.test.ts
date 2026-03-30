/**
 * 任务系统单元测试
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { TaskManager } from '../../core/task.js';

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-task-'));
    taskManager = new TaskManager(workspaceDir);
  });

  afterEach(async () => {
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  describe('Task Creation', () => {
    it('应该创建任务并自动生成 ID', () => {
      const task = taskManager.createTask({
        phase: 'P1',
        title: '测试任务',
        status: 'pending',
        assignee: 'backend',
        depends_on: [],
        priority: 1
      });

      expect(task.id).toMatch(/^T\d{3}$/);
      expect(task.title).toBe('测试任务');
    });

    it('无依赖的任务应该自动变为 ready 状态', () => {
      const task = taskManager.createTask({
        phase: 'P1',
        title: '测试任务',
        status: 'pending',
        assignee: 'backend',
        depends_on: [],
        priority: 1
      });

      expect(task.status).toBe('ready');
    });

    it('应该创建带有依赖的任务', () => {
      const task1 = taskManager.createTask({
        phase: 'P1',
        title: '任务1',
        status: 'pending',
        assignee: 'backend',
        depends_on: [],
        priority: 1
      });

      const task2 = taskManager.createTask({
        phase: 'P1',
        title: '任务2',
        status: 'pending',
        assignee: 'backend',
        depends_on: [task1.id],
        priority: 1
      });

      expect(task2.depends_on).toContain(task1.id);
    });
  });

  describe('Status Transitions', () => {
    it('ready -> in_progress (被认领)', async () => {
      const task = taskManager.createTask({
        phase: 'P1',
        title: '测试',
        status: 'ready',
        assignee: 'backend',
        depends_on: [],
        priority: 1
      });

      const claimed = await taskManager.claimTask(task.id, 'backend');
      expect(claimed?.status).toBe('in_progress');
      expect(claimed?.assignee).toBe('backend');
    });

    it('in_progress -> completed 时会解锁依赖任务', async () => {
      const task1 = taskManager.createTask({
        phase: 'P1',
        title: '先执行任务',
        status: 'ready',
        assignee: 'backend',
        depends_on: [],
        priority: 1
      });
      const task2 = taskManager.createTask({
        phase: 'P1',
        title: '依赖任务',
        status: 'pending',
        assignee: 'qa',
        depends_on: [task1.id],
        priority: 2
      });

      await taskManager.claimTask(task1.id, 'backend');
      const updated = await taskManager.updateTaskStatus(task1.id, 'completed');

      expect(updated?.status).toBe('completed');
      expect(updated?.completed_at).toBeDefined();
      expect(taskManager.getTask(task2.id)?.status).toBe('ready');
    });
  });

  describe('Ready Task Queries', () => {
    it('应该按优先级和创建顺序返回 ready 任务', () => {
      taskManager.createTask({
        phase: 'P1',
        title: '较低优先级',
        status: 'ready',
        assignee: 'backend',
        depends_on: [],
        priority: 3
      });
      const highPriority = taskManager.createTask({
        phase: 'P1',
        title: '较高优先级',
        status: 'ready',
        assignee: 'backend',
        depends_on: [],
        priority: 1
      });
      taskManager.createTask({
        phase: 'P1',
        title: '未就绪任务',
        status: 'pending',
        assignee: 'backend',
        depends_on: ['T999'],
        priority: 0
      });

      const readyTasks = taskManager.getReadyTasks();

      expect(readyTasks.map((task) => task.id)).toEqual([
        highPriority.id,
        'T001'
      ]);
    });

    it('应该支持限制 ready 任务数量', () => {
      taskManager.createTask({
        phase: 'P1',
        title: '任务1',
        status: 'ready',
        assignee: 'backend',
        depends_on: [],
        priority: 1
      });
      const second = taskManager.createTask({
        phase: 'P1',
        title: '任务2',
        status: 'ready',
        assignee: 'backend',
        depends_on: [],
        priority: 2
      });

      const readyTasks = taskManager.getReadyTasks({ limit: 1 });

      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0]?.id).not.toBe(second.id);
    });
  });

  describe('Statistics', () => {
    it('应该正确统计任务数量', () => {
      taskManager.createTask({
        phase: 'P1',
        title: '任务1',
        status: 'completed',
        assignee: 'backend',
        depends_on: [],
        priority: 1
      });

      taskManager.createTask({
        phase: 'P1',
        title: '任务2',
        status: 'in_progress',
        assignee: 'backend',
        depends_on: [],
        priority: 1
      });

      const stats = taskManager.getStats();
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.inProgress).toBe(1);
    });
  });
});
