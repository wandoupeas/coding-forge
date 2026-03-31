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
  } | null;
  items: Array<{
    id: string;
    name: string;
    status: WorkspaceSessionStatus;
    lastActive: string;
    currentTask: string | null;
    currentPhase: string | null;
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
      items: knowledgeItems.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        path: item.path,
        updatedAt: item.updatedAt
      }))
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
      items: deliverableItems.map((item) => ({
        id: item.id,
        taskId: item.taskId,
        title: item.title,
        type: item.type,
        status: item.status,
        path: item.path,
        createdAt: item.createdAt,
        createdBy: item.createdBy
      }))
    },
    sessions: {
      total: sessionItems.length,
      byStatus: {
        active: countBy(sessionItems, 'active', (item) => item.status),
        paused: countBy(sessionItems, 'paused', (item) => item.status),
        completed: countBy(sessionItems, 'completed', (item) => item.status)
      },
      latest: sessionItems[0]
        ? {
            id: sessionItems[0].id,
            name: sessionItems[0].name,
            status: sessionItems[0].status,
            lastActive: sessionItems[0].lastActive,
            currentTask: sessionItems[0].currentTask ?? null,
            currentPhase: sessionItems[0].currentPhase ?? null
          }
        : null,
      items: sessionItems.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        lastActive: item.lastActive,
        currentTask: item.currentTask ?? null,
        currentPhase: item.currentPhase ?? null
      }))
    }
  };
}

function countBy<T, TValue extends string>(
  items: T[],
  value: TValue,
  selector: (item: T) => TValue
): number {
  return items.filter((item) => selector(item) === value).length;
}
