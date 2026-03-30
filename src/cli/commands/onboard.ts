/**
 * onboard 命令 - 统一的 agent onboarding 入口
 */

import { Command } from 'commander';
import { getThreadLink, inspectThreadLink } from '../../core/threads.js';
import logger from '../utils/logger.js';
import { getLatestSuperpowersRun, inspectSuperpowersRun } from '../../core/superpowers-runs.js';
import { inspectWorkflowContext, normalizeWorkflowContext } from '../../core/workflow-context.js';
import { buildDoctorReport, type DoctorReport } from './doctor.js';
import { buildResumeSummary, type ResumeSummary } from './resume.js';

export interface OnboardingRecoveryTarget {
  status: 'none' | 'ready' | 'blocked';
  workflow: string | null;
  runId: string | null;
  branch: string | null;
  threadId: string | null;
  worktreePath: string | null;
  compactFromSession: string | null;
  missingArtifacts: string[];
  missingWorktreePath: string | null;
  missingCompactSessionId: string | null;
  missingThreadId: string | null;
}

export interface OnboardingRecoveryReadiness {
  overallStatus: 'ready' | 'blocked';
  workflowContext: OnboardingRecoveryTarget;
  latestSuperpowersRun: OnboardingRecoveryTarget;
  threadLinkage: OnboardingRecoveryTarget;
}

export interface OnboardingSummary {
  canProceed: boolean;
  status: 'ready' | 'blocked';
  doctor: DoctorReport;
  resume: ResumeSummary;
  shouldRead: string[];
  runtimeLogCommand: string | null;
  suggestedWorkflow: string | null;
  recoveryReadiness: OnboardingRecoveryReadiness;
  recommendedActions: string[];
}

export interface OnboardCommandOptions {
  json?: boolean;
}

export function createOnboardCommand(): Command {
  return new Command('onboard')
    .description('统一输出 doctor + resume + runtime log 的 agent onboarding 简报')
    .option('--json', '输出结构化 onboarding 简报，供 agent 或脚本消费')
    .action(async (options: OnboardCommandOptions) => {
      try {
        await onboardCommand(options);
      } catch (error) {
        logger.error(`onboarding 失败: ${error}`);
        process.exit(1);
      }
    });
}

export async function buildOnboardingSummary(
  basePath: string = process.cwd()
): Promise<OnboardingSummary> {
  const [doctor, resume, latestSuperpowersRun] = await Promise.all([
    buildDoctorReport(basePath),
    buildResumeSummary(basePath),
    getLatestSuperpowersRun(basePath)
  ]);
  const canProceed = doctor.summary.fail === 0;
  const recoveryReadiness = await buildRecoveryReadiness(basePath, resume, latestSuperpowersRun);

  return {
    canProceed,
    status: canProceed ? 'ready' : 'blocked',
    doctor,
    resume,
    shouldRead: resume.shouldRead,
    runtimeLogCommand: resume.runtimeLog.command,
    suggestedWorkflow: resume.superpowers.suggestedWorkflow,
    recoveryReadiness,
    recommendedActions: buildRecommendedActions(doctor, resume, canProceed, recoveryReadiness)
  };
}

export async function onboardCommand(
  optionsOrBasePath: OnboardCommandOptions | string = {},
  maybeBasePath?: string
): Promise<OnboardingSummary> {
  const options =
    typeof optionsOrBasePath === 'string'
      ? {}
      : optionsOrBasePath;
  const basePath =
    typeof optionsOrBasePath === 'string'
      ? optionsOrBasePath
      : (maybeBasePath ?? process.cwd());
  const summary = await buildOnboardingSummary(basePath);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  logger.h1('🧭 Agent Onboarding');
  logger.info(`status: ${summary.status}`);
  logger.info(
    `doctor: ok=${summary.doctor.summary.ok} | warn=${summary.doctor.summary.warn} | fail=${summary.doctor.summary.fail}`
  );
  logger.info(`next: ${summary.resume.nextAction}`);

  console.log();
  logger.h2('建议先读');
  logger.list(summary.shouldRead);

  console.log();
  logger.h2('恢复健康度');
  logger.info(`overall: ${summary.recoveryReadiness.overallStatus}`);
  renderRecoveryTarget('workflow context', summary.recoveryReadiness.workflowContext);
  renderRecoveryTarget('latest superpowers run', summary.recoveryReadiness.latestSuperpowersRun);
  renderRecoveryTarget('thread linkage', summary.recoveryReadiness.threadLinkage);

  if (summary.runtimeLogCommand) {
    console.log();
    logger.h2('Runtime 日志');
    logger.info(summary.runtimeLogCommand);
    logger.info(`context drift: ${summary.resume.runtimeLog.contextDrift.status}`);
    if (summary.resume.runtimeLog.contextDrift.reasons.length > 0) {
      logger.info(
        `drift reasons: ${summary.resume.runtimeLog.contextDrift.reasons.join(', ')}`
      );
    }
  }

  console.log();
  logger.h2('建议动作');
  logger.list(summary.recommendedActions);

  return summary;
}

function buildRecommendedActions(
  doctor: DoctorReport,
  resume: ResumeSummary,
  canProceed: boolean,
  recoveryReadiness: OnboardingRecoveryReadiness
): string[] {
  const actions: string[] = [];

  if (!canProceed) {
    return [...doctor.guidance];
  }

  actions.push(`执行当前下一步: ${resume.nextAction}`);

  if (resume.runtimeLog.command) {
    actions.push(`如需回看最近 runtime 细节，运行 ${resume.runtimeLog.command}`);
    if (resume.runtimeLog.contextDrift.status === 'drifted') {
      actions.push(
        `最近 runtime 与当前 workspace 上下文已漂移，先运行 ${resume.runtimeLog.command} 并核对 drift: ${resume.runtimeLog.contextDrift.reasons.join(', ')}`
      );
    } else if (resume.runtimeLog.contextDrift.status === 'aligned') {
      actions.push('最近 runtime 与当前 workspace 上下文对齐，可直接沿当前恢复线继续。');
    }
  }

  if (recoveryReadiness.workflowContext.status === 'blocked') {
    actions.push(
      `先修复 workflow context 缺失项：${formatRecoveryIssues(recoveryReadiness.workflowContext)}`
    );
  } else if (recoveryReadiness.workflowContext.status === 'ready') {
    actions.push(
      `沿当前 workflow context 恢复：branch=${recoveryReadiness.workflowContext.branch ?? 'none'}, worktree=${recoveryReadiness.workflowContext.worktreePath ?? 'none'}`
    );
  }
  if (resume.workflowContext?.compactFromSession) {
    actions.push(
      `如果这次恢复来自 compact，先读 .webforge/sessions/${resume.workflowContext.compactFromSession}.json`
    );
  }
  if (resume.workflowContext?.threadId) {
    actions.push(
      `如果沿 thread 恢复，先读 .webforge/threads.json 并核对 ${resume.workflowContext.threadId}`
    );
  }

  if (recoveryReadiness.latestSuperpowersRun.status === 'blocked') {
    actions.push(
      `先修复最近一次 superpowers run 缺失项：${formatRecoveryIssues(recoveryReadiness.latestSuperpowersRun)}`
    );
  }
  if (recoveryReadiness.threadLinkage.status === 'blocked') {
    actions.push(
      `先修复当前 thread linkage 缺失项：${formatRecoveryIssues(recoveryReadiness.threadLinkage)}`
    );
  } else if (recoveryReadiness.threadLinkage.status === 'ready') {
    actions.push(
      `当前 thread linkage 可恢复：thread=${recoveryReadiness.threadLinkage.threadId ?? 'none'}, worktree=${recoveryReadiness.threadLinkage.worktreePath ?? 'none'}`
    );
  }

  if (resume.latestSuperpowersRun?.artifacts[0]) {
    actions.push(
      `先读最近一次 ${resume.latestSuperpowersRun.workflow} 产物: ${resume.latestSuperpowersRun.artifacts[0]}`
    );
  }

  if (resume.workflowContext?.branch || resume.workflowContext?.worktreePath) {
    actions.push(
      `当前 workflow context: branch=${resume.workflowContext.branch ?? 'none'}, worktree=${resume.workflowContext.worktreePath ?? 'none'}`
    );
  }

  if (resume.superpowers.suggestedWorkflow) {
    actions.push(`如需方法增强，优先使用 ${resume.superpowers.suggestedWorkflow}`);
  }

  return actions;
}

async function buildRecoveryReadiness(
  basePath: string,
  resume: ResumeSummary,
  latestSuperpowersRun: Awaited<ReturnType<typeof getLatestSuperpowersRun>>
): Promise<OnboardingRecoveryReadiness> {
  const workflowContext = resume.workflowContext
    ? (() => {
        const normalizedWorkflowContext = normalizeWorkflowContext(resume.workflowContext);
        if (!normalizedWorkflowContext) {
          return {
            status: 'none',
            workflow: null,
            runId: null,
            branch: null,
            threadId: null,
            worktreePath: null,
            compactFromSession: null,
            missingArtifacts: [],
            missingWorktreePath: null,
            missingCompactSessionId: null,
            missingThreadId: null
          } satisfies OnboardingRecoveryTarget;
        }

        const readiness = inspectWorkflowContext(basePath, normalizedWorkflowContext);
        return {
          status:
            readiness.missingArtifacts.length > 0 ||
            readiness.missingWorktreePath ||
            readiness.missingCompactSessionId
              ? 'blocked'
              : 'ready',
          workflow: resume.workflowContext.workflow,
          runId: resume.workflowContext.runId,
          branch: resume.workflowContext.branch,
          threadId: resume.workflowContext.threadId,
          worktreePath: resume.workflowContext.worktreePath,
          compactFromSession: resume.workflowContext.compactFromSession,
          missingArtifacts: readiness.missingArtifacts,
          missingWorktreePath: readiness.missingWorktreePath,
          missingCompactSessionId: readiness.missingCompactSessionId,
          missingThreadId: null
        } satisfies OnboardingRecoveryTarget;
      })()
    : ({
        status: 'none',
        workflow: null,
        runId: null,
        branch: null,
        threadId: null,
        worktreePath: null,
        compactFromSession: null,
        missingArtifacts: [],
        missingWorktreePath: null,
        missingCompactSessionId: null,
        missingThreadId: null
      } satisfies OnboardingRecoveryTarget);

  const latestRun = latestSuperpowersRun
    ? (() => {
        const readiness = inspectSuperpowersRun(basePath, latestSuperpowersRun);
        return {
          status:
            readiness.missingArtifacts.length > 0 ||
            readiness.missingWorktreePath ||
            readiness.missingCompactSessionId
              ? 'blocked'
              : 'ready',
          workflow: latestSuperpowersRun.workflow,
          runId: latestSuperpowersRun.id,
          branch: latestSuperpowersRun.metadata?.branch ?? null,
          threadId: latestSuperpowersRun.metadata?.threadId ?? null,
          worktreePath: latestSuperpowersRun.metadata?.worktreePath ?? null,
          compactFromSession: latestSuperpowersRun.metadata?.compactFromSession ?? null,
          missingArtifacts: readiness.missingArtifacts,
          missingWorktreePath: readiness.missingWorktreePath,
          missingCompactSessionId: readiness.missingCompactSessionId,
          missingThreadId: null
        } satisfies OnboardingRecoveryTarget;
      })()
    : ({
        status: 'none',
        workflow: null,
        runId: null,
        branch: null,
        threadId: null,
        worktreePath: null,
        compactFromSession: null,
        missingArtifacts: [],
        missingWorktreePath: null,
        missingCompactSessionId: null,
        missingThreadId: null
      } satisfies OnboardingRecoveryTarget);

  const currentThreadId =
    resume.workflowContext?.threadId ??
    latestSuperpowersRun?.metadata?.threadId ??
    null;
  const threadLinkage = !currentThreadId
    ? ({
        status: 'none',
        workflow: null,
        runId: null,
        branch: null,
        threadId: null,
        worktreePath: null,
        compactFromSession: null,
        missingArtifacts: [],
        missingWorktreePath: null,
        missingCompactSessionId: null,
        missingThreadId: null
      } satisfies OnboardingRecoveryTarget)
    : await (async () => {
        const threadLink = await getThreadLink(basePath, currentThreadId);
        if (!threadLink) {
          return {
            status: 'blocked',
            workflow: null,
            runId: null,
            branch: null,
            threadId: currentThreadId,
            worktreePath: null,
            compactFromSession: null,
            missingArtifacts: [],
            missingWorktreePath: null,
            missingCompactSessionId: null,
            missingThreadId: currentThreadId
          } satisfies OnboardingRecoveryTarget;
        }

        const readiness = inspectThreadLink(basePath, threadLink);
        return {
          status:
            readiness.missingArtifacts.length > 0 || readiness.missingWorktreePath
              ? 'blocked'
              : 'ready',
          workflow: threadLink.workflow,
          runId: threadLink.runId ?? null,
          branch: threadLink.branch ?? null,
          threadId: threadLink.id,
          worktreePath: threadLink.worktreePath ?? null,
          compactFromSession: null,
          missingArtifacts: readiness.missingArtifacts,
          missingWorktreePath: readiness.missingWorktreePath,
          missingCompactSessionId: null,
          missingThreadId: null
        } satisfies OnboardingRecoveryTarget;
      })();

  return {
    overallStatus:
      workflowContext.status === 'blocked' ||
      latestRun.status === 'blocked' ||
      threadLinkage.status === 'blocked'
        ? 'blocked'
        : 'ready',
    workflowContext,
    latestSuperpowersRun: latestRun,
    threadLinkage
  };
}

function renderRecoveryTarget(label: string, target: OnboardingRecoveryTarget): void {
  if (target.status === 'none') {
    logger.info(`${label}: none`);
    return;
  }

  logger.info(
    `${label}: ${target.status} (${target.workflow ?? 'unknown'} / ${target.branch ?? 'no-branch'})`
  );
  if (target.worktreePath) {
    logger.info(`  worktree: ${target.worktreePath}`);
  }
  if (target.threadId) {
    logger.info(`  thread: ${target.threadId}`);
  }
  if (target.compactFromSession) {
    logger.info(`  compact from: ${target.compactFromSession}`);
  }
  if (target.status === 'blocked') {
    logger.info(`  issues: ${formatRecoveryIssues(target)}`);
  }
}

function formatRecoveryIssues(target: OnboardingRecoveryTarget): string {
  const issues: string[] = [];
  if (target.missingArtifacts.length > 0) {
    issues.push(`missing artifacts=${target.missingArtifacts.join(', ')}`);
  }
  if (target.missingWorktreePath) {
    issues.push(`missing worktree=${target.missingWorktreePath}`);
  }
  if (target.missingCompactSessionId) {
    issues.push(`missing compact session=${target.missingCompactSessionId}`);
  }
  if (target.missingThreadId) {
    issues.push(`missing thread=${target.missingThreadId}`);
  }
  return issues.join('; ');
}
