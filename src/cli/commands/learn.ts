/**
 * learn 命令 - 智能错误记录与学习
 *
 * 用于记录、查询和复习在会话过程中纠正的错误，
 * 帮助 agent 建立记忆，避免重复犯错。
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';
import {
  getLearningManager,
  quickRecordError,
  ErrorCategory,
  ErrorSeverity,
  ErrorRecord,
  Lesson
} from '../../core/learning.js';
import { readJson } from '../../utils/file.js';

interface RecordOptions {
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  file?: string;
  task?: string;
  description?: string;
  fix?: string;
  cause?: string;
  prevention?: string;
}

interface ListOptions {
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  limit?: string;
  since?: string;
}

export function createLearnCommand(): Command {
  const command = new Command('learn')
    .description('智能错误记录与学习：记录错误、避免重复犯错');

  // 记录错误
  command
    .command('record <title>')
    .description('记录一个已纠正的错误')
    .option('-d, --description <text>', '错误详细描述')
    .option('-c, --category <category>', '错误类别: syntax|logic|api_usage|type_error|runtime|workflow|dependency|config|test|performance|security|other')
    .option('-s, --severity <severity>', '严重级别: low|medium|high|critical', 'medium')
    .option('-f, --file <path>', '相关文件路径')
    .option('-t, --task <taskId>', '关联任务 ID')
    .option('--fix <text>', '修复描述', '已修复')
    .option('--cause <text>', '根本原因分析')
    .option('--prevention <text>', '预防措施')
    .action(async (title: string, options: RecordOptions) => {
      try {
        await recordError(title, options);
      } catch (error) {
        logger.error(`记录错误失败: ${error}`);
        process.exit(1);
      }
    });

  // 列出错误
  command
    .command('list')
    .description('列出记录的错误')
    .option('-c, --category <category>', '按类别过滤')
    .option('-s, --severity <severity>', '按严重级别过滤')
    .option('-l, --limit <number>', '限制数量', '20')
    .option('--since <date>', '起始日期 (YYYY-MM-DD)')
    .action(async (options: ListOptions) => {
      try {
        await listErrors(options);
      } catch (error) {
        logger.error(`列出错误失败: ${error}`);
        process.exit(1);
      }
    });

  // 查看错误详情
  command
    .command('show <error-id>')
    .description('查看错误详情')
    .action(async (errorId: string) => {
      try {
        await showError(errorId);
      } catch (error) {
        logger.error(`查看错误失败: ${error}`);
        process.exit(1);
      }
    });

  // 添加经验教训
  command
    .command('lesson <title>')
    .description('添加一条经验教训')
    .option('-c, --content <text>', '教训内容', '')
    .option('--category <category>', '类别', 'other')
    .option('-p, --priority <priority>', '优先级: low|medium|high', 'medium')
    .option('--errors <ids...>', '关联错误 IDs')
    .option('--tasks <ids...>', '关联任务 IDs')
    .action(async (title: string, options: {
      content?: string;
      category?: ErrorCategory;
      priority?: 'low' | 'medium' | 'high';
      errors?: string[];
      tasks?: string[];
    }) => {
      try {
        await addLesson(title, options);
      } catch (error) {
        logger.error(`添加教训失败: ${error}`);
        process.exit(1);
      }
    });

  // 查看经验教训
  command
    .command('lessons')
    .description('查看所有经验教训')
    .option('--category <category>', '按类别过滤')
    .option('-p, --priority <priority>', '按优先级过滤')
    .action(async (options: { category?: ErrorCategory; priority?: Lesson['priority'] }) => {
      try {
        await listLessons(options);
      } catch (error) {
        logger.error(`查看教训失败: ${error}`);
        process.exit(1);
      }
    });

  // 复习模式
  command
    .command('review')
    .description('复习最近错误和经验教训')
    .option('-l, --limit <number>', '复习数量', '5')
    .action(async (options: { limit?: string }) => {
      try {
        await reviewErrors(parseInt(options.limit || '5'));
      } catch (error) {
        logger.error(`复习失败: ${error}`);
        process.exit(1);
      }
    });

  // 生成报告
  command
    .command('report')
    .description('生成学习统计报告')
    .option('--since <date>', '起始日期 (YYYY-MM-DD)')
    .option('--until <date>', '结束日期 (YYYY-MM-DD)')
    .action(async (options: { since?: string; until?: string }) => {
      try {
        await generateReport(options);
      } catch (error) {
        logger.error(`生成报告失败: ${error}`);
        process.exit(1);
      }
    });

  // 会话启动提醒
  command
    .command('remind')
    .description('获取当前会话的提醒（用于 session 启动）')
    .option('-t, --task <taskId>', '当前任务 ID')
    .option('--json', 'JSON 输出')
    .action(async (options: { task?: string; json?: boolean }) => {
      try {
        await getReminders(options);
      } catch (error) {
        logger.error(`获取提醒失败: ${error}`);
        process.exit(1);
      }
    });

  return command;
}

// ============ 命令实现 ============

async function recordError(title: string, options: RecordOptions): Promise<void> {
  const basePath = process.cwd();

  // 获取当前 session 和 task
  const runtime = await getRuntime(basePath);
  const sessionId = runtime?.sessionId || `session-${Date.now()}`;
  const taskId = options.task || runtime?.taskId;

  const error = await quickRecordError({
    title,
    description: options.description || title,
    category: options.category || 'other',
    severity: options.severity || 'medium',
    filePath: options.file,
    errorMessage: options.description,
    fixDescription: options.fix || '已修复',
    rootCause: options.cause || '待分析',
    prevention: options.prevention || '注意检查',
    sessionId,
    taskId
  }, basePath);

  logger.success(`错误已记录: ${error.id}`);
  logger.info(`  标题: ${title}`);
  logger.info(`  类别: ${error.category}`);
  logger.info(`  严重: ${error.severity}`);
  if (error.taskId) logger.info(`  任务: ${error.taskId}`);
  logger.info(`\n💡 提示: 使用 'webforge learn lesson' 添加相关经验教训`);
}

async function listErrors(options: ListOptions): Promise<void> {
  const manager = getLearningManager();
  await manager.initialize();

  const errors = await manager.getErrors({
    category: options.category,
    severity: options.severity,
    since: options.since ? `${options.since}T00:00:00Z` : undefined
  });

  const limit = parseInt(options.limit || '20');
  const recent = errors
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  if (recent.length === 0) {
    logger.info('暂无记录的错误');
    return;
  }

  console.log('\n📚 错误记录:\n');
  console.log(`${'ID'.padEnd(15)} ${'时间'.padEnd(12)} ${'类别'.padEnd(12)} ${'严重'.padEnd(8)} ${'标题'}`);
  console.log('-'.repeat(100));

  for (const e of recent) {
    const date = new Date(e.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    const severityIcon = getSeverityIcon(e.severity);
    console.log(
      `${e.id.padEnd(15)} ${date.padEnd(12)} ${e.category.padEnd(12)} ${severityIcon.padEnd(8)} ${truncate(e.title, 40)}`
    );
  }

  console.log(`\n共 ${errors.length} 条记录，显示最近 ${recent.length} 条`);
}

async function showError(errorId: string): Promise<void> {
  const manager = getLearningManager();
  await manager.initialize();

  const error = await manager.getError(errorId);
  if (!error) {
    logger.error(`错误 ${errorId} 不存在`);
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📋 错误详情: ${error.id}`);
  console.log('='.repeat(60));
  console.log(`\n📝 ${error.title}`);
  console.log(`   ${error.description}`);
  console.log(`\n📊 元数据:`);
  console.log(`   类别: ${error.category}`);
  console.log(`   严重: ${getSeverityIcon(error.severity)} ${error.severity}`);
  console.log(`   状态: ${error.status}`);
  console.log(`   标签: ${error.tags.join(', ') || '无'}`);
  console.log(`\n🕐 时间:`);
  console.log(`   首次: ${new Date(error.timestamp).toLocaleString('zh-CN')}`);
  console.log(`   最近: ${new Date(error.stats.lastOccurrence).toLocaleString('zh-CN')}`);
  console.log(`   次数: ${error.stats.occurrenceCount}`);
  if (error.taskId) console.log(`   任务: ${error.taskId}`);

  if (error.context.filePath) {
    console.log(`\n📁 位置:`);
    console.log(`   文件: ${error.context.filePath}`);
    if (error.context.lineNumber) console.log(`   行号: ${error.context.lineNumber}`);
  }

  console.log(`\n🔧 修复:`);
  console.log(`   ${error.fix.description}`);
  console.log(`   由: ${error.fix.fixBy} @ ${new Date(error.fix.fixTimestamp).toLocaleString('zh-CN')}`);

  console.log(`\n💡 学习:`);
  console.log(`   根因: ${error.learning.rootCause}`);
  console.log(`   预防: ${error.learning.prevention}`);

  console.log('\n' + '='.repeat(60));
}

async function addLesson(
  title: string,
  options: {
    content?: string;
    category?: ErrorCategory;
    priority?: 'low' | 'medium' | 'high';
    errors?: string[];
    tasks?: string[];
  }
): Promise<void> {
  const manager = getLearningManager();
  await manager.initialize();

  const lesson = await manager.addLesson({
    title,
    content: options.content || title,
    category: options.category || 'other',
    priority: options.priority || 'medium',
    relatedErrorIds: options.errors || [],
    relatedTaskIds: options.tasks || []
  });

  logger.success(`教训已添加: ${lesson.id}`);
  logger.info(`  标题: ${title}`);
  logger.info(`  优先级: ${lesson.priority}`);
  if (lesson.relatedErrorIds.length) {
    logger.info(`  关联错误: ${lesson.relatedErrorIds.join(', ')}`);
  }
}

async function listLessons(options: { category?: ErrorCategory; priority?: Lesson['priority'] }): Promise<void> {
  const manager = getLearningManager();
  await manager.initialize();

  const lessons = await manager.getLessons(options);

  if (lessons.length === 0) {
    logger.info('暂无记录的经验教训');
    return;
  }

  console.log('\n🎓 经验教训:\n');
  console.log(`${'ID'.padEnd(15)} ${'优先级'.padEnd(8)} ${'类别'.padEnd(12)} ${'标题'}`);
  console.log('-'.repeat(80));

  for (const l of lessons) {
    const priorityIcon = l.priority === 'high' ? '🔴' : l.priority === 'medium' ? '🟡' : '🟢';
    console.log(`${l.id.padEnd(15)} ${priorityIcon.padEnd(8)} ${l.category.padEnd(12)} ${truncate(l.title, 35)}`);
  }

  console.log(`\n共 ${lessons.length} 条教训`);
}

async function reviewErrors(limit: number): Promise<void> {
  const manager = getLearningManager();
  await manager.initialize();

  const errors = await manager.getRecentErrors(limit);
  const lessons = await manager.getLessons({ priority: 'high' });

  console.log('\n' + '='.repeat(60));
  console.log('🔍 复习模式');
  console.log('='.repeat(60));

  if (errors.length > 0) {
    console.log('\n📚 最近错误:');
    for (let i = 0; i < errors.length; i++) {
      const e = errors[i];
      console.log(`\n  ${i + 1}. [${e.category}] ${e.title}`);
      console.log(`     根因: ${e.learning.rootCause}`);
      console.log(`     预防: ${e.learning.prevention}`);
    }
  }

  if (lessons.length > 0) {
    console.log('\n🎓 重要教训:');
    for (let i = 0; i < Math.min(lessons.length, 3); i++) {
      const l = lessons[i];
      console.log(`\n  ${i + 1}. [${l.priority}] ${l.title}`);
      console.log(`     ${l.content}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  logger.success('复习完成，记住这些教训，避免重复犯错！');
}

async function generateReport(options: { since?: string; until?: string }): Promise<void> {
  const manager = getLearningManager();
  await manager.initialize();

  const report = await manager.generateReport({
    since: options.since ? `${options.since}T00:00:00Z` : undefined,
    until: options.until ? `${options.until}T23:59:59Z` : undefined
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 学习统计报告');
  console.log('='.repeat(60));
  console.log(`\n总计:`);
  console.log(`  错误记录: ${report.totalErrors}`);
  console.log(`  经验教训: ${report.totalLessons}`);

  console.log(`\n按类别分布:`);
  for (const [category, count] of Object.entries(report.byCategory)) {
    const bar = '█'.repeat(Math.min(count, 20));
    console.log(`  ${category.padEnd(12)} ${String(count).padStart(3)} ${bar}`);
  }

  console.log(`\n按严重级别分布:`);
  for (const [severity, count] of Object.entries(report.bySeverity)) {
    const icon = getSeverityIcon(severity as ErrorSeverity);
    console.log(`  ${icon} ${severity.padEnd(10)} ${count}`);
  }

  console.log(`\n最近7天趋势:`);
  for (const day of report.recentTrend) {
    const bar = '█'.repeat(Math.min(day.count, 10));
    console.log(`  ${day.date} ${String(day.count).padStart(2)} ${bar}`);
  }

  console.log('\n' + '='.repeat(60));
}

async function getReminders(options: { task?: string; json?: boolean }): Promise<void> {
  const basePath = process.cwd();
  const manager = getLearningManager(basePath);
  await manager.initialize();

  // 获取 git 变更的文件
  const changedFiles = await getGitChangedFiles(basePath);

  const reminders = await manager.getReminderForSession({
    taskId: options.task,
    filePaths: changedFiles
  });

  if (options.json) {
    console.log(JSON.stringify({ reminders }, null, 2));
    return;
  }

  if (reminders.length === 0) {
    // 没有特定提醒时，显示最近的教训
    const lessons = await manager.getLessons({ priority: 'high' });
    if (lessons.length === 0) {
      console.log('{}');
      return;
    }

    console.log('\n⚠️  记住这些教训:\n');
    for (const l of lessons.slice(0, 3)) {
      console.log(`  • [${l.category}] ${l.title}`);
      console.log(`    ${l.content}`);
    }
    console.log('');
    return;
  }

  console.log('\n⚠️  基于历史错误的提醒:\n');
  for (const r of reminders) {
    console.log(`  • [${r.category}] ${r.title}`);
    console.log(`    ${r.content}`);
  }
  console.log('');
}

// ============ 辅助函数 ============

async function getRuntime(basePath: string): Promise<{ sessionId?: string; taskId?: string } | null> {
  const runtimePath = join(basePath, '.webforge', 'runtime.json');
  if (!existsSync(runtimePath)) return null;

  try {
    return await readJson(runtimePath);
  } catch {
    return null;
  }
}

function getSeverityIcon(severity: ErrorSeverity): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

async function getGitChangedFiles(basePath: string): Promise<string[]> {
  try {
    const { execSync } = await import('child_process');
    const output = execSync('git diff --name-only HEAD 2>/dev/null || git diff --name-only 2>/dev/null || echo ""', {
      cwd: basePath,
      encoding: 'utf-8',
      timeout: 5000
    });
    return output
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
  } catch {
    return [];
  }
}
