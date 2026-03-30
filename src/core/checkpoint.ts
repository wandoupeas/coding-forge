/**
 * 检查点系统
 * 关键节点保存快照，支持回滚
 */

import { writeFile, readFile, copyFile } from 'fs/promises';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { Task, Phase } from '../types/index.js';
import type { Deliverable } from './deliverable.js';
import { ensureDir, readJson, writeJson } from '../utils/file.js';

const CHECKPOINTS_DIR = '.webforge/checkpoints';
const DELIVERABLES_INDEX = '.webforge/deliverables/index.json';
const TASKS_FILE = '.webforge/tasks.json';
const PHASES_FILE = '.webforge/phases.json';

export interface CheckpointDeliverableSnapshot extends Deliverable {
  snapshotPath: string;
}

export interface Checkpoint {
  id: string;
  name: string;
  createdAt: string;
  description?: string;
  tasks: Task[];
  phases: Phase[];
  gitCommit?: string;  // 关联的 Git commit
  deliverables: CheckpointDeliverableSnapshot[];  // 当时的交付物快照
}

/**
 * 创建检查点
 */
export async function createCheckpoint(
  name: string,
  tasks: Task[],
  phases: Phase[],
  options?: {
    description?: string;
    gitCommit?: string;
    basePath?: string;
  }
): Promise<Checkpoint> {
  const basePath = options?.basePath ?? process.cwd();
  const checkpointsDir = join(basePath, CHECKPOINTS_DIR);
  await ensureDir(checkpointsDir);
  const id = createCheckpointId();
  const deliverables = await snapshotDeliverables(basePath, id);

  const checkpoint: Checkpoint = {
    id,
    name,
    createdAt: new Date().toISOString(),
    description: options?.description,
    tasks: JSON.parse(JSON.stringify(tasks)),  // 深拷贝
    phases: JSON.parse(JSON.stringify(phases)),
    gitCommit: options?.gitCommit,
    deliverables
  };

  // 保存检查点
  const checkpointPath = join(checkpointsDir, `${checkpoint.id}.json`);
  await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));

  return checkpoint;
}

function createCheckpointId(): string {
  // Tests and rollback flows may create multiple checkpoints under a frozen clock.
  const suffix = Math.random().toString(36).slice(2, 8);
  return `cp-${Date.now()}-${suffix}`;
}

async function snapshotDeliverables(
  basePath: string,
  checkpointId: string
): Promise<CheckpointDeliverableSnapshot[]> {
  const deliverables = await loadCheckpointDeliverables(basePath);
  if (deliverables.length === 0) {
    return [];
  }

  const snapshots: CheckpointDeliverableSnapshot[] = [];

  for (const deliverable of deliverables) {
    const snapshotRelativePath = buildCheckpointDeliverablePath(checkpointId, deliverable.path);
    const snapshotPath = join(basePath, snapshotRelativePath);
    await ensureDir(dirname(snapshotPath));

    const sourcePath = join(basePath, deliverable.path);
    if (existsSync(sourcePath)) {
      await copyFile(sourcePath, snapshotPath);
    } else if (typeof deliverable.content === 'string') {
      await writeFile(snapshotPath, deliverable.content, 'utf-8');
    } else {
      continue;
    }

    snapshots.push({
      ...deliverable,
      snapshotPath: toPosixPath(snapshotRelativePath)
    });
  }

  return snapshots;
}

async function loadCheckpointDeliverables(basePath: string): Promise<Deliverable[]> {
  const indexPath = join(basePath, DELIVERABLES_INDEX);
  if (!existsSync(indexPath)) {
    return [];
  }

  try {
    const data = await readJson<Deliverable[] | { items?: Deliverable[] }>(indexPath);
    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray(data.items)) {
      return data.items;
    }
    return [];
  } catch {
    return [];
  }
}

function buildCheckpointDeliverablePath(checkpointId: string, deliverablePath: string): string {
  const trimmedPath = deliverablePath.replace(
    /^\.webforge[\\/]+deliverables[\\/]+/,
    ''
  );
  return join(
    CHECKPOINTS_DIR,
    checkpointId,
    'deliverables',
    trimmedPath || deliverablePath.split(/[\\/]/).pop() || 'deliverable'
  );
}

function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/');
}

async function restoreCheckpointDeliverables(
  checkpoint: Checkpoint,
  basePath: string
): Promise<Deliverable[]> {
  const restored: Deliverable[] = [];

  for (const snapshot of checkpoint.deliverables) {
    const targetPath = join(basePath, snapshot.path);
    const snapshotSourcePath = join(basePath, snapshot.snapshotPath);
    await ensureDir(dirname(targetPath));

    if (existsSync(snapshotSourcePath)) {
      await copyFile(snapshotSourcePath, targetPath);
    } else if (typeof snapshot.content === 'string') {
      await writeFile(targetPath, snapshot.content, 'utf-8');
    } else {
      continue;
    }

    const { snapshotPath, ...deliverable } = snapshot;
    restored.push(deliverable);
  }

  await writeJson(join(basePath, DELIVERABLES_INDEX), { items: restored });
  return restored;
}

async function restoreCheckpointGraph(
  checkpoint: Checkpoint,
  basePath: string
): Promise<void> {
  await writeJson(join(basePath, TASKS_FILE), {
    tasks: checkpoint.tasks
  });
  await writeJson(join(basePath, PHASES_FILE), {
    phases: checkpoint.phases
  });
}

/**
 * 列出所有检查点
 */
export async function listCheckpoints(
  basePath: string = process.cwd()
): Promise<Checkpoint[]> {
  const checkpointsDir = join(basePath, CHECKPOINTS_DIR);

  if (!existsSync(checkpointsDir)) {
    return [];
  }

  const { readdir } = await import('fs/promises');
  const files = await readdir(checkpointsDir);
  const checkpoints: Checkpoint[] = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = await readFile(join(checkpointsDir, file), 'utf-8');
        checkpoints.push(JSON.parse(content));
      } catch {
        // 忽略损坏的检查点
      }
    }
  }

  // 按时间倒序
  return checkpoints.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * 加载检查点
 */
export async function loadCheckpoint(
  checkpointId: string,
  basePath: string = process.cwd()
): Promise<Checkpoint | null> {
  const checkpointPath = join(basePath, CHECKPOINTS_DIR, `${checkpointId}.json`);
  
  if (!existsSync(checkpointPath)) {
    return null;
  }

  try {
    const content = await readFile(checkpointPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 回滚到检查点
 */
export async function rollbackToCheckpoint(
  checkpointId: string,
  basePath: string = process.cwd(),
  options?: {
    restoreDeliverables?: boolean;
  }
): Promise<{
  tasks: Task[];
  phases: Phase[];
  deliverables?: Deliverable[];
} | null> {
  const checkpoint = await loadCheckpoint(checkpointId, basePath);
  
  if (!checkpoint) {
    return null;
  }

  // 创建回滚记录
  const { createCheckpoint } = await import('./checkpoint.js');
  await createCheckpoint(
    `Rollback from ${checkpoint.name}`,
    checkpoint.tasks,
    checkpoint.phases,
    {
      description: `Auto-created before rollback to ${checkpointId}`,
      basePath
    }
  );

  await restoreCheckpointGraph(checkpoint, basePath);

  const restoredDeliverables = options?.restoreDeliverables
    ? await restoreCheckpointDeliverables(checkpoint, basePath)
    : undefined;

  return {
    tasks: checkpoint.tasks,
    phases: checkpoint.phases,
    deliverables: restoredDeliverables
  };
}

/**
 * 删除检查点
 */
export async function deleteCheckpoint(
  checkpointId: string,
  basePath: string = process.cwd()
): Promise<boolean> {
  const checkpointPath = join(basePath, CHECKPOINTS_DIR, `${checkpointId}.json`);
  
  if (!existsSync(checkpointPath)) {
    return false;
  }

  try {
    const { unlink } = await import('fs/promises');
    await unlink(checkpointPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 自动在关键节点创建检查点
 */
export async function autoCheckpoint(
  tasks: Task[],
  phases: Phase[],
  basePath: string = process.cwd()
): Promise<void> {
  // 检查是否应该创建检查点
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;
  
  // 每完成 25% 创建一个检查点
  const milestones = [0.25, 0.5, 0.75];
  
  for (const milestone of milestones) {
    const targetCount = Math.floor(totalCount * milestone);
    if (completedCount === targetCount && completedCount > 0) {
      const phase = phases.find(p => p.status === 'in_progress');
      await createCheckpoint(
        `Phase ${phase?.name || 'Milestone'} ${milestone * 100}%`,
        tasks,
        phases,
        {
          description: `Auto-checkpoint at ${completedCount}/${totalCount} tasks`,
          basePath
        }
      );
      break;
    }
  }
}
