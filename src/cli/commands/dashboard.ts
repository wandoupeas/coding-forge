/**
 * dashboard 命令 - workspace 观察面
 */

import { Command } from 'commander';
import logger from '../utils/logger.js';
import { buildAgentBriefing, type AgentBriefing } from '../agent-briefing.js';
import { inspectThreadLink } from '../../core/threads.js';
import { inspectWorkflowContext } from '../../core/workflow-context.js';
import {
  getLatestRuntimeObservation,
  type RuntimeObservationSummary
} from '../../core/logger.js';
import { loadWorkspaceState } from '../../core/workspace.js';
import { loadConfig } from '../../utils/config.js';
import type { Task, WorkspaceSessionIndexEntry, WorkspaceState } from '../../types/index.js';

export interface DashboardOptions {
  watch?: boolean;
}

export function createDashboardCommand(): Command {
  return new Command('dashboard')
    .description('显示 workspace / runtime / session 观察面')
    .option('-w, --watch', '监视模式，实时刷新 dashboard')
    .action(async (options: DashboardOptions) => {
      try {
        await dashboardCommand(options);
      } catch (error) {
        logger.error(`显示失败: ${error}`);
        process.exit(1);
      }
    });
}

export async function dashboardCommand(
  options: DashboardOptions,
  basePath: string = process.cwd()
): Promise<void> {
  const render = async (): Promise<void> => {
    const workspace = await loadWorkspaceState(basePath);
    const briefing = await buildAgentBriefing(basePath, workspace);
    const config = await loadConfig(basePath).catch(() => null);
    const latestRuntimeObservation = await getLatestRuntimeObservation(basePath);
    renderDashboard(
      workspace,
      briefing,
      config?.project.name,
      config?.project.version,
      latestRuntimeObservation
    );
  };

  await render();

  if (options.watch) {
    console.log();
    logger.info('监视模式中... (按 Ctrl+C 退出)');
    setInterval(async () => {
      console.clear();
      await render();
      console.log();
      logger.info('监视模式中... (按 Ctrl+C 退出)');
    }, 5000);
  } else {
    console.log();
    logger.info('提示: 使用 --watch 开启实时监视');
  }
}

export function renderDashboard(
  workspace: WorkspaceState,
  briefing: AgentBriefing,
  projectName?: string,
  projectVersion?: string,
  latestRuntimeObservation?: RuntimeObservationSummary | null
): void {
  const tasks = workspace.tasks.tasks;
  const phases = workspace.phases.phases;
  const readyTasks = getReadyTasks(tasks);
  const stats = calculateTaskStats(tasks);
  const latestSessions = [...workspace.indexes.sessions]
    .sort(
      (left, right) =>
        new Date(right.lastActive).getTime() - new Date(left.lastActive).getTime()
    )
    .slice(0, 3);

  logger.h1('📊 WebForge 观察面');

  if (projectName) {
    logger.h2('项目信息');
    logger.info(`名称: ${projectName}`);
    logger.info(`版本: ${projectVersion ?? 'unknown'}`);
  }

  logger.h2('Agent 简报');
  logger.info(`next: ${briefing.nextAction}`);
  logger.info(
    `signals: ready=${briefing.readyTasks.length} | blocked=${briefing.blockedTasks.length} | pending_review=${briefing.pendingReview.length}`
  );
  if (briefing.guidance) {
    logger.info(`guidance: ${briefing.guidance}`);
  }
  console.log('  建议先读:');
  for (const item of briefing.shouldRead) {
    console.log(`    - ${item}`);
  }

  logger.h2('Runtime 状态');
  logger.info(`status: ${workspace.runtime.status}`);
  logger.info(`session: ${workspace.runtime.sessionId ?? 'none'}`);
  logger.info(`phase: ${workspace.runtime.phaseId ?? 'none'}`);
  logger.info(`task: ${workspace.runtime.taskId ?? 'none'}`);
  logger.info(`summary: ${workspace.runtime.summary}`);

  if (briefing.workflowContext) {
    const readiness = inspectWorkflowContext(workspace.basePath, briefing.workflowContext);
    logger.h2('当前 Workflow Context');
    logger.info(`workflow: ${briefing.workflowContext.workflow}`);
    logger.info(`branch: ${briefing.workflowContext.branch ?? 'none'}`);
    logger.info(`worktree: ${briefing.workflowContext.worktreePath ?? 'none'}`);
    logger.info(`wave: ${briefing.workflowContext.waveId ?? 'none'}`);
    logger.info(`thread: ${briefing.workflowContext.threadId ?? 'none'}`);
    logger.info(`compact from: ${briefing.workflowContext.compactFromSession ?? 'none'}`);
    logger.info(
      `readiness: artifacts=${readiness.missingArtifacts.length === 0 ? 'ok' : `missing:${readiness.missingArtifacts.length}`}, worktree=${readiness.missingWorktreePath ? 'missing' : 'ok'}, compact=${readiness.missingCompactSessionId ? 'missing' : 'ok'}`
    );
  }

  if (briefing.workflowContext?.threadId) {
    const threadLink =
      workspace.indexes.threads.find((link) => link.id === briefing.workflowContext?.threadId) ?? null;
    logger.h2('当前 Thread Linkage');
    if (!threadLink) {
      logger.info(`thread: ${briefing.workflowContext.threadId}`);
      logger.info('status: blocked');
      logger.info(`readiness: missing thread object=${briefing.workflowContext.threadId}`);
    } else {
      const readiness = inspectThreadLink(workspace.basePath, threadLink);
      logger.info(`thread: ${threadLink.id}`);
      logger.info(`workflow: ${threadLink.workflow}`);
      logger.info(`branch: ${threadLink.branch ?? 'none'}`);
      logger.info(`worktree: ${threadLink.worktreePath ?? 'none'}`);
      logger.info(
        `status: ${readiness.missingArtifacts.length > 0 || readiness.missingWorktreePath ? 'blocked' : 'ready'}`
      );
      logger.info(
        `readiness: artifacts=${readiness.missingArtifacts.length === 0 ? 'ok' : `missing:${readiness.missingArtifacts.length}`}, worktree=${readiness.missingWorktreePath ? 'missing' : 'ok'}`
      );
    }
  }

  if (latestRuntimeObservation) {
    logger.h2('最近 Runtime 观察');
    logger.info(`session: ${latestRuntimeObservation.sessionId}`);
    logger.info(
      `result: completed=${latestRuntimeObservation.completed} | failed=${latestRuntimeObservation.failed} | blocked=${latestRuntimeObservation.blocked} | deliverables=${latestRuntimeObservation.deliverables}`
    );
    logger.info(
      `last event: ${latestRuntimeObservation.lastEvent ?? 'none'} (${latestRuntimeObservation.lastTaskId ?? 'no-task'})`
    );
    logger.info(`permission profile: ${latestRuntimeObservation.permissionProfile ?? 'unknown'}`);
    if (latestRuntimeObservation.signals) {
      logger.info(
        `signals: ready=${latestRuntimeObservation.signals.readyTasks} | blocked=${latestRuntimeObservation.signals.blockedTasks} | pending_review=${latestRuntimeObservation.signals.pendingReview} | unread=${latestRuntimeObservation.signals.unreadMessages}`
      );
    }
    for (const event of latestRuntimeObservation.recentEvents) {
      console.log(
        `  ${event.message} :: ${event.taskId ?? 'no-task'} :: ${event.permissionProfile ?? 'unknown'}${
          event.reason ? ` :: ${event.reason}` : ''
        }`
      );
    }
  }

  logger.h2('任务统计');
  console.log('  ' + logger.progress(stats.completed, stats.total, 40));
  console.log(`  总计: ${stats.total} | 就绪: ${stats.ready} | 进行中: ${stats.inProgress}`);
  console.log(`  已完成: ${stats.completed} | 阻塞: ${stats.blocked} | 失败: ${stats.failed}`);

  logger.h2('阶段状态');
  console.log('  ID   名称             状态        进度');
  console.log('  ───  ───────────────  ──────────  ────────');
  for (const phase of phases) {
    const phaseTasks = tasks.filter((task) => task.phase === phase.id);
    const completed = phaseTasks.filter((task) => task.status === 'completed').length;
    const total = phaseTasks.length;
    const status = completed === total && total > 0
      ? 'completed'
      : phaseTasks.some((task) => task.status === 'in_progress' || task.status === 'ready')
        ? 'in_progress'
        : phase.status;
    const progress = total > 0 ? `${completed}/${total}` : '-';

    console.log(
      `  ${phase.id.padEnd(4)} ${phase.name.padEnd(16)} ${status.padEnd(10)} ${progress}`
    );
  }

  if (readyTasks.length > 0) {
    logger.h2('就绪任务');
    for (const task of readyTasks.slice(0, 5)) {
      console.log(`  ${task.id}: ${task.title} (${task.assignee}) [${task.phase}]`);
    }
    if (readyTasks.length > 5) {
      logger.info(`... 还有 ${readyTasks.length - 5} 个就绪任务`);
    }
  }

  if (briefing.pendingReview.length > 0) {
    logger.h2('待审核交付物');
    for (const item of briefing.pendingReview.slice(0, 3)) {
      console.log(`  ${item.id}: ${item.title} (${item.taskId})`);
    }
  }

  if (briefing.blockedTasks.length > 0) {
    logger.h2('阻塞任务');
    for (const task of briefing.blockedTasks.slice(0, 3)) {
      console.log(`  ${task.id}: ${task.title} (${task.assignee}) [${task.phase}]`);
    }
  }

  if (latestSessions.length > 0) {
    logger.h2('最近会话');
    for (const session of latestSessions) {
      renderSessionLine(session);
    }
  }
}

function renderSessionLine(session: WorkspaceSessionIndexEntry): void {
  console.log(
    `  ${session.id}: ${session.status} (${session.currentPhase ?? 'no-phase'} / ${
      session.currentTask ?? 'no-task'
    })`
  );
}

function calculateTaskStats(tasks: Task[]): {
  total: number;
  ready: number;
  inProgress: number;
  completed: number;
  blocked: number;
  failed: number;
} {
  return {
    total: tasks.length,
    ready: tasks.filter((task) => task.status === 'ready').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    blocked: tasks.filter((task) => task.status === 'blocked').length,
    failed: tasks.filter((task) => task.status === 'failed').length
  };
}

function getReadyTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => task.status === 'ready')
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      return left.id.localeCompare(right.id);
    });
}
