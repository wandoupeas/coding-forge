import { basename, join } from 'path';
import { loadConfig } from '../../utils/config.js';
import { buildArtifactsReadModel } from './artifacts.js';
import { buildRecoveryReadModel } from './recovery.js';
import { buildRuntimeReadModel } from './runtime.js';
import { buildTasksReadModel } from './tasks.js';

export interface ProjectOverviewReadModel {
  project: {
    name: string;
    rootPath: string;
    workspacePath: string;
  };
  runtime: {
    status: string;
    summary: string;
    updatedAt: string;
    currentTaskId: string | null;
    currentPhaseId: string | null;
    latestRuntimeSessionId: string | null;
    latestRuntimeEvent: string | null;
  };
  tasks: Awaited<ReturnType<typeof buildTasksReadModel>>['counts'];
  artifacts: {
    knowledgeCount: number;
    deliverablesCount: number;
    pendingReviewCount: number;
    sessionCount: number;
  };
  recovery: {
    canProceed: boolean;
    status: 'ready' | 'blocked';
    doctorSummary: {
      ok: number;
      warn: number;
      fail: number;
    };
    contextDriftStatus: Awaited<ReturnType<typeof buildRecoveryReadModel>>['contextDrift']['status'];
    threadLinkageStatus: Awaited<ReturnType<typeof buildRecoveryReadModel>>['threadLinkage']['status'];
  };
}

export async function buildProjectOverview(
  basePath: string = process.cwd()
): Promise<ProjectOverviewReadModel> {
  const [projectName, tasks, artifacts, recovery, runtime] = await Promise.all([
    resolveProjectName(basePath),
    buildTasksReadModel(basePath),
    buildArtifactsReadModel(basePath),
    buildRecoveryReadModel(basePath),
    buildRuntimeReadModel(basePath)
  ]);

  return {
    project: {
      name: projectName,
      rootPath: basePath,
      workspacePath: join(basePath, '.webforge')
    },
    runtime: {
      status: runtime.runtime.status,
      summary: runtime.runtime.summary,
      updatedAt: runtime.runtime.updatedAt,
      currentTaskId: runtime.runtime.taskId,
      currentPhaseId: runtime.runtime.phaseId,
      latestRuntimeSessionId: runtime.latestObservation?.sessionId ?? null,
      latestRuntimeEvent: runtime.latestObservation?.lastEvent ?? null
    },
    tasks: tasks.counts,
    artifacts: {
      knowledgeCount: artifacts.knowledge.total,
      deliverablesCount: artifacts.deliverables.total,
      pendingReviewCount: artifacts.deliverables.pendingReview,
      sessionCount: artifacts.sessions.total
    },
    recovery: {
      canProceed: recovery.canProceed,
      status: recovery.status,
      doctorSummary: recovery.doctor.summary,
      contextDriftStatus: recovery.contextDrift.status,
      threadLinkageStatus: recovery.threadLinkage.status
    }
  };
}

async function resolveProjectName(basePath: string): Promise<string> {
  try {
    const config = await loadConfig(basePath);
    return config.project.name;
  } catch {
    return basename(basePath);
  }
}
