/**
 * record 命令 - 旁路回写
 *
 * 当 agent 直接在仓库里工作（不走 webforge run 主循环）时，
 * 用这个命令把已完成的工作回写到 .webforge/。
 *
 * 这解决了 harness 的核心缺陷：只有 runtime 主循环内部才会自动回写状态。
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import logger from '../utils/logger.js';
import { readJson, writeJson } from '../../utils/file.js';
import { LogManager } from '../../core/logger.js';
import type { WorkspaceRuntime } from '../../types/index.js';

interface RecordTaskOptions {
  status?: string;
  summary?: string;
  deliverable?: string[];
  session?: string;
}

interface RecordSessionOptions {
  summary?: string;
  phase?: string;
  task?: string;
}

export function createRecordCommand(): Command {
  const command = new Command('record')
    .description('旁路回写：把直接完成的工作记录到 .webforge/');

  command
    .command('task <task-id>')
    .description('更新任务状态并记录到 runtime log')
    .option('-s, --status <status>', '任务状态: completed/in_progress/blocked', 'completed')
    .option('--summary <text>', '完成摘要')
    .option('-d, --deliverable <paths...>', '关联的交付物文件路径')
    .option('--session <id>', '会话 ID（默认自动生成）')
    .action(async (taskId: string, options: RecordTaskOptions) => {
      try {
        await recordTask(taskId, options);
      } catch (error) {
        logger.error(`回写失败: ${error}`);
        process.exit(1);
      }
    });

  command
    .command('session')
    .description('创建或更新当前工作会话')
    .option('--summary <text>', '会话摘要')
    .option('-p, --phase <id>', '当前阶段')
    .option('-t, --task <id>', '当前任务')
    .action(async (options: RecordSessionOptions) => {
      try {
        await recordSession(options);
      } catch (error) {
        logger.error(`回写失败: ${error}`);
        process.exit(1);
      }
    });

  command
    .command('log <message>')
    .description('追加一条 runtime 事件日志')
    .option('-t, --task <id>', '关联的任务 ID')
    .option('--level <level>', '日志级别: info/warning/error', 'info')
    .action(async (message: string, options: { task?: string; level?: string }) => {
      try {
        await recordLog(message, options);
      } catch (error) {
        logger.error(`回写失败: ${error}`);
        process.exit(1);
      }
    });

  command
    .command('auto')
    .description('自动检测 git 变更并回写到 .webforge/（适合 hook 调用）')
    .option('--summary <text>', '工作摘要')
    .option('--json', 'JSON 输出')
    .action(async (options: { summary?: string; json?: boolean }) => {
      try {
        await recordAuto(options);
      } catch (error) {
        if (!options.json) {
          logger.error(`自动回写失败: ${error}`);
        }
        process.exit(1);
      }
    });

  command
    .command('snapshot')
    .description('保存当前工作快照（适合会话结束时的 Stop hook）')
    .option('--reason <text>', '快照原因', 'session_end')
    .option('--json', 'JSON 输出')
    .action(async (options: { reason?: string; json?: boolean }) => {
      try {
        await recordSnapshot(options);
      } catch (error) {
        if (!options.json) {
          logger.error(`快照失败: ${error}`);
        }
        process.exit(1);
      }
    });

  return command;
}

async function recordTask(
  taskId: string,
  options: RecordTaskOptions,
  basePath: string = process.cwd()
): Promise<void> {
  const tasksPath = join(basePath, '.webforge', 'tasks.json');
  const runtimePath = join(basePath, '.webforge', 'runtime.json');

  if (!existsSync(tasksPath)) {
    throw new Error('.webforge/tasks.json 不存在，请先运行 webforge init');
  }

  const tasksData = await readJson<{ tasks: Array<Record<string, unknown>> }>(tasksPath);
  const task = tasksData.tasks.find((t) => t.id === taskId);
  if (!task) {
    throw new Error(`任务 ${taskId} 不存在`);
  }

  const newStatus = options.status ?? 'completed';
  const now = new Date().toISOString();
  const oldStatus = task.status;
  task.status = newStatus;
  task.updated_at = now;

  if (options.summary) {
    task.description = options.summary;
  }

  await writeJson(tasksPath, tasksData);

  // 写 runtime log
  const sessionId = options.session ?? await getOrCreateSessionId(basePath);
  const logManager = new LogManager('runtime', basePath, sessionId);
  await logManager.addEntry('info', `task_${newStatus}`, {
    taskId,
    metadata: {
      previousStatus: oldStatus,
      newStatus,
      summary: options.summary ?? `${taskId} marked as ${newStatus}`,
      recordedBy: 'webforge record task',
      sessionId
    }
  });

  // 写 deliverables
  if (options.deliverable && options.deliverable.length > 0) {
    await recordDeliverables(basePath, taskId, options.deliverable, now);
  }

  // 更新 runtime
  const runtime = await readJson<WorkspaceRuntime>(runtimePath);
  runtime.updatedAt = now;
  runtime.sessionId = sessionId;
  runtime.taskId = taskId;
  runtime.phaseId = (task.phase as string) ?? runtime.phaseId;
  runtime.summary = options.summary ?? `${taskId} → ${newStatus}`;
  await writeJson(runtimePath, runtime);

  // 更新 session
  await persistSessionRecord(basePath, sessionId, taskId, task.phase as string, now);

  logger.success(`${taskId}: ${oldStatus} → ${newStatus}`);
  if (options.deliverable) {
    logger.info(`交付物: ${options.deliverable.join(', ')}`);
  }
  logger.info(`会话: ${sessionId}`);
  logger.info(`日志: .webforge/logs/runtime-${sessionId}.jsonl`);
}

async function recordSession(
  options: RecordSessionOptions,
  basePath: string = process.cwd()
): Promise<void> {
  const runtimePath = join(basePath, '.webforge', 'runtime.json');
  if (!existsSync(runtimePath)) {
    throw new Error('.webforge/runtime.json 不存在');
  }

  const now = new Date().toISOString();
  const sessionId = await getOrCreateSessionId(basePath);

  const runtime = await readJson<WorkspaceRuntime>(runtimePath);
  runtime.updatedAt = now;
  runtime.status = 'active';
  runtime.sessionId = sessionId;
  if (options.phase) {
    runtime.phaseId = options.phase;
  }
  if (options.task) {
    runtime.taskId = options.task;
  }
  if (options.summary) {
    runtime.summary = options.summary;
  }
  await writeJson(runtimePath, runtime);

  await persistSessionRecord(
    basePath,
    sessionId,
    options.task ?? runtime.taskId ?? null,
    options.phase ?? runtime.phaseId ?? null,
    now
  );

  const logManager = new LogManager('runtime', basePath, sessionId);
  await logManager.addEntry('info', 'session_recorded', {
    metadata: {
      summary: options.summary ?? 'session recorded via webforge record',
      recordedBy: 'webforge record session'
    }
  });

  logger.success(`会话已记录: ${sessionId}`);
  logger.info(`状态: phase=${options.phase ?? 'unchanged'}, task=${options.task ?? 'unchanged'}`);
}

async function recordLog(
  message: string,
  options: { task?: string; level?: string },
  basePath: string = process.cwd()
): Promise<void> {
  const sessionId = await getOrCreateSessionId(basePath);
  const logManager = new LogManager('runtime', basePath, sessionId);
  const level = (options.level ?? 'info') as 'info' | 'warning' | 'error';

  await logManager.addEntry(level, message, {
    taskId: options.task,
    metadata: {
      recordedBy: 'webforge record log'
    }
  });

  logger.success(`日志已记录: ${message}`);
}

async function getOrCreateSessionId(basePath: string): Promise<string> {
  const runtimePath = join(basePath, '.webforge', 'runtime.json');
  if (existsSync(runtimePath)) {
    const runtime = await readJson<WorkspaceRuntime>(runtimePath);
    if (runtime.sessionId) {
      return runtime.sessionId;
    }
  }
  return `record-${Date.now()}`;
}

async function persistSessionRecord(
  basePath: string,
  sessionId: string,
  taskId: string | null,
  phaseId: string | null,
  timestamp: string
): Promise<void> {
  const sessionsPath = join(basePath, '.webforge', 'sessions', 'index.json');
  const sessions = existsSync(sessionsPath)
    ? await readJson<Array<Record<string, unknown>>>(sessionsPath)
    : [];

  const existingIndex = sessions.findIndex((s) => s.id === sessionId);
  const sessionRecord = {
    id: sessionId,
    name: `work session ${sessionId}`,
    status: 'active',
    lastActive: timestamp,
    currentTask: taskId,
    currentPhase: phaseId
  };

  if (existingIndex >= 0) {
    sessions[existingIndex] = { ...sessions[existingIndex], ...sessionRecord };
  } else {
    sessions.push(sessionRecord);
  }

  await writeJson(sessionsPath, sessions);
}

async function recordDeliverables(
  basePath: string,
  taskId: string,
  paths: string[],
  timestamp: string
): Promise<void> {
  const indexPath = join(basePath, '.webforge', 'deliverables', 'index.json');
  const deliverables = existsSync(indexPath)
    ? await readJson<Array<Record<string, unknown>>>(indexPath)
    : [];

  for (const filePath of paths) {
    const id = `D${String(deliverables.length + 1).padStart(3, '0')}`;
    deliverables.push({
      id,
      taskId,
      title: filePath.split('/').pop() ?? filePath,
      type: 'file',
      status: 'completed',
      path: filePath,
      createdAt: timestamp,
      createdBy: 'agent'
    });
  }

  await writeJson(indexPath, deliverables);
}

/**
 * 基于 git diff 自动检测改动并回写到 .webforge/
 */
async function recordAuto(
  options: { summary?: string; json?: boolean },
  basePath: string = process.cwd()
): Promise<void> {
  const runtimePath = join(basePath, '.webforge', 'runtime.json');
  if (!existsSync(runtimePath)) {
    if (options.json) {
      console.log(JSON.stringify({ recorded: false, reason: 'no_workspace' }));
    }
    return;
  }

  const now = new Date().toISOString();
  const sessionId = await getOrCreateSessionId(basePath);
  const changedFiles = getGitChangedFiles(basePath);

  if (changedFiles.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ recorded: false, reason: 'no_changes' }));
    } else {
      logger.info('没有检测到文件变更，跳过回写');
    }
    return;
  }

  // 分类改动文件
  const srcFiles = changedFiles.filter((f) => f.startsWith('src/') || f.startsWith('ui/'));
  const testFiles = changedFiles.filter((f) => f.includes('test') || f.includes('spec'));
  const docFiles = changedFiles.filter((f) => f.endsWith('.md') || f.startsWith('docs/'));
  const configFiles = changedFiles.filter((f) =>
    f.includes('config') || f.includes('package.json') || f.includes('tsconfig')
  );

  const autoSummary = options.summary ?? buildAutoSummary(srcFiles, testFiles, docFiles, configFiles);

  // 更新 runtime
  const runtime = await readJson<WorkspaceRuntime>(runtimePath);
  runtime.updatedAt = now;
  runtime.status = 'active';
  runtime.sessionId = sessionId;
  runtime.summary = autoSummary;
  await writeJson(runtimePath, runtime);

  // 记录 session
  await persistSessionRecord(basePath, sessionId, runtime.taskId, runtime.phaseId, now);

  // 写 log
  const logManager = new LogManager('runtime', basePath, sessionId);
  await logManager.addEntry('info', 'auto_record', {
    taskId: runtime.taskId ?? undefined,
    metadata: {
      summary: autoSummary,
      changedFileCount: changedFiles.length,
      srcFiles: srcFiles.length,
      testFiles: testFiles.length,
      docFiles: docFiles.length,
      recordedBy: 'webforge record auto'
    }
  });

  // 记录交付物
  if (srcFiles.length > 0 && runtime.taskId) {
    await recordDeliverables(basePath, runtime.taskId, srcFiles.slice(0, 20), now);
  }

  if (options.json) {
    console.log(JSON.stringify({
      recorded: true,
      sessionId,
      changedFiles: changedFiles.length,
      summary: autoSummary
    }));
  } else {
    logger.success(`自动回写完成`);
    logger.info(`会话: ${sessionId}`);
    logger.info(`变更文件: ${changedFiles.length} (src=${srcFiles.length} test=${testFiles.length} doc=${docFiles.length})`);
    logger.info(`摘要: ${autoSummary}`);
  }
}

/**
 * 保存当前工作快照 — 会话结束时由 Stop hook 调用
 */
async function recordSnapshot(
  options: { reason?: string; json?: boolean },
  basePath: string = process.cwd()
): Promise<void> {
  const runtimePath = join(basePath, '.webforge', 'runtime.json');
  if (!existsSync(runtimePath)) {
    if (options.json) {
      console.log(JSON.stringify({ snapshot: false, reason: 'no_workspace' }));
    }
    return;
  }

  const now = new Date().toISOString();
  const reason = options.reason ?? 'session_end';
  const sessionId = await getOrCreateSessionId(basePath);
  const changedFiles = getGitChangedFiles(basePath);

  // 读取当前 tasks 状态
  const tasksPath = join(basePath, '.webforge', 'tasks.json');
  let taskSummary = '';
  if (existsSync(tasksPath)) {
    const tasksData = await readJson<{ tasks: Array<Record<string, unknown>> }>(tasksPath);
    const completed = tasksData.tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasksData.tasks.filter((t) => t.status === 'in_progress').length;
    const ready = tasksData.tasks.filter((t) => t.status === 'ready').length;
    const total = tasksData.tasks.length;
    taskSummary = `${completed}/${total} 已完成, ${inProgress} 进行中, ${ready} 就绪`;
  }

  // 更新 runtime 为 idle
  const runtime = await readJson<WorkspaceRuntime>(runtimePath);
  const previousSummary = runtime.summary;
  runtime.updatedAt = now;
  runtime.status = 'idle';
  runtime.summary = `会话暂停: ${reason}. 上次工作: ${previousSummary}`;
  await writeJson(runtimePath, runtime);

  // 更新 session 为 paused
  const sessionsPath = join(basePath, '.webforge', 'sessions', 'index.json');
  if (existsSync(sessionsPath)) {
    const sessions = await readJson<Array<Record<string, unknown>>>(sessionsPath);
    const currentSession = sessions.find((s) => s.id === sessionId);
    if (currentSession) {
      currentSession.status = 'paused';
      currentSession.lastActive = now;
      await writeJson(sessionsPath, sessions);
    }
  }

  // 写 log
  const logManager = new LogManager('runtime', basePath, sessionId);
  await logManager.addEntry('info', `snapshot_${reason}`, {
    taskId: runtime.taskId ?? undefined,
    metadata: {
      reason,
      previousSummary,
      taskSummary,
      changedFileCount: changedFiles.length,
      changedFiles: changedFiles.slice(0, 30),
      recordedBy: 'webforge record snapshot'
    }
  });

  if (options.json) {
    console.log(JSON.stringify({
      snapshot: true,
      sessionId,
      reason,
      taskSummary,
      changedFiles: changedFiles.length,
      previousSummary
    }));
  } else {
    logger.success(`快照已保存: ${reason}`);
    logger.info(`会话: ${sessionId} → paused`);
    logger.info(`任务: ${taskSummary}`);
    logger.info(`变更文件: ${changedFiles.length}`);
    logger.info(`上次工作: ${previousSummary}`);
  }
}

function getGitChangedFiles(basePath: string): string[] {
  try {
    const output = execSync('git diff --name-only HEAD 2>/dev/null || git diff --name-only 2>/dev/null || echo ""', {
      cwd: basePath,
      encoding: 'utf-8',
      timeout: 5000
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('.webforge/'));
  } catch {
    return [];
  }
}

function buildAutoSummary(
  srcFiles: string[],
  testFiles: string[],
  docFiles: string[],
  configFiles: string[]
): string {
  const parts: string[] = [];
  if (srcFiles.length > 0) {
    parts.push(`${srcFiles.length} 个源文件变更`);
  }
  if (testFiles.length > 0) {
    parts.push(`${testFiles.length} 个测试文件`);
  }
  if (docFiles.length > 0) {
    parts.push(`${docFiles.length} 个文档`);
  }
  if (configFiles.length > 0) {
    parts.push(`${configFiles.length} 个配置`);
  }
  return parts.length > 0 ? parts.join(', ') : '工作进行中';
}

