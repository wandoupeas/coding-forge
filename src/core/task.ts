/**
 * 任务系统核心模块
 * 负责任务图、状态流转和阶段进度
 */

import { Phase, Task, TaskStatus } from '../types/index.js';
import { join } from 'path';
import { readJson, writeJson } from '../utils/file.js';

const TASKS_FILE = '.webforge/tasks.json';
const PHASES_FILE = '.webforge/phases.json';

export class TaskManager {
  private readonly tasks: Map<string, Task> = new Map();
  private readonly phases: Map<string, Phase> = new Map();
  private readonly basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  async load(): Promise<void> {
    this.tasks.clear();
    this.phases.clear();

    try {
      const tasksData = await readJson<{ tasks: Task[] }>(join(this.basePath, TASKS_FILE));
      for (const task of tasksData.tasks) {
        this.tasks.set(task.id, task);
      }
    } catch {
      // keep empty state
    }

    try {
      const phasesData = await readJson<{ phases: Phase[] }>(join(this.basePath, PHASES_FILE));
      for (const phase of phasesData.phases) {
        this.phases.set(phase.id, phase);
      }
    } catch {
      // keep empty state
    }
  }

  async save(): Promise<void> {
    await writeJson(join(this.basePath, TASKS_FILE), {
      tasks: this.getAllTasks()
    });
    await writeJson(join(this.basePath, PHASES_FILE), {
      phases: this.getAllPhases()
    });
  }

  createTask(taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Task {
    const now = new Date().toISOString();
    const id = this.generateTaskId();
    const status =
      taskData.status === 'pending' && !taskData.depends_on?.length
        ? 'ready'
        : taskData.status;

    const task: Task = {
      ...taskData,
      id,
      status,
      created_at: now,
      updated_at: now
    };

    this.tasks.set(id, task);
    return task;
  }

  createPhase(phaseData: Omit<Phase, 'created_at' | 'updated_at' | 'progress'>): Phase {
    const now = new Date().toISOString();
    const phase: Phase = {
      ...phaseData,
      progress: 0,
      created_at: now,
      updated_at: now
    };

    this.phases.set(phase.id, phase);
    return phase;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getPhase(id: string): Phase | undefined {
    return this.phases.get(id);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values()).sort((left, right) =>
      left.id.localeCompare(right.id)
    );
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return this.getAllTasks().filter((task) => task.status === status);
  }

  getReadyTasks(options?: { limit?: number }): Task[] {
    const readyTasks = this.getTasksByStatus('ready').sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      const createdAtDiff =
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return left.id.localeCompare(right.id);
    });

    if (options?.limit === undefined) {
      return readyTasks;
    }

    return readyTasks.slice(0, options.limit);
  }

  getTasksByPhase(phaseId: string): Task[] {
    return this.getAllTasks().filter((task) => task.phase === phaseId);
  }

  getAllPhases(): Phase[] {
    return Array.from(this.phases.values()).sort((left, right) =>
      left.id.localeCompare(right.id)
    );
  }

  async claimTask(taskId: string, workerId: string): Promise<Task | undefined> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'ready') {
      return undefined;
    }

    task.status = 'in_progress';
    task.assignee = workerId;
    task.updated_at = new Date().toISOString();

    await this.save();
    return task;
  }

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    metadata?: Record<string, any>
  ): Promise<Task | undefined> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    task.status = status;
    task.updated_at = new Date().toISOString();

    if (status === 'completed' || status === 'failed') {
      task.completed_at = task.updated_at;
    }

    if (metadata) {
      task.metadata = { ...task.metadata, ...metadata };
    }

    if (status === 'completed') {
      await this.checkDependentTasks(taskId);
      await this.updatePhaseProgress(task.phase);
      return task;
    }

    await this.save();
    return task;
  }

  checkDependencies(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || !task.depends_on?.length) {
      return true;
    }

    return task.depends_on.every((dependencyId) => {
      const dependency = this.tasks.get(dependencyId);
      return dependency?.status === 'completed';
    });
  }

  async checkPhaseDependencies(completedPhaseId: string): Promise<void> {
    for (const phase of this.phases.values()) {
      if (!phase.depends_on?.includes(completedPhaseId) || !this.isPhaseReady(phase.id)) {
        continue;
      }

      for (const task of this.tasks.values()) {
        if (
          task.phase === phase.id &&
          task.status === 'pending' &&
          task.depends_on.length === 0
        ) {
          task.status = 'ready';
          task.updated_at = new Date().toISOString();
        }
      }
    }

    await this.save();
  }

  async updatePhaseProgress(phaseId: string): Promise<void> {
    const phase = this.phases.get(phaseId);
    if (!phase) {
      return;
    }

    const phaseTasks = this.getTasksByPhase(phaseId);
    if (phaseTasks.length === 0) {
      return;
    }

    const completedCount = phaseTasks.filter((task) => task.status === 'completed').length;
    phase.progress = Math.round((completedCount / phaseTasks.length) * 100);
    phase.updated_at = new Date().toISOString();

    const wasCompleted = phase.status === 'completed';
    if (phase.progress === 100) {
      phase.status = 'completed';
      phase.completed_at = phase.updated_at;
      if (!wasCompleted) {
        await this.checkPhaseDependencies(phaseId);
        return;
      }
    } else if (phase.progress > 0) {
      phase.status = 'in_progress';
    }

    await this.save();
  }

  isPhaseReady(phaseId: string): boolean {
    const phase = this.phases.get(phaseId);
    if (!phase || !phase.depends_on?.length) {
      return true;
    }

    return phase.depends_on.every((dependencyId) => {
      const dependency = this.phases.get(dependencyId);
      return dependency?.status === 'completed';
    });
  }

  getStats(): {
    total: number;
    pending: number;
    ready: number;
    inProgress: number;
    completed: number;
    failed: number;
    blocked: number;
  } {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      pending: tasks.filter((task) => task.status === 'pending').length,
      ready: tasks.filter((task) => task.status === 'ready').length,
      inProgress: tasks.filter((task) => task.status === 'in_progress').length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      failed: tasks.filter((task) => task.status === 'failed').length,
      blocked: tasks.filter((task) => task.status === 'blocked').length
    };
  }

  private async checkDependentTasks(completedTaskId: string): Promise<void> {
    for (const task of this.tasks.values()) {
      if (
        task.depends_on?.includes(completedTaskId) &&
        task.status === 'pending' &&
        this.checkDependencies(task.id)
      ) {
        task.status = 'ready';
        task.updated_at = new Date().toISOString();
      }
    }
  }

  private generateTaskId(): string {
    const existing = Array.from(this.tasks.keys())
      .map((id) => Number.parseInt(id.replace('T', ''), 10))
      .filter((id) => !Number.isNaN(id));
    const max = existing.length > 0 ? Math.max(...existing) : 0;

    return `T${String(max + 1).padStart(3, '0')}`;
  }
}

export const taskManager = new TaskManager();
