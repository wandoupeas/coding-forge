import { readdir } from 'fs/promises';
import { join } from 'path';
import { listCheckpoints } from '../../core/checkpoint.js';
import { getLatestRuntimeObservation } from '../../core/logger.js';
import { Mailbox } from '../../core/mailbox.js';
import { getLatestSuperpowersRun, inspectSuperpowersRun } from '../../core/superpowers-runs.js';
import { loadWorkspaceState } from '../../core/workspace.js';

export interface RuntimeReadModel {
  runtime: {
    status: string;
    summary: string;
    updatedAt: string;
    sessionId: string | null;
    phaseId: string | null;
    taskId: string | null;
  };
  latestObservation: Awaited<ReturnType<typeof getLatestRuntimeObservation>> | null;
  mailboxes: {
    total: number;
    unreadMessages: number;
    items: Array<{
      workerId: string;
      unreadCount: number;
      mailboxPath: string;
    }>;
  };
  checkpoints: {
    total: number;
    latest: {
      id: string;
      name: string;
      createdAt: string;
    } | null;
  };
  superpowers: {
    totalRuns: number;
    latestRun: {
      id: string;
      workflow: string;
      summary: string;
      recordedAt: string;
      taskId: string | null;
      sessionId: string | null;
      artifactCount: number;
      readiness: {
        missingArtifacts: string[];
        missingWorktreePath: string | null;
        missingCompactSessionId: string | null;
      };
    } | null;
  };
}

export async function buildRuntimeReadModel(
  basePath: string = process.cwd()
): Promise<RuntimeReadModel> {
  const workspace = await loadWorkspaceState(basePath);
  const [latestObservation, checkpoints, mailboxes, latestRun] = await Promise.all([
    getLatestRuntimeObservation(basePath),
    listCheckpoints(basePath),
    listMailboxSummaries(basePath),
    getLatestSuperpowersRun(basePath)
  ]);

  return {
    runtime: {
      status: workspace.runtime.status,
      summary: workspace.runtime.summary,
      updatedAt: workspace.runtime.updatedAt,
      sessionId: workspace.runtime.sessionId,
      phaseId: workspace.runtime.phaseId,
      taskId: workspace.runtime.taskId
    },
    latestObservation,
    mailboxes: {
      total: mailboxes.length,
      unreadMessages: mailboxes.reduce((sum, mailbox) => sum + mailbox.unreadCount, 0),
      items: mailboxes
    },
    checkpoints: {
      total: checkpoints.length,
      latest: checkpoints[0]
        ? {
            id: checkpoints[0].id,
            name: checkpoints[0].name,
            createdAt: checkpoints[0].createdAt
          }
        : null
    },
    superpowers: {
      totalRuns: workspace.indexes.superpowersRuns.length,
      latestRun: latestRun
        ? {
            id: latestRun.id,
            workflow: latestRun.workflow,
            summary: latestRun.summary,
            recordedAt: latestRun.recordedAt,
            taskId: latestRun.taskId ?? null,
            sessionId: latestRun.sessionId ?? null,
            artifactCount: latestRun.artifacts.length,
            readiness: inspectSuperpowersRun(basePath, latestRun)
          }
        : null
    }
  };
}

async function listMailboxSummaries(
  basePath: string
): Promise<Array<{ workerId: string; unreadCount: number; mailboxPath: string }>> {
  const mailboxesDir = join(basePath, '.webforge', 'mailboxes');
  let entries: string[] = [];

  try {
    entries = await readdir(mailboxesDir);
  } catch {
    return [];
  }

  const mailboxIds = entries
    .filter((entry) => entry.endsWith('.jsonl'))
    .map((entry) => entry.replace(/\.jsonl$/, ''))
    .sort((left, right) => left.localeCompare(right));

  const summaries = await Promise.all(
    mailboxIds.map(async (workerId) => {
      const mailbox = new Mailbox(workerId, basePath);
      return {
        workerId,
        unreadCount: await mailbox.getUnreadCount(),
        mailboxPath: `.webforge/mailboxes/${workerId}.jsonl`
      };
    })
  );

  return summaries;
}
