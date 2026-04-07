/**
 * 智能错误记录与学习系统
 *
 * 记录在会话过程中纠正的错误，帮助 agent 避免重复犯错。
 * 支持错误分类、模式识别和预防提醒。
 */

import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { ensureDir } from '../utils/file.js';
import { withFileLock } from '../utils/lock.js';

const LEARNING_DIR = '.webforge/learning';
const ERRORS_FILE = '.webforge/learning/errors.json';
const PATTERNS_FILE = '.webforge/learning/patterns.json';
const LESSONS_FILE = '.webforge/learning/lessons.json';
const INDEX_LOCK = '.webforge/learning/.lock';

/**
 * 错误严重级别
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 错误类型分类
 */
export type ErrorCategory =
  | 'syntax'           // 语法错误
  | 'logic'            // 逻辑错误
  | 'api_usage'        // API 使用错误
  | 'type_error'       // 类型错误
  | 'runtime'          // 运行时错误
  | 'workflow'         // 工作流错误（违反 AGENTS.md 规范）
  | 'dependency'       // 依赖问题
  | 'config'           // 配置错误
  | 'test'             // 测试失败
  | 'performance'      // 性能问题
  | 'security'         // 安全问题
  | 'other';           // 其他

/**
 * 错误记录条目
 */
export interface ErrorRecord {
  id: string;
  timestamp: string;
  sessionId: string;
  taskId?: string;

  // 错误描述
  title: string;
  description: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  tags: string[];

  // 上下文信息
  context: {
    filePath?: string;
    lineNumber?: number;
    codeSnippet?: string;
    errorMessage?: string;
    stackTrace?: string;
  };

  // 修复信息
  fix: {
    description: string;
    codeBefore?: string;
    codeAfter?: string;
    fixBy: 'user' | 'agent' | 'system';
    fixTimestamp: string;
  };

  // 学习元数据
  learning: {
    rootCause: string;           // 根本原因
    prevention: string;          // 预防措施
    relatedDocs?: string[];      // 相关文档/规范
    similarErrors?: string[];    // 相似错误 ID
  };

  // 统计
  stats: {
    occurrenceCount: number;     // 发生次数
    lastOccurrence: string;      // 最后发生时间
    reviewCount: number;         // 被复习次数
  };

  // 状态
  status: 'active' | 'resolved' | 'suppressed';
}

/**
 * 错误模式（用于识别重复错误）
 */
export interface ErrorPattern {
  id: string;
  name: string;
  description: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  matchingRules: {
    keywords: string[];          // 关键词匹配
    filePatterns?: string[];     // 文件模式匹配
    errorPatterns?: string[];    // 错误消息模式（正则）
    codePatterns?: string[];     // 代码模式匹配
  };
  relatedErrorIds: string[];     // 关联的错误记录
  createdAt: string;
  updatedAt: string;
  occurrenceCount: number;
}

/**
 * 经验教训
 */
export interface Lesson {
  id: string;
  title: string;
  content: string;
  category: ErrorCategory;
  relatedErrorIds: string[];
  relatedTaskIds: string[];
  createdAt: string;
  updatedAt: string;
  priority: 'low' | 'medium' | 'high';
  reminderTrigger?: {            // 触发提醒的条件
    filePatterns?: string[];     // 文件匹配
    keywords?: string[];         // 关键词匹配
    commands?: string[];         // 命令匹配
  };
}

/**
 * 学习索引
 */
interface LearningIndex {
  version: string;
  lastUpdated: string;
  errorCount: number;
  patternCount: number;
  lessonCount: number;
  topCategories: Array<{ category: ErrorCategory; count: number }>;
  recentErrors: string[];        // 最近错误 ID
}

/**
 * 错误过滤器
 */
export interface ErrorFilter {
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  status?: ErrorRecord['status'];
  taskId?: string;
  sessionId?: string;
  tags?: string[];
  since?: string;
  until?: string;
}

/**
 * 学习管理器
 */
export class LearningManager {
  private basePath: string;
  private initialized: boolean = false;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  /**
   * 初始化学习系统目录结构
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await ensureDir(join(this.basePath, LEARNING_DIR));

    // 初始化 errors.json
    const errorsPath = join(this.basePath, ERRORS_FILE);
    if (!existsSync(errorsPath)) {
      await writeFile(errorsPath, JSON.stringify({ errors: [] }, null, 2));
    }

    // 初始化 patterns.json
    const patternsPath = join(this.basePath, PATTERNS_FILE);
    if (!existsSync(patternsPath)) {
      await writeFile(patternsPath, JSON.stringify({ patterns: [] }, null, 2));
    }

    // 初始化 lessons.json
    const lessonsPath = join(this.basePath, LESSONS_FILE);
    if (!existsSync(lessonsPath)) {
      await writeFile(lessonsPath, JSON.stringify({ lessons: [] }, null, 2));
    }

    this.initialized = true;
  }

  /**
   * 记录一个新错误
   */
  async recordError(
    error: Omit<ErrorRecord, 'id' | 'timestamp' | 'stats' | 'status'>
  ): Promise<ErrorRecord> {
    await this.initialize();

    const now = new Date().toISOString();
    const record: ErrorRecord = {
      ...error,
      id: this.generateId('E'),
      timestamp: now,
      stats: {
        occurrenceCount: 1,
        lastOccurrence: now,
        reviewCount: 0
      },
      status: 'active'
    };

    let result: ErrorRecord = record;

    await withFileLock(join(this.basePath, INDEX_LOCK), async () => {
      const errors = await this.loadErrorsUnsafe();

      // 检查是否已存在相似错误
      const similar = this.findSimilarError(errors, record);
      if (similar) {
        // 更新现有错误
        similar.stats.occurrenceCount++;
        similar.stats.lastOccurrence = now;
        similar.fix = record.fix;
        similar.status = 'active';
        await this.saveErrorsUnsafe(errors);
        result = similar;
        return;
      }

      errors.push(record);
      await this.saveErrorsUnsafe(errors);
      await this.updateIndex();
    });

    return result;
  }

  /**
   * 获取所有错误记录
   */
  async getErrors(filter?: ErrorFilter): Promise<ErrorRecord[]> {
    await this.initialize();

    const errors = await this.loadErrors();
    return this.filterErrors(errors, filter);
  }

  /**
   * 获取单个错误详情
   */
  async getError(errorId: string): Promise<ErrorRecord | null> {
    await this.initialize();

    const errors = await this.loadErrors();
    return errors.find(e => e.id === errorId) || null;
  }

  /**
   * 更新错误记录
   */
  async updateError(
    errorId: string,
    updates: Partial<Omit<ErrorRecord, 'id'>>
  ): Promise<ErrorRecord | null> {
    await this.initialize();

    return withFileLock(join(this.basePath, INDEX_LOCK), async () => {
      const errors = await this.loadErrorsUnsafe();
      const index = errors.findIndex(e => e.id === errorId);

      if (index === -1) return null;

      errors[index] = { ...errors[index], ...updates };
      await this.saveErrorsUnsafe(errors);
      return errors[index];
    });
  }

  /**
   * 添加经验教训
   */
  async addLesson(
    lesson: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Lesson> {
    await this.initialize();

    const now = new Date().toISOString();
    const record: Lesson = {
      ...lesson,
      id: this.generateId('L'),
      createdAt: now,
      updatedAt: now
    };

    await withFileLock(join(this.basePath, INDEX_LOCK), async () => {
      const lessons = await this.loadLessonsUnsafe();
      lessons.push(record);
      await this.saveLessonsUnsafe(lessons);
      await this.updateIndex();
    });

    return record;
  }

  /**
   * 获取所有经验教训
   */
  async getLessons(filter?: { category?: ErrorCategory; priority?: Lesson['priority'] }): Promise<Lesson[]> {
    await this.initialize();

    let lessons = await this.loadLessons();

    if (filter?.category) {
      lessons = lessons.filter(l => l.category === filter.category);
    }
    if (filter?.priority) {
      lessons = lessons.filter(l => l.priority === filter.priority);
    }

    return lessons;
  }

  /**
   * 获取当前会话应该记住的教训（启动时提醒）
   */
  async getReminderForSession(
    sessionContext: {
      taskId?: string;
      filePaths?: string[];
      command?: string;
    }
  ): Promise<Lesson[]> {
    await this.initialize();

    const lessons = await this.loadLessons();
    const recentErrors = await this.getRecentErrors(5);

    // 筛选相关的教训
    return lessons.filter(lesson => {
      // 基于相关任务
      if (sessionContext.taskId && lesson.relatedTaskIds.includes(sessionContext.taskId)) {
        return true;
      }

      // 基于最近错误
      if (lesson.relatedErrorIds.some(id => recentErrors.some(e => e.id === id))) {
        return true;
      }

      // 基于文件模式
      if (lesson.reminderTrigger?.filePatterns && sessionContext.filePaths) {
        return lesson.reminderTrigger.filePatterns.some(pattern =>
          sessionContext.filePaths!.some(path => this.matchPattern(path, pattern))
        );
      }

      // 基于命令
      if (lesson.reminderTrigger?.commands && sessionContext.command) {
        return lesson.reminderTrigger.commands.some(cmd =>
          sessionContext.command!.includes(cmd)
        );
      }

      return false;
    });
  }

  /**
   * 标记错误为已复习
   */
  async markErrorReviewed(errorId: string): Promise<void> {
    const error = await this.getError(errorId);
    if (error) {
      await this.updateError(errorId, {
        stats: {
          ...error.stats,
          reviewCount: error.stats.reviewCount + 1
        }
      });
    }
  }

  /**
   * 获取最近的错误
   */
  async getRecentErrors(limit: number = 10): Promise<ErrorRecord[]> {
    const errors = await this.loadErrors();
    return errors
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * 获取最常见的错误类别
   */
  async getTopCategories(limit: number = 5): Promise<Array<{ category: ErrorCategory; count: number }>> {
    const errors = await this.loadErrors();
    const counts = new Map<ErrorCategory, number>();

    for (const error of errors) {
      counts.set(error.category, (counts.get(error.category) || 0) + error.stats.occurrenceCount);
    }

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * 生成统计报告
   */
  async generateReport(options?: { since?: string; until?: string }): Promise<{
    totalErrors: number;
    totalLessons: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recentTrend: Array<{ date: string; count: number }>;
    topLessons: Lesson[];
  }> {
    const errors = await this.loadErrors();
    const lessons = await this.loadLessons();

    // 按时间过滤
    let filtered = errors;
    if (options?.since) {
      filtered = filtered.filter(e => e.timestamp >= options.since!);
    }
    if (options?.until) {
      filtered = filtered.filter(e => e.timestamp <= options.until!);
    }

    // 按类别统计
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const error of filtered) {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }

    // 生成趋势数据（最近7天）
    const recentTrend: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = filtered.filter(e => e.timestamp.startsWith(dateStr)).length;
      recentTrend.push({ date: dateStr, count });
    }

    return {
      totalErrors: filtered.length,
      totalLessons: lessons.length,
      byCategory: byCategory as Record<ErrorCategory, number>,
      bySeverity: bySeverity as Record<ErrorSeverity, number>,
      recentTrend,
      topLessons: lessons
        .sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0))
        .slice(0, 5)
    };
  }

  // ============ 私有方法 ============

  private generateId(prefix: string): string {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
  }

  private async loadErrors(): Promise<ErrorRecord[]> {
    const content = await readFile(join(this.basePath, ERRORS_FILE), 'utf-8');
    const data = JSON.parse(content);
    return data.errors || [];
  }

  private async loadErrorsUnsafe(): Promise<ErrorRecord[]> {
    return this.loadErrors();
  }

  private async saveErrorsUnsafe(errors: ErrorRecord[]): Promise<void> {
    await writeFile(join(this.basePath, ERRORS_FILE), JSON.stringify({ errors }, null, 2));
  }

  private async loadLessons(): Promise<Lesson[]> {
    const content = await readFile(join(this.basePath, LESSONS_FILE), 'utf-8');
    const data = JSON.parse(content);
    return data.lessons || [];
  }

  private async loadLessonsUnsafe(): Promise<Lesson[]> {
    return this.loadLessons();
  }

  private async saveLessonsUnsafe(lessons: Lesson[]): Promise<void> {
    await writeFile(join(this.basePath, LESSONS_FILE), JSON.stringify({ lessons }, null, 2));
  }

  private async updateIndex(): Promise<void> {
    const errors = await this.loadErrors();
    const lessons = await this.loadLessons();

    const index: LearningIndex = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      errorCount: errors.length,
      patternCount: 0, // TODO: 实现模式检测
      lessonCount: lessons.length,
      topCategories: await this.getTopCategories(),
      recentErrors: errors
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10)
        .map(e => e.id)
    };

    await writeFile(
      join(this.basePath, LEARNING_DIR, 'index.json'),
      JSON.stringify(index, null, 2)
    );
  }

  private findSimilarError(errors: ErrorRecord[], newError: ErrorRecord): ErrorRecord | null {
    // 基于标题、类别和文件路径匹配
    return errors.find(e =>
      e.category === newError.category &&
      e.context.filePath === newError.context.filePath &&
      this.similarity(e.title, newError.title) > 0.8
    ) || null;
  }

  private similarity(str1: string, str2: string): number {
    // 简单的相似度计算
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    // 计算共同词
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    const intersection = [...words1].filter(w => words2.has(w));
    return intersection.length / Math.max(words1.size, words2.size);
  }

  private filterErrors(errors: ErrorRecord[], filter?: ErrorFilter): ErrorRecord[] {
    if (!filter) return errors;

    return errors.filter(e => {
      if (filter.category && e.category !== filter.category) return false;
      if (filter.severity && e.severity !== filter.severity) return false;
      if (filter.status && e.status !== filter.status) return false;
      if (filter.taskId && e.taskId !== filter.taskId) return false;
      if (filter.sessionId && e.sessionId !== filter.sessionId) return false;
      if (filter.tags && !filter.tags.every(t => e.tags.includes(t))) return false;
      if (filter.since && e.timestamp < filter.since) return false;
      if (filter.until && e.timestamp > filter.until) return false;
      return true;
    });
  }

  private matchPattern(str: string, pattern: string): boolean {
    // 简单的通配符匹配
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return regex.test(str);
  }
}

/**
 * 获取学习管理器实例
 */
export function getLearningManager(basePath?: string): LearningManager {
  return new LearningManager(basePath);
}

/**
 * 快速记录错误（便捷函数）
 */
export async function quickRecordError(
  params: {
    title: string;
    description: string;
    category: ErrorCategory;
    severity?: ErrorSeverity;
    filePath?: string;
    errorMessage?: string;
    fixDescription: string;
    rootCause: string;
    prevention: string;
    sessionId: string;
    taskId?: string;
  },
  basePath?: string
): Promise<ErrorRecord> {
  const manager = getLearningManager(basePath);

  return manager.recordError({
    sessionId: params.sessionId,
    taskId: params.taskId,
    title: params.title,
    description: params.description,
    severity: params.severity || 'medium',
    category: params.category,
    tags: [params.category],
    context: {
      filePath: params.filePath,
      errorMessage: params.errorMessage
    },
    fix: {
      description: params.fixDescription,
      fixBy: 'user',
      fixTimestamp: new Date().toISOString()
    },
    learning: {
      rootCause: params.rootCause,
      prevention: params.prevention
    }
  });
}
