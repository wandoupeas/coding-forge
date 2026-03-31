import { readFile } from 'fs/promises';
import { join, relative, resolve } from 'path';
import { loadWorkspaceState } from '../../core/workspace.js';
import type {
  WorkspaceDeliverableIndexEntry,
  WorkspaceKnowledgeEntryType,
  WorkspaceSessionStatus
} from '../../types/index.js';

export interface KnowledgeSummary {
  total: number;
  byType: Record<WorkspaceKnowledgeEntryType, number>;
  items: Array<{
    id: string;
    type: WorkspaceKnowledgeEntryType;
    title: string;
    path: string;
    updatedAt: string;
    preview: string | null;
  }>;
}

export interface DeliverablesSummary {
  total: number;
  pendingReview: number;
  byStatus: Record<WorkspaceDeliverableIndexEntry['status'], number>;
  items: Array<{
    id: string;
    taskId: string;
    title: string;
    type: WorkspaceDeliverableIndexEntry['type'];
    status: WorkspaceDeliverableIndexEntry['status'];
    path: string;
    createdAt: string;
    createdBy: string;
    preview: string | null;
  }>;
}

export interface SessionsSummary {
  total: number;
  byStatus: Record<WorkspaceSessionStatus, number>;
  latest: {
    id: string;
    name: string;
    status: WorkspaceSessionStatus;
    lastActive: string;
    currentTask: string | null;
    currentPhase: string | null;
    preview: string | null;
  } | null;
  items: Array<{
    id: string;
    name: string;
    status: WorkspaceSessionStatus;
    lastActive: string;
    currentTask: string | null;
    currentPhase: string | null;
    preview: string | null;
  }>;
}

export interface ArtifactsReadModel {
  knowledge: KnowledgeSummary;
  deliverables: DeliverablesSummary;
  sessions: SessionsSummary;
}

export async function buildArtifactsReadModel(
  basePath: string = process.cwd()
): Promise<ArtifactsReadModel> {
  const workspace = await loadWorkspaceState(basePath);
  const knowledgeItems = [...workspace.indexes.knowledge].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
  const deliverableItems = [...workspace.indexes.deliverables].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
  const sessionItems = [...workspace.indexes.sessions].sort((left, right) =>
    right.lastActive.localeCompare(left.lastActive)
  );
  const knowledgeSummaries = await Promise.all(
    knowledgeItems.map(async (item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      path: item.path,
      updatedAt: item.updatedAt,
      preview: await readArtifactPreview(basePath, item.path)
    }))
  );
  const deliverableSummaries = await Promise.all(
    deliverableItems.map(async (item) => ({
      id: item.id,
      taskId: item.taskId,
      title: item.title,
      type: item.type,
      status: item.status,
      path: item.path,
      createdAt: item.createdAt,
      createdBy: item.createdBy,
      preview: await readArtifactPreview(basePath, item.path)
    }))
  );
  const sessionSummaries = await Promise.all(
    sessionItems.map(async (item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      lastActive: item.lastActive,
      currentTask: item.currentTask ?? null,
      currentPhase: item.currentPhase ?? null,
      preview: await readArtifactPreview(basePath, join('.webforge', 'sessions', `${item.id}.json`))
    }))
  );

  return {
    knowledge: {
      total: knowledgeItems.length,
      byType: {
        requirement: countBy(knowledgeItems, 'requirement', (item) => item.type),
        design: countBy(knowledgeItems, 'design', (item) => item.type),
        decision: countBy(knowledgeItems, 'decision', (item) => item.type),
        parsed: countBy(knowledgeItems, 'parsed', (item) => item.type),
        note: countBy(knowledgeItems, 'note', (item) => item.type)
      },
      items: knowledgeSummaries
    },
    deliverables: {
      total: deliverableItems.length,
      pendingReview: countBy(deliverableItems, 'pending_review', (item) => item.status),
      byStatus: {
        draft: countBy(deliverableItems, 'draft', (item) => item.status),
        pending_review: countBy(deliverableItems, 'pending_review', (item) => item.status),
        approved: countBy(deliverableItems, 'approved', (item) => item.status),
        rejected: countBy(deliverableItems, 'rejected', (item) => item.status)
      },
      items: deliverableSummaries
    },
    sessions: {
      total: sessionItems.length,
      byStatus: {
        active: countBy(sessionItems, 'active', (item) => item.status),
        paused: countBy(sessionItems, 'paused', (item) => item.status),
        completed: countBy(sessionItems, 'completed', (item) => item.status)
      },
      latest: sessionSummaries[0] ?? null,
      items: sessionSummaries
    }
  };
}

const MAX_PREVIEW_CHARS = 2200;

async function readArtifactPreview(
  basePath: string,
  artifactPath: string
): Promise<string | null> {
  const resolvedPath = resolve(basePath, artifactPath);
  const relativePath = relative(basePath, resolvedPath);
  if (!relativePath || relativePath.startsWith('..')) {
    return null;
  }

  try {
    const content = await readFile(resolvedPath, 'utf-8');
    const normalized = content.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return null;
    }

    if (normalized.length <= MAX_PREVIEW_CHARS) {
      return normalized;
    }

    return `${normalized.slice(0, MAX_PREVIEW_CHARS).trimEnd()}\n…`;
  } catch {
    return null;
  }
}

function countBy<T, TValue extends string>(
  items: T[],
  value: TValue,
  selector: (item: T) => TValue
): number {
  return items.filter((item) => selector(item) === value).length;
}
