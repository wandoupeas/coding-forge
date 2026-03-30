/**
 * resume 命令 - 基于 session + runtime 的恢复入口
 */

import { Command } from 'commander';
import { getThreadLink, inspectThreadLink } from '../../core/threads.js';
import type { AgentPermissionProfile } from '../../types/index.js';
import {
  buildRuntimeLogsSummary,
  type RuntimeLogsContextDriftSummary,
  type RuntimeLogsThreadLinkageSummary,
  type RuntimeLogsWorkflowContextSummary
} from './logs.js';
import logger from '../utils/logger.js';
import { buildAgentBriefing } from '../agent-briefing.js';

export interface ResumeObservationSummary {
  readyTasks: number;
  blockedTasks: number;
  pendingReview: number;
  unreadMessages: number;
}

export interface ResumeSuperpowersSummary {
  enabled: boolean;
  taskSkills: string[];
  requiredSkills: string[];
  executionMode: 'subagent' | 'inline' | null;
  suggestedWorkflow: string | null;
  capabilities: Array<{
    id: string;
    kind: string;
    owner: string;
    recommended: boolean;
  }>;
}

export interface ResumePermissionSummary {
  profile: AgentPermissionProfile;
  canWriteWorkspace: boolean;
  requiresApproval: boolean;
}

export interface ResumeRuntimeLogSummary {
  sessionId: string | null;
  lastEvent: string | null;
  lastTaskId: string | null;
  permissionProfile: string | null;
  command: string | null;
  workflowContext: RuntimeLogsWorkflowContextSummary | null;
  threadLinkage: RuntimeLogsThreadLinkageSummary;
  currentWorkflowContext: RuntimeLogsWorkflowContextSummary | null;
  currentThreadLinkage: RuntimeLogsThreadLinkageSummary;
  contextDrift: RuntimeLogsContextDriftSummary;
}

export interface ResumeLatestSuperpowersRunSummary {
  id: string;
  workflow: string;
  summary: string;
  taskId: string | null;
  sessionId: string | null;
  recordedAt: string;
  artifacts: string[];
}

export interface ResumeWorkflowContextSummary {
  workflow: string;
  runId: string | null;
  owner: string | null;
  waveId: string | null;
  threadId: string | null;
  branch: string | null;
  worktreePath: string | null;
  compactFromSession: string | null;
  artifacts: string[];
}

export interface ResumeThreadLinkageSummary {
  status: 'none' | 'ready' | 'blocked';
  threadId: string | null;
  workflow: string | null;
  runId: string | null;
  branch: string | null;
  worktreePath: string | null;
  missingArtifacts: string[];
  missingWorktreePath: string | null;
  missingThreadId: string | null;
}

export interface ResumeSummary {
  sessionId: string | null;
  sessionName: string | null;
  lastActive: string | null;
  runtimeStatus: string;
  runtimeSummary: string;
  currentTaskId: string | null;
  currentPhaseId: string | null;
  readyCount: number;
  blockedCount: number;
  pendingReviewCount: number;
  nextAction: string;
  guidance: string | null;
  shouldRead: string[];
  observation: ResumeObservationSummary;
  superpowers: ResumeSuperpowersSummary;
  permissions: ResumePermissionSummary;
  runtimeLog: ResumeRuntimeLogSummary;
  latestSuperpowersRun: ResumeLatestSuperpowersRunSummary | null;
  workflowContext: ResumeWorkflowContextSummary | null;
  threadLinkage: ResumeThreadLinkageSummary;
}

export interface ResumeCommandOptions {
  json?: boolean;
}

export function createResumeCommand(): Command {
  return new Command('resume')
    .description('基于 session 与 runtime 状态给出恢复建议')
    .option('--json', '输出结构化恢复简报，供 agent 或脚本消费')
    .action(async (options: ResumeCommandOptions) => {
      try {
        await resumeCommand(options);
      } catch (error) {
        logger.error(`恢复失败: ${error}`);
        process.exit(1);
      }
    });
}

export async function buildResumeSummary(
  basePath: string = process.cwd()
): Promise<ResumeSummary> {
  const [briefing, runtimeLogs] = await Promise.all([
    buildAgentBriefing(basePath),
    buildRuntimeLogsSummary(undefined, basePath).catch(() => null)
  ]);
  const threadId = briefing.workflowContext?.threadId ?? null;
  const threadLink = threadId ? await getThreadLink(basePath, threadId) : null;
  const threadLinkage: ResumeThreadLinkageSummary = !threadId
    ? {
        status: 'none',
        threadId: null,
        workflow: null,
        runId: null,
        branch: null,
        worktreePath: null,
        missingArtifacts: [],
        missingWorktreePath: null,
        missingThreadId: null
      }
    : !threadLink
      ? {
          status: 'blocked',
          threadId,
          workflow: null,
          runId: null,
          branch: null,
          worktreePath: null,
          missingArtifacts: [],
          missingWorktreePath: null,
          missingThreadId: threadId
        }
      : (() => {
          const readiness = inspectThreadLink(basePath, threadLink);
          return {
            status:
              readiness.missingArtifacts.length > 0 || readiness.missingWorktreePath
                ? 'blocked'
                : 'ready',
            threadId: threadLink.id,
            workflow: threadLink.workflow,
            runId: threadLink.runId ?? null,
            branch: threadLink.branch ?? null,
            worktreePath: threadLink.worktreePath ?? null,
            missingArtifacts: readiness.missingArtifacts,
            missingWorktreePath: readiness.missingWorktreePath,
            missingThreadId: null
          };
        })();

  return {
    sessionId: briefing.sessionId,
    sessionName: briefing.sessionName,
    lastActive: briefing.lastActive,
    runtimeStatus: briefing.runtimeStatus,
    runtimeSummary: briefing.runtimeSummary,
    currentTaskId: briefing.currentTaskId,
    currentPhaseId: briefing.currentPhaseId,
    readyCount: briefing.readyTasks.length,
    blockedCount: briefing.blockedTasks.length,
    pendingReviewCount: briefing.pendingReview.length,
    guidance: briefing.guidance,
    nextAction: briefing.nextAction,
    shouldRead: briefing.shouldRead,
    observation: {
      readyTasks: briefing.observation.counts.readyTasks,
      blockedTasks: briefing.observation.counts.blockedTasks,
      pendingReview: briefing.observation.counts.pendingReview,
      unreadMessages: briefing.observation.counts.unreadMessages
    },
    superpowers: {
      enabled: briefing.superpowers.enabled,
      taskSkills: briefing.superpowers.taskSkills,
      requiredSkills: briefing.superpowers.requiredSkills,
      executionMode: briefing.superpowers.executionMode,
      suggestedWorkflow: briefing.superpowers.suggestedWorkflow,
      capabilities: briefing.superpowers.capabilities.map((capability) => ({
        id: capability.id,
        kind: capability.kind,
        owner: capability.owner,
        recommended: capability.recommended
      }))
    },
    permissions: {
      profile: briefing.permissions.profile,
      canWriteWorkspace: briefing.permissions.canWriteWorkspace,
      requiresApproval: briefing.permissions.requiresApproval
    },
    runtimeLog: {
      sessionId: runtimeLogs?.sessionId ?? null,
      lastEvent: runtimeLogs?.lastEvent ?? null,
      lastTaskId: runtimeLogs?.lastTaskId ?? null,
      permissionProfile: runtimeLogs?.permissionProfile ?? null,
      command: runtimeLogs?.sessionId ? `webforge logs runtime ${runtimeLogs.sessionId}` : null,
      workflowContext: runtimeLogs?.workflowContext ?? null,
      threadLinkage: runtimeLogs?.threadLinkage ?? {
        status: 'none',
        threadId: null,
        workflow: null,
        runId: null,
        branch: null,
        worktreePath: null,
        missingArtifacts: [],
        missingWorktreePath: null,
        missingThreadId: null
      },
      currentWorkflowContext: runtimeLogs?.currentWorkflowContext ?? null,
      currentThreadLinkage: runtimeLogs?.currentThreadLinkage ?? {
        status: 'none',
        threadId: null,
        workflow: null,
        runId: null,
        branch: null,
        worktreePath: null,
        missingArtifacts: [],
        missingWorktreePath: null,
        missingThreadId: null
      },
      contextDrift: runtimeLogs?.contextDrift ?? {
        status: 'none',
        reasons: []
      }
    },
    latestSuperpowersRun: briefing.latestSuperpowersRun
      ? {
          id: briefing.latestSuperpowersRun.id,
          workflow: briefing.latestSuperpowersRun.workflow,
          summary: briefing.latestSuperpowersRun.summary,
          taskId: briefing.latestSuperpowersRun.taskId ?? null,
          sessionId: briefing.latestSuperpowersRun.sessionId ?? null,
          recordedAt: briefing.latestSuperpowersRun.recordedAt,
          artifacts: briefing.latestSuperpowersRun.artifacts.map((artifact) => artifact.path)
        }
      : null,
    workflowContext: briefing.workflowContext
      ? {
          workflow: briefing.workflowContext.workflow,
          runId: briefing.workflowContext.runId ?? null,
          owner: briefing.workflowContext.owner ?? null,
          waveId: briefing.workflowContext.waveId ?? null,
          threadId: briefing.workflowContext.threadId ?? null,
          branch: briefing.workflowContext.branch ?? null,
          worktreePath: briefing.workflowContext.worktreePath ?? null,
          compactFromSession: briefing.workflowContext.compactFromSession ?? null,
          artifacts: briefing.workflowContext.artifacts ?? []
        }
      : null,
    threadLinkage
  };
}

export async function resumeCommand(
  optionsOrBasePath: ResumeCommandOptions | string = {},
  maybeBasePath?: string
): Promise<void> {
  const options =
    typeof optionsOrBasePath === 'string'
      ? {}
      : optionsOrBasePath;
  const basePath =
    typeof optionsOrBasePath === 'string'
      ? optionsOrBasePath
      : (maybeBasePath ?? process.cwd());
  const summary = await buildResumeSummary(basePath);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  logger.h1('🔄 Agent 恢复简报');

  if (summary.sessionId) {
    logger.info(`最近会话: ${summary.sessionId} (${summary.sessionName ?? 'unnamed'})`);
    logger.info(`最后活跃: ${new Date(summary.lastActive!).toLocaleString()}`);
  } else {
    logger.warning('没有找到历史会话，以下建议基于当前 workspace 状态生成。');
  }

  console.log();
  logger.h2('建议先读');
  logger.list(summary.shouldRead);

  console.log();
  logger.h2('Runtime 状态');
  logger.info(`status: ${summary.runtimeStatus}`);
  logger.info(`summary: ${summary.runtimeSummary}`);
  logger.info(`current phase: ${summary.currentPhaseId ?? 'none'}`);
  logger.info(`current task: ${summary.currentTaskId ?? 'none'}`);
  logger.info(`ready tasks: ${summary.readyCount}`);

  console.log();
  logger.h2('工作信号');
  logger.info(`blocked tasks: ${summary.blockedCount}`);
  logger.info(`pending review: ${summary.pendingReviewCount}`);
  logger.info(`unread mailbox: ${summary.observation.unreadMessages}`);

  console.log();
  logger.h2('方法与权限');
  logger.info(`permission profile: ${summary.permissions.profile}`);
  logger.info(`workspace write: ${summary.permissions.canWriteWorkspace ? 'yes' : 'no'}`);
  logger.info(
    `superpowers workflow: ${summary.superpowers.suggestedWorkflow ?? 'none'}`
  );
  logger.info(
    `task skills: ${
      summary.superpowers.taskSkills.length > 0 ? summary.superpowers.taskSkills.join(', ') : 'none'
    }`
  );
  if (summary.runtimeLog.sessionId) {
    logger.info(`runtime log: ${summary.runtimeLog.command}`);
    logger.info(`runtime drift: ${summary.runtimeLog.contextDrift.status}`);
    if (summary.runtimeLog.contextDrift.reasons.length > 0) {
      logger.info(`runtime drift reasons: ${summary.runtimeLog.contextDrift.reasons.join(', ')}`);
    }
  }
  if (summary.latestSuperpowersRun) {
    logger.info(
      `latest workflow artifact: ${summary.latestSuperpowersRun.workflow} -> ${summary.latestSuperpowersRun.artifacts[0] ?? 'none'}`
    );
  }
  if (summary.workflowContext) {
    logger.info(
      `workflow context: ${summary.workflowContext.workflow} / ${summary.workflowContext.branch ?? 'no-branch'}`
    );
  }
  if (summary.threadLinkage.status !== 'none') {
    logger.info(
      `thread linkage: ${summary.threadLinkage.status} / ${summary.threadLinkage.threadId ?? 'none'}`
    );
    if (summary.threadLinkage.status === 'blocked') {
      logger.info(`thread issues: ${formatThreadLinkageIssues(summary.threadLinkage)}`);
    }
  }

  if (summary.guidance) {
    console.log();
    logger.h2('恢复提示');
    logger.info(summary.guidance);
  }

  console.log();
  logger.h2('下一步');
  logger.info(summary.nextAction);
  logger.list([
    'webforge dashboard        # 查看完整观察面',
    'webforge doctor           # 校验仓库契约'
  ]);
}

function formatThreadLinkageIssues(summary: ResumeThreadLinkageSummary): string {
  const issues: string[] = [];
  if (summary.missingThreadId) {
    issues.push(`missing thread=${summary.missingThreadId}`);
  }
  if (summary.missingArtifacts.length > 0) {
    issues.push(`missing artifacts=${summary.missingArtifacts.join(', ')}`);
  }
  if (summary.missingWorktreePath) {
    issues.push(`missing worktree=${summary.missingWorktreePath}`);
  }
  return issues.join('; ');
}
