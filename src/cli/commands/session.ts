/**
 * session 命令 - 会话管理
 *
 * 支持跨会话状态恢复
 */

import { Command } from 'commander';
import { join } from 'path';
import { existsSync } from 'fs';
import logger from '../utils/logger.js';
import {
  saveSession,
  loadSession,
  listSessions,
  getLatestSession,
  pauseSession,
  completeSession,
  applySessionWorkflowContext,
  type Session
} from '../../core/session.js';
import { readJson } from '../../utils/file.js';
import type { Task, Phase } from '../../types/index.js';

const TASKS_PATH = '.webforge/tasks.json';
const PHASES_PATH = '.webforge/phases.json';

interface SessionListOptions {
  json?: boolean;
  limit?: string;
}

interface SessionCreateOptions {
  name?: string;
  phase?: string;
  task?: string;
  context?: string;
  json?: boolean;
}

interface SessionResumeOptions {
  json?: boolean;
}

interface SessionPauseOptions {
  json?: boolean;
}

interface SessionCompleteOptions {
  json?: boolean;
}

interface SessionContextOptions {
  threadId?: string;
  waveId?: string;
  owner?: string;
  json?: boolean;
}

export function createSessionCommand(): Command {
  const command = new Command('session')
    .description('会话管理：创建、恢复、管理跨会话状态')
    .addCommand(createListCommand())
    .addCommand(createCreateCommand())
    .addCommand(createResumeCommand())
    .addCommand(createPauseCommand())
    .addCommand(createCompleteCommand())
    .addCommand(createCurrentCommand())
    .addCommand(createContextCommand());

  return command;
}

/**
 * 列出所有会话
 */
function createListCommand(): Command {
  return new Command('list')
    .description('列出所有会话')
    .option('-j, --json', '以 JSON 格式输出')
    .option('-l, --limit <n>', '限制显示数量', '10')
    .action(async (options: SessionListOptions) => {
      try {
        const sessions = await listSessions();
        const limit = parseInt(options.limit ?? '10', 10);
        const limitedSessions = sessions.slice(0, limit);

        if (options.json) {
          console.log(JSON.stringify({
            sessions: limitedSessions,
            total: sessions.length
          }, null, 2));
          return;
        }

        if (sessions.length === 0) {
          logger.info('暂无会话记录');
          return;
        }

        logger.info(`\n📋 会话列表 (共 ${sessions.length} 个，显示前 ${limitedSessions.length} 个)\n`);

        for (const session of limitedSessions) {
          const statusIcon = getStatusIcon(session.status);
          const date = new Date(session.lastActive).toLocaleString('zh-CN');
          const stats = session.stats ?? { tasksCompleted: 0, totalTasks: 0 };
          const progress = `${stats.tasksCompleted}/${stats.totalTasks}`;

          console.log(`${statusIcon} ${session.name} (${session.id})`);
          console.log(`   状态: ${session.status} | 进度: ${progress} 任务`);

          if (session.currentPhaseId || session.currentTaskId) {
            const scope = [
              session.currentPhaseId && `阶段: ${session.currentPhaseId}`,
              session.currentTaskId && `任务: ${session.currentTaskId}`
            ].filter(Boolean).join(' | ');
            console.log(`   当前: ${scope}`);
          }

          if (session.contextSummary) {
            console.log(`   上下文: ${session.contextSummary.slice(0, 50)}${session.contextSummary.length > 50 ? '...' : ''}`);
          }

          if (session.nextAction) {
            console.log(`   下一步: ${session.nextAction.slice(0, 50)}${session.nextAction.length > 50 ? '...' : ''}`);
          }

          console.log(`   更新时间: ${date}`);
          console.log('');
        }
      } catch (error) {
        logger.error(`列会话失败: ${error}`);
        process.exit(1);
      }
    });
}

/**
 * 创建新会话快照
 */
function createCreateCommand(): Command {
  return new Command('create')
    .description('创建新会话快照')
    .argument('<session-id>', '会话 ID')
    .option('-n, --name <name>', '会话名称')
    .option('-p, --phase <phase>', '当前阶段 ID')
    .option('-t, --task <task>', '当前任务 ID')
    .option('-c, --context <text>', '上下文摘要')
    .option('-j, --json', '以 JSON 格式输出')
    .action(async (sessionId: string, options: SessionCreateOptions) => {
      try {
        // 读取当前任务和阶段
        const tasks = await readTasks();
        const phases = await readPhases();

        await saveSession(sessionId, tasks, phases, {
          name: options.name,
          currentPhaseId: options.phase,
          currentTaskId: options.task,
          context: options.context
        });

        if (options.json) {
          const snapshot = await loadSession(sessionId);
          console.log(JSON.stringify({
            success: true,
            session: snapshot?.session,
            tasksSnapshot: snapshot?.tasksSnapshot.length,
            phasesSnapshot: snapshot?.phasesSnapshot.length
          }, null, 2));
          return;
        }

        logger.success(`✓ 会话已创建: ${sessionId}`);
        logger.info(`  任务数: ${tasks.length}`);
        logger.info(`  阶段数: ${phases.length}`);

        if (options.phase) {
          logger.info(`  当前阶段: ${options.phase}`);
        }
        if (options.task) {
          logger.info(`  当前任务: ${options.task}`);
        }
      } catch (error) {
        logger.error(`创建会话失败: ${error}`);
        process.exit(1);
      }
    });
}

/**
 * 恢复会话
 */
function createResumeCommand(): Command {
  return new Command('resume')
    .description('恢复指定会话')
    .argument('[session-id]', '会话 ID（不提供则恢复最新会话）')
    .option('-j, --json', '以 JSON 格式输出')
    .action(async (sessionId: string | undefined, options: SessionResumeOptions) => {
      try {
        let snapshot;

        if (sessionId) {
          snapshot = await loadSession(sessionId);
          if (!snapshot) {
            logger.error(`会话不存在: ${sessionId}`);
            process.exit(1);
          }
        } else {
          const latest = await getLatestSession();
          if (!latest) {
            logger.error('没有可用的会话');
            process.exit(1);
          }
          snapshot = await loadSession(latest.id);
        }

        if (!snapshot) {
          logger.error('无法加载会话');
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify({
            session: snapshot.session,
            tasksSnapshot: snapshot.tasksSnapshot,
            phasesSnapshot: snapshot.phasesSnapshot,
            resumeGuidance: snapshot.resumeGuidance
          }, null, 2));
          return;
        }

        const session = snapshot.session;

        logger.success(`✓ 已恢复会话: ${session.name} (${session.id})`);
        logger.info(`\n📊 会话状态:`);
        logger.info(`  状态: ${session.status}`);
        logger.info(`  进度: ${session.stats.tasksCompleted}/${session.stats.totalTasks} 任务`);

        if (session.currentPhaseId) {
          logger.info(`  当前阶段: ${session.currentPhaseId}`);
        }
        if (session.currentTaskId) {
          logger.info(`  当前任务: ${session.currentTaskId}`);
        }

        if (session.contextSummary) {
          logger.info(`\n📝 上下文摘要:`);
          logger.info(`  ${session.contextSummary}`);
        }

        if (session.nextAction) {
          logger.info(`\n👉 下一步行动:`);
          logger.info(`  ${session.nextAction}`);
        }

        logger.info(`\n💡 恢复指引:`);
        logger.info(`  ${snapshot.resumeGuidance}`);

        // 显示就绪任务
        const readyTasks = snapshot.tasksSnapshot.filter(t => t.status === 'ready');
        if (readyTasks.length > 0) {
          logger.info(`\n✅ 就绪任务 (${readyTasks.length}):`);
          for (const task of readyTasks.slice(0, 5)) {
            logger.info(`  - ${task.id}: ${task.title}`);
          }
          if (readyTasks.length > 5) {
            logger.info(`  ... 还有 ${readyTasks.length - 5} 个`);
          }
        }

        // 显示阻塞任务
        const blockedTasks = snapshot.tasksSnapshot.filter(t => t.status === 'blocked');
        if (blockedTasks.length > 0) {
          logger.info(`\n🚧 阻塞任务 (${blockedTasks.length}):`);
          for (const task of blockedTasks.slice(0, 5)) {
            const deps = task.depends_on?.join(', ') || '无';
            logger.info(`  - ${task.id}: ${task.title} (依赖: ${deps})`);
          }
          if (blockedTasks.length > 5) {
            logger.info(`  ... 还有 ${blockedTasks.length - 5} 个`);
          }
        }
      } catch (error) {
        logger.error(`恢复会话失败: ${error}`);
        process.exit(1);
      }
    });
}

/**
 * 暂停会话
 */
function createPauseCommand(): Command {
  return new Command('pause')
    .description('暂停指定会话')
    .argument('[session-id]', '会话 ID（不提供则暂停最新会话）')
    .option('-j, --json', '以 JSON 格式输出')
    .action(async (sessionId: string | undefined, options: SessionPauseOptions) => {
      try {
        let targetId = sessionId;

        if (!targetId) {
          const latest = await getLatestSession();
          if (!latest) {
            logger.error('没有可用的会话');
            process.exit(1);
          }
          targetId = latest.id;
        }

        await pauseSession(targetId);

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            sessionId: targetId,
            status: 'paused'
          }, null, 2));
          return;
        }

        logger.success(`✓ 会话已暂停: ${targetId}`);
      } catch (error) {
        logger.error(`暂停会话失败: ${error}`);
        process.exit(1);
      }
    });
}

/**
 * 完成会话
 */
function createCompleteCommand(): Command {
  return new Command('complete')
    .description('完成指定会话')
    .argument('[session-id]', '会话 ID（不提供则完成最新会话）')
    .option('-j, --json', '以 JSON 格式输出')
    .action(async (sessionId: string | undefined, options: SessionCompleteOptions) => {
      try {
        let targetId = sessionId;

        if (!targetId) {
          const latest = await getLatestSession();
          if (!latest) {
            logger.error('没有可用的会话');
            process.exit(1);
          }
          targetId = latest.id;
        }

        await completeSession(targetId);

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            sessionId: targetId,
            status: 'completed'
          }, null, 2));
          return;
        }

        logger.success(`✓ 会话已完成: ${targetId}`);
      } catch (error) {
        logger.error(`完成会话失败: ${error}`);
        process.exit(1);
      }
    });
}

/**
 * 显示当前会话
 */
function createCurrentCommand(): Command {
  return new Command('current')
    .description('显示当前最新会话')
    .option('-j, --json', '以 JSON 格式输出')
    .action(async (options: { json?: boolean }) => {
      try {
        const session = await getLatestSession();

        if (!session) {
          if (options.json) {
            console.log(JSON.stringify({ session: null }, null, 2));
            return;
          }
          logger.info('暂无活动会话');
          return;
        }

        if (options.json) {
          console.log(JSON.stringify({ session }, null, 2));
          return;
        }

        const statusIcon = getStatusIcon(session.status);
        const date = new Date(session.lastActive).toLocaleString('zh-CN');

        logger.info(`\n${statusIcon} 当前会话: ${session.name} (${session.id})`);
        logger.info(`   状态: ${session.status}`);
        logger.info(`   进度: ${session.stats.tasksCompleted}/${session.stats.totalTasks} 任务`);

        if (session.currentPhaseId) {
          logger.info(`   当前阶段: ${session.currentPhaseId}`);
        }
        if (session.currentTaskId) {
          logger.info(`   当前任务: ${session.currentTaskId}`);
        }
        if (session.contextSummary) {
          logger.info(`   上下文: ${session.contextSummary}`);
        }
        if (session.nextAction) {
          logger.info(`   下一步: ${session.nextAction}`);
        }

        logger.info(`   更新时间: ${date}`);
      } catch (error) {
        logger.error(`获取当前会话失败: ${error}`);
        process.exit(1);
      }
    });
}

/**
 * 设置会话工作流上下文
 */
function createContextCommand(): Command {
  return new Command('context')
    .description('设置会话工作流上下文')
    .argument('<session-id>', '会话 ID')
    .option('--thread-id <id>', '线程 ID')
    .option('--wave-id <id>', '波浪 ID')
    .option('--owner <owner>', '负责人')
    .option('-j, --json', '以 JSON 格式输出')
    .action(async (sessionId: string, options: SessionContextOptions) => {
      try {
        const workflowContext = {
          workflow: 'session-context',
          threadId: options.threadId,
          waveId: options.waveId,
          owner: options.owner
        };

        await applySessionWorkflowContext(sessionId, workflowContext);

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            sessionId,
            workflowContext
          }, null, 2));
          return;
        }

        logger.success(`✓ 已更新会话上下文: ${sessionId}`);

        if (options.threadId) {
          logger.info(`  线程 ID: ${options.threadId}`);
        }
        if (options.waveId) {
          logger.info(`  波浪 ID: ${options.waveId}`);
        }
        if (options.owner) {
          logger.info(`  负责人: ${options.owner}`);
        }
      } catch (error) {
        logger.error(`设置会话上下文失败: ${error}`);
        process.exit(1);
      }
    });
}

/**
 * 辅助函数：读取任务
 */
async function readTasks(): Promise<Task[]> {
  if (!existsSync(TASKS_PATH)) {
    return [];
  }
  try {
    const data = await readJson(TASKS_PATH) as { tasks?: Task[] };
    return data.tasks || [];
  } catch {
    return [];
  }
}

/**
 * 辅助函数：读取阶段
 */
async function readPhases(): Promise<Phase[]> {
  if (!existsSync(PHASES_PATH)) {
    return [];
  }
  try {
    const data = await readJson(PHASES_PATH) as { phases?: Phase[] };
    return data.phases || [];
  } catch {
    return [];
  }
}

/**
 * 获取状态图标
 */
function getStatusIcon(status: Session['status']): string {
  switch (status) {
    case 'active':
      return '🟢';
    case 'paused':
      return '⏸️';
    case 'completed':
      return '✅';
    default:
      return '⚪';
  }
}
