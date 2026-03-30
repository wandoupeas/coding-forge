/**
 * 交付物管理模块
 * 管理 Worker 产生的可交付物（文档、代码、设计等）
 */

import { writeText, readText, readJson, writeJson } from '../utils/file.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { withFileLock } from '../utils/lock.js';

export type DeliverableType = 
  | 'document'    // PRD、设计文档等
  | 'code'        // 源代码
  | 'test'        // 测试用例
  | 'config'      // 配置文件
  | 'design'      // 设计稿
  | 'review';     // 评审意见

export interface Deliverable {
  id: string;
  taskId: string;
  type: DeliverableType;
  title: string;
  content: string;
  path: string;           // 存储路径
  createdBy: string;      // Worker ID
  createdAt: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  reviewComment?: string;
}

interface DeliverableIndex {
  items: Deliverable[];
}

const DELIVERABLES_DIR = '.webforge/deliverables';
const DELIVERABLES_INDEX = '.webforge/deliverables/index.json';
const DELIVERABLES_LOCK = '.webforge/deliverables/index.lock';

/**
 * 创建交付物
 */
export async function createDeliverable(
  taskId: string,
  type: DeliverableType,
  title: string,
  content: string,
  createdBy: string,
  basePath?: string
): Promise<Deliverable> {
  const id = `del-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();
  
  // 确定文件扩展名
  const ext = type === 'code' ? 'ts' : 
              type === 'config' ? 'yaml' : 
              type === 'test' ? 'test.ts' : 'md';
  
  const filename = `${id}.${ext}`;
  const filePath = join(DELIVERABLES_DIR, filename);
  
  // 保存文件
  await writeText(resolveDeliverablePath(basePath, filePath), content);
  
  const deliverable: Deliverable = {
    id,
    taskId,
    type,
    title,
    content,
    path: filePath,
    createdBy,
    createdAt: timestamp,
    status: 'pending_review'  // 默认需要人工审核
  };
  
  // 更新索引
  await addToIndex(deliverable, basePath);
  
  return deliverable;
}

/**
 * 获取交付物内容
 */
export async function getDeliverableContent(
  deliverableId: string,
  basePath?: string
): Promise<string | null> {
  try {
    const index = await loadIndex(basePath);
    const del = index.items.find(d => d.id === deliverableId);
    if (!del) return null;
    
    const contentPath = resolveDeliverablePath(basePath, del.path);
    if (existsSync(contentPath)) {
      return await readText(contentPath);
    }
    return del.content; // 回退到内存中的内容
  } catch {
    return null;
  }
}

/**
 * 审核交付物
 */
export async function reviewDeliverable(
  deliverableId: string,
  approved: boolean,
  comment?: string,
  basePath?: string
): Promise<void> {
  await withFileLock(resolveDeliverablePath(basePath, DELIVERABLES_LOCK), async () => {
    const index = await loadIndex(basePath);
    const del = index.items.find(d => d.id === deliverableId);

    if (del) {
      del.status = approved ? 'approved' : 'rejected';
      del.reviewComment = comment;
      await saveIndex(index, basePath);
    }
  });
}

/**
 * 列出任务的所有交付物
 */
export async function listDeliverables(
  taskId?: string,
  basePath?: string
): Promise<Deliverable[]> {
  const index = await loadIndex(basePath);
  if (taskId) {
    return index.items.filter(d => d.taskId === taskId);
  }
  return index.items;
}

/**
 * 加载索引
 */
async function loadIndex(basePath?: string): Promise<DeliverableIndex> {
  try {
    const indexPath = resolveDeliverablePath(basePath, DELIVERABLES_INDEX);
    if (!existsSync(indexPath)) {
      return { items: [] };
    }
    const data = await readJson<Deliverable[] | DeliverableIndex>(indexPath);
    if (Array.isArray(data)) {
      return { items: data };
    }
    if (data && Array.isArray(data.items)) {
      return { items: data.items };
    }
    return { items: [] };
  } catch {
    return { items: [] };
  }
}

/**
 * 保存索引
 */
async function saveIndex(index: DeliverableIndex, basePath?: string): Promise<void> {
  await writeJson(resolveDeliverablePath(basePath, DELIVERABLES_INDEX), index);
}

/**
 * 添加到索引
 */
async function addToIndex(deliverable: Deliverable, basePath?: string): Promise<void> {
  await withFileLock(resolveDeliverablePath(basePath, DELIVERABLES_LOCK), async () => {
    const index = await loadIndex(basePath);
    index.items.push(deliverable);
    await saveIndex(index, basePath);
  });
}

function resolveDeliverablePath(basePath: string | undefined, relativePath: string): string {
  return basePath ? join(basePath, relativePath) : relativePath;
}
