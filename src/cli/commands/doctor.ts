/**
 * doctor 命令 - 校验 repo-side harness 契约是否完整
 */

import { existsSync, readFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { Command } from 'commander';
import { listCheckpoints } from '../../core/checkpoint.js';
import { getLatestRuntimeObservation } from '../../core/logger.js';
import { Mailbox } from '../../core/mailbox.js';
import { inspectSuperpowersRun } from '../../core/superpowers-runs.js';
import { inspectThreadLink } from '../../core/threads.js';
import { buildRuntimeLogsSummary } from './logs.js';
import {
  getRuntimeWorkflowContext,
  getSessionWorkflowContext,
  inspectWorkflowContext,
  pickWorkflowContext
} from '../../core/workflow-context.js';
import logger from '../utils/logger.js';
import { loadConfig } from '../../utils/config.js';
import { loadWorkspaceState } from '../../core/workspace.js';

export type DoctorCheckStatus = 'ok' | 'warn' | 'fail';

export interface DoctorCheck {
  id: string;
  label: string;
  status: DoctorCheckStatus;
  detail: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  summary: {
    ok: number;
    warn: number;
    fail: number;
  };
  guidance: string[];
}

export interface DoctorCommandOptions {
  json?: boolean;
}

export function createDoctorCommand(): Command {
  return new Command('doctor')
    .description('校验 WebForge 仓库契约、workspace 状态和 superpowers 集成入口')
    .option('--json', '输出结构化仓库契约报告，供 agent 或脚本消费')
    .action(async (options: DoctorCommandOptions) => {
      try {
        await doctorCommand(options);
      } catch (error) {
        logger.error(`校验失败: ${error}`);
        process.exit(1);
      }
    });
}

export async function doctorCommand(
  optionsOrBasePath: DoctorCommandOptions | string = {},
  maybeBasePath?: string
): Promise<DoctorReport> {
  const options =
    typeof optionsOrBasePath === 'string'
      ? {}
      : optionsOrBasePath;
  const basePath =
    typeof optionsOrBasePath === 'string'
      ? optionsOrBasePath
      : (maybeBasePath ?? process.cwd());
  const report = await buildDoctorReport(basePath);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  logger.h1('🩺 WebForge Doctor');
  logger.info(
    `通过: ${report.summary.ok} | 警告: ${report.summary.warn} | 失败: ${report.summary.fail}`
  );

  console.log();
  for (const check of report.checks) {
    const icon = statusIcon(check.status);
    console.log(`  ${icon} ${check.label}`);
    console.log(`    ${check.detail}`);
  }

  console.log();
  logger.info('下一步:');
  logger.list(report.guidance);

  return report;
}

export async function buildDoctorReport(
  basePath: string = process.cwd()
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const agentsPath = join(basePath, 'AGENTS.md');
  const workspaceRoot = join(basePath, '.webforge');
  const runtimePath = join(workspaceRoot, 'runtime.json');
  const tasksPath = join(workspaceRoot, 'tasks.json');
  const phasesPath = join(workspaceRoot, 'phases.json');
  const sessionsIndexPath = join(workspaceRoot, 'sessions', 'index.json');
  const knowledgeIndexPath = join(workspaceRoot, 'knowledge', 'index.json');
  const deliverablesIndexPath = join(workspaceRoot, 'deliverables', 'index.json');
  const mailboxesPath = join(workspaceRoot, 'mailboxes');
  const superpowersRunsPath = join(workspaceRoot, 'superpowers-runs.json');
  const threadsIndexPath = join(workspaceRoot, 'threads.json');
  const superpowersDocPath = join(basePath, 'docs', 'methodology', 'superpowers-integration.md');
  const agentGuidePath = join(basePath, 'docs', 'agent-guide.md');

  checks.push(
    createPresenceCheck('agents', 'AGENTS.md', agentsPath, true, '仓库规则入口已存在')
  );
  
  // 检查 AGENTS.md 是否包含强制规范
  if (existsSync(agentsPath)) {
    const agentsContent = readFileSync(agentsPath, 'utf-8');
    const hasMandatorySection = agentsContent.includes('强制规范') || agentsContent.includes('MANDATORY');
    const hasCLiRequirement = agentsContent.includes('webforge task') && agentsContent.includes('禁止');
    const hasCommitFormat = agentsContent.includes('<task-id>:');
    
    if (hasMandatorySection && hasCLiRequirement && hasCommitFormat) {
      checks.push({
        id: 'agents-mandatory-protocol',
        label: 'AGENTS.md 强制规范',
        status: 'ok',
        detail: '已包含强制 CLI 操作规范和提交格式要求'
      });
    } else {
      checks.push({
        id: 'agents-mandatory-protocol',
        label: 'AGENTS.md 强制规范',
        status: 'warn',
        detail: 'AGENTS.md 缺少强制规范部分，建议更新到最新版本'
      });
    }
  }
  
  checks.push(
    createPresenceCheck(
      'workspace',
      '.webforge workspace',
      workspaceRoot,
      true,
      'workspace 状态目录已存在'
    )
  );
  checks.push(
    createPresenceCheck(
      'runtime',
      'runtime.json',
      runtimePath,
      true,
      'runtime 主循环状态可恢复'
    )
  );
  checks.push(
    createPresenceCheck('tasks', 'tasks.json', tasksPath, true, '任务图状态文件已存在')
  );
  checks.push(
    createPresenceCheck('phases', 'phases.json', phasesPath, true, '阶段图状态文件已存在')
  );
  checks.push(
    createPresenceCheck(
      'sessions',
      'sessions/index.json',
      sessionsIndexPath,
      false,
      '会话索引存在，可恢复跨会话上下文'
    )
  );
  checks.push(
    createPresenceCheck(
      'knowledge',
      'knowledge/index.json',
      knowledgeIndexPath,
      false,
      '知识索引存在，可为 agent 提供按需上下文'
    )
  );
  checks.push(
    createPresenceCheck(
      'deliverables',
      'deliverables/index.json',
      deliverablesIndexPath,
      false,
      '交付物索引存在，可追踪产出'
    )
  );
  checks.push(
    createPresenceCheck(
      'mailboxes',
      '.webforge/mailboxes',
      mailboxesPath,
      false,
      'mailbox 观察入口已存在'
    )
  );
  checks.push(
    createPresenceCheck(
      'superpowers-runs',
      '.webforge/superpowers-runs.json',
      superpowersRunsPath,
      false,
      'superpowers workflow run 索引已存在'
    )
  );
  checks.push(
    createPresenceCheck(
      'threads',
      '.webforge/threads.json',
      threadsIndexPath,
      false,
      'thread linkage 索引已存在'
    )
  );
  checks.push(
    createPresenceCheck(
      'agent-guide',
      'docs/agent-guide.md',
      agentGuidePath,
      false,
      '仓库内 agent 工作顺序文档已存在'
    )
  );
  checks.push(
    createPresenceCheck(
      'superpowers-doc',
      'docs/methodology/superpowers-integration.md',
      superpowersDocPath,
      false,
      'superpowers 与 WebForge 的边界文档已存在'
    )
  );

  if (existsSync(workspaceRoot)) {
    try {
      const config = await loadConfig(basePath);
      const provider = config.agent?.provider ?? 'stub';
      const permission = config.agent?.permission_profile ?? 'workspace-write';
      checks.push({
        id: 'agent-profile',
        label: 'agent profile',
        status: 'ok',
        detail: `provider=${provider}, permission_profile=${permission}`
      });
    } catch (error) {
      checks.push({
        id: 'agent-profile',
        label: 'agent profile',
        status: 'warn',
        detail: `config.yaml 无法读取 agent profile: ${String(error)}`
      });
    }

    try {
      const workspace = await loadWorkspaceState(basePath);
      const readyCount = workspace.tasks.tasks.filter((task) => task.status === 'ready').length;
      const pendingReviewCount = workspace.indexes.deliverables.filter(
        (item) => item.status === 'pending_review'
      ).length;
      checks.push({
        id: 'workspace-state',
        label: 'workspace state',
        status: 'ok',
        detail: `runtime=${workspace.runtime.status}, ready=${readyCount}, pending_review=${pendingReviewCount}`
      });

      // 检查 knowledge 目录结构
      const knowledgeStructureCheck = await checkKnowledgeStructure(basePath);
      checks.push(knowledgeStructureCheck);

      const runtimeObservation = await getLatestRuntimeObservation(basePath);
      checks.push({
        id: 'runtime-observability',
        label: 'runtime observability',
        status: 'ok',
        detail: runtimeObservation
          ? `latest_session=${runtimeObservation.sessionId}, last_event=${runtimeObservation.lastEvent ?? 'none'}, permission=${runtimeObservation.permissionProfile ?? 'unknown'}`
          : 'runtime 日志入口已就绪，当前尚无执行日志'
      });
      const runtimeLogsSummary = await buildRuntimeLogsSummary(undefined, basePath).catch(() => null);
      checks.push({
        id: 'runtime-context-drift',
        label: 'runtime context drift',
        status:
          runtimeLogsSummary?.contextDrift.status === 'drifted'
            ? 'warn'
            : 'ok',
        detail: !runtimeLogsSummary
          ? '当前没有 runtime 日志，尚无法判断历史上下文是否漂移'
          : runtimeLogsSummary.contextDrift.status === 'none'
            ? '最近 runtime 缺少足够的 workflow/thread 上下文，暂无漂移信号'
            : runtimeLogsSummary.contextDrift.status === 'aligned'
              ? '最近 runtime 与当前 workspace 上下文对齐'
              : `drifted: ${runtimeLogsSummary.contextDrift.reasons.join(', ')}`
      });

      const mailboxSignals = await collectMailboxSignals(basePath);
      checks.push({
        id: 'mailbox-observability',
        label: 'mailbox observability',
        status: mailboxSignals.unread > 0 ? 'warn' : 'ok',
        detail:
          mailboxSignals.unread > 0
            ? `workers=${mailboxSignals.workers}, unread=${mailboxSignals.unread}`
            : `workers=${mailboxSignals.workers}, unread=0`
      });
      checks.push({
        id: 'review-observability',
        label: 'review observability',
        status: pendingReviewCount > 0 ? 'warn' : 'ok',
        detail:
          pendingReviewCount > 0
            ? `pending_review=${pendingReviewCount}`
            : 'pending_review=0'
      });

      const checkpoints = await listCheckpoints(basePath);
      checks.push({
        id: 'checkpoint-observability',
        label: 'checkpoint observability',
        status: 'ok',
        detail:
          checkpoints.length > 0
            ? `checkpoints=${checkpoints.length}, latest=${checkpoints[0]?.id ?? 'none'}`
            : 'checkpoint 入口已就绪，当前尚无快照'
      });

      const currentWorkflowContext = pickWorkflowContext(
        getRuntimeWorkflowContext(workspace.runtime),
        workspace.indexes.sessions.length > 0
          ? getSessionWorkflowContext(workspace.indexes.sessions[0])
          : null
      );
      if (!currentWorkflowContext) {
        checks.push({
          id: 'workflow-context-readiness',
          label: 'workflow context readiness',
          status: 'ok',
          detail: '当前没有挂载中的 workflow context'
        });
      } else {
        const readiness = inspectWorkflowContext(basePath, currentWorkflowContext);
        checks.push({
          id: 'workflow-context-readiness',
          label: 'workflow context readiness',
          status:
            readiness.missingArtifacts.length > 0 ||
            readiness.missingWorktreePath ||
            readiness.missingCompactSessionId
              ? 'fail'
              : 'ok',
          detail:
            readiness.missingArtifacts.length > 0 ||
            readiness.missingWorktreePath ||
            readiness.missingCompactSessionId
              ? [
                  `workflow=${currentWorkflowContext.workflow}`,
                  currentWorkflowContext.branch
                    ? `branch=${currentWorkflowContext.branch}`
                    : null,
                  readiness.missingArtifacts.length > 0
                    ? `missing_artifacts=${readiness.missingArtifacts.join(', ')}`
                    : null,
                  readiness.missingWorktreePath
                    ? `missing_worktree=${readiness.missingWorktreePath}`
                    : null,
                  readiness.missingCompactSessionId
                    ? `missing_compact_session=${readiness.missingCompactSessionId}`
                    : null
                ]
                  .filter((item): item is string => item !== null)
                  .join(', ')
              : [
                  `workflow=${currentWorkflowContext.workflow}`,
                  currentWorkflowContext.branch
                    ? `branch=${currentWorkflowContext.branch}`
                    : null,
                  currentWorkflowContext.worktreePath
                    ? `worktree=${currentWorkflowContext.worktreePath}`
                    : null,
                  currentWorkflowContext.waveId
                    ? `wave=${currentWorkflowContext.waveId}`
                    : null,
                  currentWorkflowContext.threadId
                    ? `thread=${currentWorkflowContext.threadId}`
                    : null,
                  currentWorkflowContext.compactFromSession
                    ? `compact_from=${currentWorkflowContext.compactFromSession}`
                    : null
                ]
                  .filter((item): item is string => item !== null)
                  .join(', ')
        });
      }

      if (!currentWorkflowContext?.threadId) {
        checks.push({
          id: 'thread-linkage-readiness',
          label: 'thread linkage readiness',
          status: 'ok',
          detail: '当前没有挂载中的 thread linkage'
        });
      } else {
        const threadLink =
          workspace.indexes.threads.find((link) => link.id === currentWorkflowContext.threadId) ?? null;
        if (!threadLink) {
          checks.push({
            id: 'thread-linkage-readiness',
            label: 'thread linkage readiness',
            status: 'fail',
            detail: `missing_thread=${currentWorkflowContext.threadId}`
          });
        } else {
          const readiness = inspectThreadLink(basePath, threadLink);
          checks.push({
            id: 'thread-linkage-readiness',
            label: 'thread linkage readiness',
            status:
              readiness.missingArtifacts.length > 0 || readiness.missingWorktreePath
                ? 'fail'
                : 'ok',
            detail:
              readiness.missingArtifacts.length > 0 || readiness.missingWorktreePath
                ? [
                    `thread=${threadLink.id}`,
                    readiness.missingArtifacts.length > 0
                      ? `missing_artifacts=${readiness.missingArtifacts.join(', ')}`
                      : null,
                    readiness.missingWorktreePath
                      ? `missing_worktree=${readiness.missingWorktreePath}`
                      : null
                  ]
                    .filter((item): item is string => item !== null)
                    .join(', ')
                : `thread=${threadLink.id}, workflow=${threadLink.workflow}, artifacts=${threadLink.artifacts.length}`
          });
        }
      }

      const latestSuperpowersRun = workspace.indexes.superpowersRuns[0];
      if (!latestSuperpowersRun) {
        checks.push({
          id: 'superpowers-readiness',
          label: 'superpowers readiness',
          status: 'ok',
          detail: 'superpowers run 索引已就绪，当前尚无持久化 workflow 结果'
        });
      } else {
        const readiness = inspectSuperpowersRun(basePath, latestSuperpowersRun);
        const hasMissingArtifacts = readiness.missingArtifacts.length > 0;
        const hasMissingWorktree = readiness.missingWorktreePath !== null;
        const hasMissingCompactSession = readiness.missingCompactSessionId !== null;
        checks.push({
          id: 'superpowers-readiness',
          label: 'superpowers readiness',
          status: hasMissingArtifacts || hasMissingWorktree || hasMissingCompactSession ? 'fail' : 'ok',
          detail:
            hasMissingArtifacts || hasMissingWorktree || hasMissingCompactSession
              ? [
                  `latest_workflow=${latestSuperpowersRun.workflow}`,
                  readiness.missingArtifacts.length > 0
                    ? `missing_artifacts=${readiness.missingArtifacts.join(', ')}`
                    : null,
                  readiness.missingWorktreePath
                    ? `missing_worktree=${readiness.missingWorktreePath}`
                    : null,
                  readiness.missingCompactSessionId
                    ? `missing_compact_session=${readiness.missingCompactSessionId}`
                    : null
                ]
                  .filter((item): item is string => item !== null)
                  .join(', ')
              : `latest_workflow=${latestSuperpowersRun.workflow}, artifacts=${latestSuperpowersRun.artifacts.length}`
        });
      }
    } catch (error) {
      checks.push({
        id: 'workspace-state',
        label: 'workspace state',
        status: 'fail',
        detail: `workspace 状态读取失败: ${String(error)}`
      });
    }
  }

  const report = {
    checks,
    summary: {
      ok: checks.filter((check) => check.status === 'ok').length,
      warn: checks.filter((check) => check.status === 'warn').length,
      fail: checks.filter((check) => check.status === 'fail').length
    },
    guidance: [] as string[]
  };
  report.guidance = buildDoctorGuidance(report);
  return report;
}

function createPresenceCheck(
  id: string,
  label: string,
  path: string,
  required: boolean,
  successDetail: string
): DoctorCheck {
  if (existsSync(path)) {
    return {
      id,
      label,
      status: 'ok',
      detail: successDetail
    };
  }

  return {
    id,
    label,
    status: required ? 'fail' : 'warn',
    detail: required ? `缺失: ${path}` : `建议补齐: ${path}`
  };
}

function statusIcon(status: DoctorCheckStatus): string {
  switch (status) {
    case 'ok':
      return '✅';
    case 'warn':
      return '⚠';
    case 'fail':
    default:
      return '❌';
  }
}

function buildDoctorGuidance(report: DoctorReport): string[] {
  const guidance: string[] = [];

  if (report.checks.some((check) => check.id === 'workspace' && check.status === 'fail')) {
    guidance.push('先初始化或恢复 .webforge/，确保仓库内有 workspace contract。');
  }

  if (report.checks.some((check) => check.id === 'agents' && check.status === 'fail')) {
    guidance.push('补齐 AGENTS.md，把仓库规则和读取顺序写成硬约束。');
  }

  if (report.checks.some((check) => check.id === 'agents-mandatory-protocol' && check.status === 'warn')) {
    guidance.push('更新 AGENTS.md 添加强制规范部分：所有任务必须通过 webforge CLI 操作，禁止直接修改状态文件。');
  }

  if (report.checks.some((check) => check.id === 'superpowers-doc' && check.status !== 'ok')) {
    guidance.push('补齐 superpowers 集成文档，明确状态与方法的边界。');
  }

  if (report.checks.some((check) => check.id === 'mailbox-observability' && check.status === 'warn')) {
    guidance.push('先检查 mailbox 未读消息，避免错过协作信号。');
  }

  if (report.checks.some((check) => check.id === 'review-observability' && check.status === 'warn')) {
    guidance.push('先处理 pending_review 交付物，再继续推进新的实现。');
  }

  if (report.checks.some((check) => check.id === 'runtime-context-drift' && check.status === 'warn')) {
    guidance.push('最近 runtime 上下文与当前 workspace 已漂移，先运行 webforge logs runtime 并核对 drift，再决定是否沿当前上下文继续。');
  }

  if (report.checks.some((check) => check.id === 'superpowers-readiness' && check.status === 'fail')) {
    guidance.push('修复最近一次 superpowers workflow 记录指向的缺失产物、worktree 或 compact session，再依赖其恢复上下文。');
  }

  if (report.checks.some((check) => check.id === 'workflow-context-readiness' && check.status === 'fail')) {
    guidance.push('修复当前 workflow context 指向的缺失 worktree、artifact 或 compact session，再继续沿该上下文恢复。');
  }

  if (report.checks.some((check) => check.id === 'thread-linkage-readiness' && check.status === 'fail')) {
    guidance.push('修复当前 thread linkage 缺失的索引、artifact 或 worktree，再沿该 thread 恢复。');
  }

  if (report.checks.some((check) => check.id === 'knowledge-structure' && check.status === 'warn')) {
    guidance.push('knowledge 根目录发现直接写入的文件，请使用 webforge knowledge add/create 命令移动到子目录，或手动整理。');
  }

  if (guidance.length === 0) {
    guidance.push('仓库契约基本完整，可以直接让 Codex / Claude Code 按 AGENTS.md + .webforge/ 继续工作。');
    guidance.push('开始工作前先读 AGENTS.md、runtime.json、tasks.json 和 sessions/index.json。');
  }

  return guidance;
}

async function collectMailboxSignals(
  basePath: string
): Promise<{ workers: number; unread: number }> {
  const workerIds = await discoverMailboxWorkers(basePath);
  let unread = 0;

  for (const workerId of workerIds) {
    const mailbox = new Mailbox(workerId, basePath);
    await mailbox.init();
    unread += await mailbox.getUnreadCount();
  }

  return {
    workers: workerIds.length,
    unread
  };
}

async function discoverMailboxWorkers(basePath: string): Promise<string[]> {
  const workerIds = new Set<string>();

  try {
    const config = await loadConfig(basePath);
    for (const workerId of config.workers) {
      workerIds.add(workerId);
    }
  } catch {
    // config 不是 mailbox 观察面的强依赖
  }

  const mailboxRoot = join(basePath, '.webforge', 'mailboxes');
  if (existsSync(mailboxRoot)) {
    const entries = await readdir(mailboxRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        workerIds.add(entry.name.slice(0, -'.jsonl'.length));
      }
    }
  }

  return Array.from(workerIds).sort();
}

async function checkKnowledgeStructure(basePath: string): Promise<DoctorCheck> {
  const knowledgeDir = join(basePath, '.webforge', 'knowledge');
  
  if (!existsSync(knowledgeDir)) {
    return {
      id: 'knowledge-structure',
      label: 'knowledge directory structure',
      status: 'ok',
      detail: 'knowledge 目录不存在，跳过检查'
    };
  }

  const allowedCategories = ['requirements', 'design', 'decisions', 'data', 'raw', 'parsed'];
  const rootFiles: string[] = [];

  try {
    const entries = await readdir(knowledgeDir, { withFileTypes: true });
    for (const entry of entries) {
      // 检查根目录下的文件（非目录、非 index.json）
      if (entry.isFile() && entry.name !== 'index.json') {
        rootFiles.push(entry.name);
      }
    }
  } catch {
    // 目录读取失败
  }

  if (rootFiles.length > 0) {
    return {
      id: 'knowledge-structure',
      label: 'knowledge directory structure',
      status: 'warn',
      detail: `发现 ${rootFiles.length} 个文件直接放在 knowledge 根目录: ${rootFiles.join(', ')}。请使用 webforge knowledge add/create 命令写入子目录`
    };
  }

  return {
    id: 'knowledge-structure',
    label: 'knowledge directory structure',
    status: 'ok',
    detail: 'knowledge 目录结构正确，文档已分类到子目录'
  };
}
