/**
 * logs 命令 - 查看 runtime 执行日志与观察事件
 */

import { Command } from 'commander';
import { inspectThreadLink } from '../../core/threads.js';
import {
  getRuntimeWorkflowContext,
  getSessionWorkflowContext,
  inspectWorkflowContext
} from '../../core/workflow-context.js';
import { loadWorkspaceState } from '../../core/workspace.js';
import {
  getLatestRuntimeObservation,
  getRuntimeObservation,
  type RuntimeObservationSummary
} from '../../core/logger.js';
import { buildAgentBriefing } from '../agent-briefing.js';
import type { WorkspaceState, WorkspaceWorkflowContext } from '../../types/index.js';
import logger from '../utils/logger.js';

export interface RuntimeLogsOptions {
  json?: boolean;
}

export interface RuntimeLogsWorkflowContextSummary {
  source: 'runtime' | 'session' | 'current';
  status: 'ready' | 'blocked';
  workflow: string;
  runId: string | null;
  owner: string | null;
  waveId: string | null;
  threadId: string | null;
  branch: string | null;
  worktreePath: string | null;
  compactFromSession: string | null;
  artifacts: string[];
  missingArtifacts: string[];
  missingWorktreePath: string | null;
  missingCompactSessionId: string | null;
}

export interface RuntimeLogsThreadLinkageSummary {
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

export interface RuntimeLogsContextDriftSummary {
  status: 'none' | 'aligned' | 'drifted';
  reasons: string[];
}

export interface RuntimeLogsSummary extends RuntimeObservationSummary {
  workflowContext: RuntimeLogsWorkflowContextSummary | null;
  threadLinkage: RuntimeLogsThreadLinkageSummary;
  currentWorkflowContext: RuntimeLogsWorkflowContextSummary | null;
  currentThreadLinkage: RuntimeLogsThreadLinkageSummary;
  contextDrift: RuntimeLogsContextDriftSummary;
}

export function createLogsCommand(basePath: string = process.cwd()): Command {
  const command = new Command('logs').description('查看 WebForge runtime 执行日志');

  command
    .command('runtime')
    .description('查看最近一次或指定 session 的 runtime 观察日志')
    .argument('[session-id]', 'runtime session id，默认使用最近一次 runtime 会话')
    .option('--json', '输出结构化 runtime 日志摘要')
    .action(async (sessionId: string | undefined, options: RuntimeLogsOptions) => {
      try {
        await runtimeLogsCommand(sessionId, options, basePath);
      } catch (error) {
        logger.error(`读取 runtime 日志失败: ${error}`);
        process.exit(1);
      }
    });

  return command;
}

export async function runtimeLogsCommand(
  sessionId?: string,
  options: RuntimeLogsOptions = {},
  basePath: string = process.cwd()
): Promise<RuntimeLogsSummary | null> {
  let summary: RuntimeLogsSummary;
  try {
    summary = await buildRuntimeLogsSummary(sessionId, basePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warning(message);
    return null;
  }

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  logger.h1('🪵 Runtime 日志');
  logger.info(`session: ${summary.sessionId}`);
  logger.info(`start: ${new Date(summary.startTime).toLocaleString()}`);
  logger.info(`end: ${summary.endTime ? new Date(summary.endTime).toLocaleString() : 'running'}`);
  logger.info(
    `result: completed=${summary.completed} | failed=${summary.failed} | blocked=${summary.blocked} | deliverables=${summary.deliverables}`
  );
  logger.info(`permission profile: ${summary.permissionProfile ?? 'unknown'}`);

  if (summary.signals) {
    logger.info(
      `signals: ready=${summary.signals.readyTasks} | blocked=${summary.signals.blockedTasks} | pending_review=${summary.signals.pendingReview} | unread=${summary.signals.unreadMessages}`
    );
  }

  console.log();
  logger.h2('日志恢复快照');
  renderRecoverySnapshot(summary.workflowContext, summary.threadLinkage);

  console.log();
  logger.h2('当前工作区恢复快照');
  renderRecoverySnapshot(summary.currentWorkflowContext, summary.currentThreadLinkage);

  console.log();
  logger.h2('上下文漂移');
  logger.info(`status: ${summary.contextDrift.status}`);
  if (summary.contextDrift.reasons.length > 0) {
    logger.info(`reasons: ${summary.contextDrift.reasons.join(', ')}`);
  }

  console.log();
  logger.h2('事件流');
  if (summary.events.length === 0) {
    logger.info('当前没有可展示的 runtime observation 事件。');
    return summary;
  }

  for (const event of summary.events) {
    console.log(
      `  ${event.timestamp} :: ${event.message} :: ${event.taskId ?? 'no-task'} :: ${event.permissionProfile ?? 'unknown'}${
        event.reason ? ` :: ${event.reason}` : ''
      }`
    );
  }

  return summary;
}

export async function buildRuntimeLogsSummary(
  sessionId: string | undefined,
  basePath: string
): Promise<RuntimeLogsSummary> {
  const observation = sessionId
    ? await getRuntimeObservation(sessionId, basePath)
    : await getLatestRuntimeObservation(basePath);

  if (!observation) {
    throw new Error(
      sessionId
        ? `没有找到 runtime 日志 ${sessionId}`
        : '当前 workspace 没有 runtime 日志'
    );
  }

  const workspace = await loadWorkspaceState(basePath);
  const briefing = await buildAgentBriefing(basePath, workspace);
  const workflowContext = resolveRuntimeLogsWorkflowContext(
    observation.sessionId,
    workspace,
    basePath
  );
  const threadLinkage = resolveRuntimeLogsThreadLinkage(
    workflowContext?.threadId ?? null,
    workspace,
    basePath
  );
  const currentWorkflowContext = summarizeWorkflowContext(
    'current',
    briefing.workflowContext,
    basePath
  );
  const currentThreadLinkage = resolveRuntimeLogsThreadLinkage(
    currentWorkflowContext?.threadId ?? null,
    workspace,
    basePath
  );
  const contextDrift = buildContextDriftSummary(
    workflowContext,
    threadLinkage,
    currentWorkflowContext,
    currentThreadLinkage
  );

  return {
    ...observation,
    workflowContext,
    threadLinkage,
    currentWorkflowContext,
    currentThreadLinkage,
    contextDrift
  };
}

function resolveRuntimeLogsWorkflowContext(
  sessionId: string,
  workspace: WorkspaceState,
  basePath: string
): RuntimeLogsWorkflowContextSummary | null {
  let source: 'runtime' | 'session' | null = null;
  let context: WorkspaceWorkflowContext | null = null;

  if (workspace.runtime.sessionId === sessionId) {
    context = getRuntimeWorkflowContext(workspace.runtime);
    source = context ? 'runtime' : null;
  }

  if (!context) {
    const session = workspace.indexes.sessions.find((item) => item.id === sessionId) ?? null;
    context = getSessionWorkflowContext(session);
    source = context ? 'session' : null;
  }

  if (!context || !source) {
    return null;
  }

  return summarizeWorkflowContext(source, context, basePath);
}

function summarizeWorkflowContext(
  source: 'runtime' | 'session' | 'current',
  context: WorkspaceWorkflowContext | null,
  basePath: string
): RuntimeLogsWorkflowContextSummary | null {
  if (!context) {
    return null;
  }

  const readiness = inspectWorkflowContext(basePath, context);
  return {
    source,
    status:
      readiness.missingArtifacts.length > 0 ||
      readiness.missingWorktreePath !== null ||
      readiness.missingCompactSessionId !== null
        ? 'blocked'
        : 'ready',
    workflow: context.workflow,
    runId: context.runId ?? null,
    owner: context.owner ?? null,
    waveId: context.waveId ?? null,
    threadId: context.threadId ?? null,
    branch: context.branch ?? null,
    worktreePath: context.worktreePath ?? null,
    compactFromSession: context.compactFromSession ?? null,
    artifacts: context.artifacts ?? [],
    missingArtifacts: readiness.missingArtifacts,
    missingWorktreePath: readiness.missingWorktreePath,
    missingCompactSessionId: readiness.missingCompactSessionId
  };
}

function resolveRuntimeLogsThreadLinkage(
  threadId: string | null,
  workspace: WorkspaceState,
  basePath: string
): RuntimeLogsThreadLinkageSummary {
  if (!threadId) {
    return {
      status: 'none',
      threadId: null,
      workflow: null,
      runId: null,
      branch: null,
      worktreePath: null,
      missingArtifacts: [],
      missingWorktreePath: null,
      missingThreadId: null
    };
  }

  const threadLink = workspace.indexes.threads.find((item) => item.id === threadId) ?? null;
  if (!threadLink) {
    return {
      status: 'blocked',
      threadId,
      workflow: null,
      runId: null,
      branch: null,
      worktreePath: null,
      missingArtifacts: [],
      missingWorktreePath: null,
      missingThreadId: threadId
    };
  }

  const readiness = inspectThreadLink(basePath, threadLink);
  return {
    status:
      readiness.missingArtifacts.length > 0 || readiness.missingWorktreePath !== null
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
}

function renderRecoverySnapshot(
  workflowContext: RuntimeLogsWorkflowContextSummary | null,
  threadLinkage: RuntimeLogsThreadLinkageSummary
): void {
  if (!workflowContext) {
    logger.info('workflow context: none');
  } else {
    logger.info(
      `workflow context: ${workflowContext.status} (${workflowContext.source})`
    );
    logger.info(`workflow: ${workflowContext.workflow}`);
    logger.info(`branch: ${workflowContext.branch ?? 'none'}`);
    logger.info(`worktree: ${workflowContext.worktreePath ?? 'none'}`);
    logger.info(`wave: ${workflowContext.waveId ?? 'none'}`);
    logger.info(`thread: ${workflowContext.threadId ?? 'none'}`);
    logger.info(`compact from: ${workflowContext.compactFromSession ?? 'none'}`);
    logger.info(
      `readiness: artifacts=${workflowContext.missingArtifacts.length === 0 ? 'ok' : `missing:${workflowContext.missingArtifacts.length}`}, worktree=${workflowContext.missingWorktreePath ? 'missing' : 'ok'}, compact=${workflowContext.missingCompactSessionId ? 'missing' : 'ok'}`
    );
  }

  if (threadLinkage.status === 'none') {
    logger.info('thread linkage: none');
    return;
  }

  logger.info(`thread linkage: ${threadLinkage.status}`);
  logger.info(`thread id: ${threadLinkage.threadId ?? 'none'}`);
  logger.info(`thread workflow: ${threadLinkage.workflow ?? 'none'}`);
  logger.info(`thread branch: ${threadLinkage.branch ?? 'none'}`);
  logger.info(`thread worktree: ${threadLinkage.worktreePath ?? 'none'}`);
  logger.info(
    `thread readiness: artifacts=${threadLinkage.missingArtifacts.length === 0 ? 'ok' : `missing:${threadLinkage.missingArtifacts.length}`}, worktree=${threadLinkage.missingWorktreePath ? 'missing' : 'ok'}${
      threadLinkage.missingThreadId ? `, thread=missing:${threadLinkage.missingThreadId}` : ''
    }`
  );
}

function buildContextDriftSummary(
  logWorkflowContext: RuntimeLogsWorkflowContextSummary | null,
  logThreadLinkage: RuntimeLogsThreadLinkageSummary,
  currentWorkflowContext: RuntimeLogsWorkflowContextSummary | null,
  currentThreadLinkage: RuntimeLogsThreadLinkageSummary
): RuntimeLogsContextDriftSummary {
  if (!logWorkflowContext && !currentWorkflowContext) {
    return {
      status: 'none',
      reasons: []
    };
  }

  const reasons: string[] = [];

  if (!logWorkflowContext && currentWorkflowContext) {
    reasons.push('missing log workflowContext');
  } else if (logWorkflowContext && !currentWorkflowContext) {
    reasons.push('missing current workflowContext');
  } else if (logWorkflowContext && currentWorkflowContext) {
    appendIfChanged(
      reasons,
      'workflow',
      logWorkflowContext.workflow,
      currentWorkflowContext.workflow
    );
    appendIfChanged(reasons, 'runId', logWorkflowContext.runId, currentWorkflowContext.runId);
    appendIfChanged(
      reasons,
      'threadId',
      logWorkflowContext.threadId,
      currentWorkflowContext.threadId
    );
    appendIfChanged(reasons, 'branch', logWorkflowContext.branch, currentWorkflowContext.branch);
    appendIfChanged(
      reasons,
      'worktreePath',
      logWorkflowContext.worktreePath,
      currentWorkflowContext.worktreePath
    );
    appendIfChanged(
      reasons,
      'compactFromSession',
      logWorkflowContext.compactFromSession,
      currentWorkflowContext.compactFromSession
    );
  }

  appendIfChanged(
    reasons,
    'threadLinkage.threadId',
    logThreadLinkage.threadId,
    currentThreadLinkage.threadId
  );
  appendIfChanged(
    reasons,
    'threadLinkage.workflow',
    logThreadLinkage.workflow,
    currentThreadLinkage.workflow
  );
  appendIfChanged(
    reasons,
    'threadLinkage.runId',
    logThreadLinkage.runId,
    currentThreadLinkage.runId
  );
  appendIfChanged(
    reasons,
    'threadLinkage.branch',
    logThreadLinkage.branch,
    currentThreadLinkage.branch
  );
  appendIfChanged(
    reasons,
    'threadLinkage.worktreePath',
    logThreadLinkage.worktreePath,
    currentThreadLinkage.worktreePath
  );

  return {
    status: reasons.length > 0 ? 'drifted' : 'aligned',
    reasons
  };
}

function appendIfChanged(
  reasons: string[],
  label: string,
  left: string | null | undefined,
  right: string | null | undefined
): void {
  if ((left ?? null) !== (right ?? null)) {
    reasons.push(`${label}: ${left ?? 'none'} -> ${right ?? 'none'}`);
  }
}
