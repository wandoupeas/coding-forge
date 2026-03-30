import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  LogManager,
  getExecutionLogs,
  getLatestRuntimeObservation,
  getLog
} from '../../core/logger.js';

describe('execution logger', () => {
  let sandboxDir = '';

  beforeEach(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-logger-'));
  });

  afterEach(async () => {
    if (sandboxDir) {
      await rm(sandboxDir, { recursive: true, force: true });
      sandboxDir = '';
    }
  });

  it('persists log entries and stats to disk', async () => {
    const manager = new LogManager('unit-test', sandboxDir);

    await manager.addEntry('info', 'started', { taskId: 'T001' });
    manager.taskCompleted();
    manager.taskFailed();
    manager.deliverableCreated();
    await manager.end();

    const sessionId = manager.getSessionId();
    const log = await getLog(sessionId, sandboxDir);

    expect(log).toMatchObject({
      sessionId,
      command: 'unit-test',
      endTime: expect.any(String),
      stats: {
        tasksCompleted: 1,
        tasksFailed: 1,
        deliverablesCreated: 1
      }
    });
    expect(log?.entries[0]).toMatchObject({
      level: 'info',
      message: 'started',
      taskId: 'T001'
    });
  });

  it('lists logs newest first and ignores broken files', async () => {
    const older = new LogManager('older', sandboxDir);
    await older.addEntry('info', 'older');
    await older.end();

    const newer = new LogManager('newer', sandboxDir);
    await newer.addEntry('success', 'newer');
    await newer.end();

    await writeFile(
      join(sandboxDir, '.webforge', 'logs', 'broken.json'),
      '{not-valid-json',
      'utf-8'
    );

    const logs = await getExecutionLogs(sandboxDir);

    expect(logs).toHaveLength(2);
    expect(logs[0]?.command).toBe('newer');
    expect(logs[1]?.command).toBe('older');
  });

  it('returns null for missing or unreadable logs', async () => {
    expect(await getLog('missing-session', sandboxDir)).toBeNull();

    const logPath = join(sandboxDir, '.webforge', 'logs', 'broken-session.json');
    await mkdir(join(sandboxDir, '.webforge', 'logs'), { recursive: true });
    await writeFile(logPath, '{broken', 'utf-8');

    expect(await getLog('broken-session', sandboxDir)).toBeNull();
  });

  it('summarizes the latest runtime observation from execution logs', async () => {
    const manager = new LogManager('runtime', sandboxDir, 'runtime-session');
    await manager.addEntry('info', 'before_execute', {
      taskId: 'T001',
      workerId: 'backend',
      metadata: {
        permissionProfile: 'workspace-write',
        stage: 'before_execute',
        observation: {
          counts: {
            readyTasks: 2,
            blockedTasks: 1,
            pendingReview: 3,
            unreadMessages: 4
          }
        }
      }
    });
    await manager.addEntry('success', 'after_execute', {
      taskId: 'T001',
      workerId: 'backend',
      metadata: {
        permissionProfile: 'workspace-write',
        stage: 'after_execute',
        result: 'completed',
        observation: {
          counts: {
            readyTasks: 1,
            blockedTasks: 1,
            pendingReview: 3,
            unreadMessages: 4
          }
        }
      }
    });
    await manager.addEntry('info', 'runtime_completed', {
      metadata: {
        completed: 1,
        failed: 0,
        blocked: 0,
        deliverables: 2
      }
    });
    await manager.end();

    const summary = await getLatestRuntimeObservation(sandboxDir);

    expect(summary).toMatchObject({
      sessionId: 'runtime-session',
      completed: 1,
      failed: 0,
      blocked: 0,
      deliverables: 2,
      lastEvent: 'runtime_completed',
      permissionProfile: 'workspace-write',
      signals: {
        readyTasks: 1,
        blockedTasks: 1,
        pendingReview: 3,
        unreadMessages: 4
      }
    });
    expect(summary?.recentEvents.map((event) => event.message)).toEqual([
      'before_execute',
      'after_execute',
      'runtime_completed'
    ]);
  });
});
