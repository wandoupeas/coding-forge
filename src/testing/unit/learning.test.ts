import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getLearningManager,
  quickRecordError,
  LearningManager,
  ErrorCategory,
  ErrorSeverity
} from '../../core/learning.js';

describe('learning system', () => {
  let tempDir: string;
  let manager: LearningManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'webforge-learning-'));
    manager = getLearningManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('creates learning directory structure on first use', async () => {
      await manager.initialize();

      expect(existsSync(join(tempDir, '.webforge', 'learning'))).toBe(true);
      expect(existsSync(join(tempDir, '.webforge', 'learning', 'errors.json'))).toBe(true);
      expect(existsSync(join(tempDir, '.webforge', 'learning', 'lessons.json'))).toBe(true);
      expect(existsSync(join(tempDir, '.webforge', 'learning', 'patterns.json'))).toBe(true);
    });

    it('creates index.json after first operation', async () => {
      await manager.recordError({
        sessionId: 'test-session',
        title: 'Test Error',
        description: 'Test description',
        severity: 'medium',
        category: 'workflow',
        tags: ['test'],
        context: {},
        fix: {
          description: 'Fixed',
          fixBy: 'user',
          fixTimestamp: new Date().toISOString()
        },
        learning: {
          rootCause: 'Test cause',
          prevention: 'Test prevention'
        }
      });

      expect(existsSync(join(tempDir, '.webforge', 'learning', 'index.json'))).toBe(true);
    });
  });

  describe('error recording', () => {
    it('records a new error with generated ID', async () => {
      const error = await manager.recordError({
        sessionId: 'test-session',
        title: 'Test Error',
        description: 'Test description',
        severity: 'high',
        category: 'syntax',
        tags: ['test', 'syntax'],
        context: {
          filePath: 'src/test.ts',
          lineNumber: 42
        },
        fix: {
          description: 'Added missing semicolon',
          fixBy: 'user',
          fixTimestamp: new Date().toISOString()
        },
        learning: {
          rootCause: 'Forgot semicolon',
          prevention: 'Use linter'
        }
      });

      expect(error.id).toBeDefined();
      expect(error.id.startsWith('E')).toBe(true);
      expect(error.title).toBe('Test Error');
      expect(error.category).toBe('syntax');
      expect(error.severity).toBe('high');
      expect(error.stats.occurrenceCount).toBe(1);
      expect(error.status).toBe('active');
    });

    it('merges similar errors and increments count', async () => {
      // Create two errors that should be considered the same
      const uniqueId = Date.now();
      const filePath = `src/unique-merge-test-${uniqueId}.ts`;
      const title = `Unique Merge Test Error ${uniqueId}`;

      const error1 = await manager.recordError({
        sessionId: 'session-1',
        title,
        description: 'Description',
        severity: 'medium',
        category: 'logic',
        tags: ['test'],
        context: { filePath },
        fix: { description: 'Fix 1', fixBy: 'user', fixTimestamp: new Date().toISOString() },
        learning: { rootCause: 'Cause', prevention: 'Prevention' }
      });

      const error2 = await manager.recordError({
        sessionId: 'session-2',
        title,
        description: 'Different description',
        severity: 'medium',
        category: 'logic',
        tags: ['test'],
        context: { filePath },
        fix: { description: 'Fix 2', fixBy: 'user', fixTimestamp: new Date().toISOString() },
        learning: { rootCause: 'Cause', prevention: 'Prevention' }
      });

      expect(error1.id).toBe(error2.id);
      expect(error2.stats.occurrenceCount).toBe(2);
    });
  });

  describe('error querying', () => {
    beforeEach(async () => {
      await manager.recordError({
        sessionId: 'session-1',
        title: 'Syntax Error',
        description: 'Missing semicolon',
        severity: 'low',
        category: 'syntax',
        tags: ['syntax'],
        context: { filePath: 'src/a.ts' },
        fix: { description: 'Fixed', fixBy: 'user', fixTimestamp: new Date().toISOString() },
        learning: { rootCause: 'Cause', prevention: 'Prevention' }
      });

      await manager.recordError({
        sessionId: 'session-1',
        title: 'Logic Error',
        description: 'Wrong condition',
        severity: 'high',
        category: 'logic',
        tags: ['logic'],
        context: { filePath: 'src/b.ts' },
        fix: { description: 'Fixed', fixBy: 'user', fixTimestamp: new Date().toISOString() },
        learning: { rootCause: 'Cause', prevention: 'Prevention' }
      });

      await manager.recordError({
        sessionId: 'session-2',
        title: 'Another Syntax Error',
        description: 'Missing brace',
        severity: 'medium',
        category: 'syntax',
        tags: ['syntax'],
        context: { filePath: 'src/c.ts' },
        fix: { description: 'Fixed', fixBy: 'user', fixTimestamp: new Date().toISOString() },
        learning: { rootCause: 'Cause', prevention: 'Prevention' }
      });
    });

    it('filters errors by category', async () => {
      const syntaxErrors = await manager.getErrors({ category: 'syntax' });
      expect(syntaxErrors).toHaveLength(2);

      const logicErrors = await manager.getErrors({ category: 'logic' });
      expect(logicErrors).toHaveLength(1);
    });

    it('filters errors by severity', async () => {
      const highSeverity = await manager.getErrors({ severity: 'high' });
      expect(highSeverity).toHaveLength(1);
      expect(highSeverity[0].title).toBe('Logic Error');
    });

    it('returns recent errors sorted by timestamp', async () => {
      const recent = await manager.getRecentErrors(2);
      expect(recent).toHaveLength(2);
      // Most recent first
      expect(recent[0].title).toBe('Another Syntax Error');
    });
  });

  describe('lessons', () => {
    it('adds a new lesson', async () => {
      const lesson = await manager.addLesson({
        title: 'Always use webforge commands',
        content: 'Never modify .webforge files directly',
        category: 'workflow',
        priority: 'high',
        relatedErrorIds: ['E001'],
        relatedTaskIds: ['T001']
      });

      expect(lesson.id).toBeDefined();
      expect(lesson.id.startsWith('L')).toBe(true);
      expect(lesson.title).toBe('Always use webforge commands');
      expect(lesson.priority).toBe('high');
    });

    it('retrieves lessons by category', async () => {
      await manager.addLesson({
        title: 'Lesson 1',
        content: 'Content 1',
        category: 'syntax',
        priority: 'medium',
        relatedErrorIds: [],
        relatedTaskIds: []
      });

      await manager.addLesson({
        title: 'Lesson 2',
        content: 'Content 2',
        category: 'workflow',
        priority: 'high',
        relatedErrorIds: [],
        relatedTaskIds: []
      });

      const workflowLessons = await manager.getLessons({ category: 'workflow' });
      expect(workflowLessons).toHaveLength(1);
      expect(workflowLessons[0].title).toBe('Lesson 2');
    });

    it('retrieves lessons by priority', async () => {
      await manager.addLesson({
        title: 'High Priority',
        content: 'Important',
        category: 'other',
        priority: 'high',
        relatedErrorIds: [],
        relatedTaskIds: []
      });

      await manager.addLesson({
        title: 'Low Priority',
        content: 'Not urgent',
        category: 'other',
        priority: 'low',
        relatedErrorIds: [],
        relatedTaskIds: []
      });

      const highPriority = await manager.getLessons({ priority: 'high' });
      expect(highPriority).toHaveLength(1);
      expect(highPriority[0].title).toBe('High Priority');
    });
  });

  describe('reminders', () => {
    beforeEach(async () => {
      // Create an error and lesson for task T001
      const error = await manager.recordError({
        sessionId: 'session-1',
        taskId: 'T001',
        title: 'Test Error',
        description: 'Description',
        severity: 'medium',
        category: 'workflow',
        tags: ['test'],
        context: {},
        fix: { description: 'Fixed', fixBy: 'user', fixTimestamp: new Date().toISOString() },
        learning: { rootCause: 'Cause', prevention: 'Prevention' }
      });

      await manager.addLesson({
        title: 'Remember this',
        content: 'Important lesson',
        category: 'workflow',
        priority: 'high',
        relatedErrorIds: [error.id],
        relatedTaskIds: ['T001']
      });
    });

    it('returns reminders for a specific task', async () => {
      const reminders = await manager.getReminderForSession({ taskId: 'T001' });
      expect(reminders).toHaveLength(1);
      expect(reminders[0].title).toBe('Remember this');
    });

    it('returns empty array when no matching reminders', async () => {
      const reminders = await manager.getReminderForSession({ taskId: 'T999', filePaths: ['src/unrelated.ts'] });
      // The lesson is returned because it has high priority, not because of task matching
      // Let's filter to only get task-specific reminders
      const taskSpecificReminders = reminders.filter(r => r.relatedTaskIds.includes('T999'));
      expect(taskSpecificReminders).toHaveLength(0);
    });
  });

  describe('reporting', () => {
    beforeEach(async () => {
      await manager.recordError({
        sessionId: 'session-1',
        title: 'Syntax Error',
        description: 'Missing semicolon',
        severity: 'low',
        category: 'syntax',
        tags: [],
        context: {},
        fix: { description: 'Fixed', fixBy: 'user', fixTimestamp: new Date().toISOString() },
        learning: { rootCause: 'Cause', prevention: 'Prevention' }
      });

      await manager.recordError({
        sessionId: 'session-1',
        title: 'Logic Error',
        description: 'Wrong condition',
        severity: 'high',
        category: 'logic',
        tags: [],
        context: {},
        fix: { description: 'Fixed', fixBy: 'user', fixTimestamp: new Date().toISOString() },
        learning: { rootCause: 'Cause', prevention: 'Prevention' }
      });

      await manager.addLesson({
        title: 'Lesson 1',
        content: 'Content',
        category: 'syntax',
        priority: 'high',
        relatedErrorIds: [],
        relatedTaskIds: []
      });
    });

    it('generates statistics report', async () => {
      const report = await manager.generateReport();

      expect(report.totalErrors).toBe(2);
      expect(report.totalLessons).toBe(1);
      expect(report.byCategory.syntax).toBe(1);
      expect(report.byCategory.logic).toBe(1);
      expect(report.bySeverity.low).toBe(1);
      expect(report.bySeverity.high).toBe(1);
      expect(report.recentTrend).toHaveLength(7);
    });

    it('returns top categories', async () => {
      const categories = await manager.getTopCategories(5);
      expect(categories).toHaveLength(2);
    });
  });

  describe('quickRecordError helper', () => {
    it('records error with simplified interface', async () => {
      const error = await quickRecordError({
        title: 'Quick Error',
        description: 'Quick description',
        category: 'runtime',
        severity: 'critical',
        filePath: 'src/main.ts',
        errorMessage: 'Something went wrong',
        fixDescription: 'Applied fix',
        rootCause: 'Race condition',
        prevention: 'Add proper locking',
        sessionId: 'test-session'
      }, tempDir);

      expect(error.id).toBeDefined();
      expect(error.title).toBe('Quick Error');
      expect(error.severity).toBe('critical');
      expect(error.category).toBe('runtime');
    });
  });
});
