/**
 * 执行日志系统
 * 记录所有执行操作的日志
 */

import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { ensureDir } from '../utils/file.js';

const LOGS_DIR = '.webforge/logs';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  taskId?: string;
  workerId?: string;
  metadata?: Record<string, any>;
}

export interface ExecutionLog {
  sessionId: string;
  startTime: string;
  endTime?: string;
  command: string;
  entries: LogEntry[];
  stats: {
    tasksCompleted: number;
    tasksFailed: number;
    deliverablesCreated: number;
  };
}

export interface RuntimeObservationEventSummary {
  timestamp: string;
  message: string;
  taskId: string | null;
  workerId: string | null;
  permissionProfile: string | null;
  stage: string | null;
  result: string | null;
  reason: string | null;
}

export interface RuntimeObservationSummary {
  sessionId: string;
  startTime: string;
  endTime?: string;
  completed: number;
  failed: number;
  blocked: number;
  deliverables: number;
  lastEvent: string | null;
  lastTaskId: string | null;
  permissionProfile: string | null;
  signals: {
    readyTasks: number;
    blockedTasks: number;
    pendingReview: number;
    unreadMessages: number;
  } | null;
  events: RuntimeObservationEventSummary[];
  recentEvents: RuntimeObservationEventSummary[];
}

/**
 * 日志管理器
 */
export class LogManager {
  private sessionId: string;
  private log: ExecutionLog;
  private logPath: string;
  private basePath: string;

  constructor(
    command: string,
    basePath: string = process.cwd(),
    sessionId?: string
  ) {
    this.basePath = basePath;
    this.sessionId = sessionId ?? `session-${Date.now()}`;
    this.log = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      command,
      entries: [],
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        deliverablesCreated: 0
      }
    };
    this.logPath = join(this.basePath, LOGS_DIR, `${this.sessionId}.json`);
  }

  /**
   * 记录日志
   */
  async addEntry(
    level: LogEntry['level'],
    message: string,
    options?: {
      taskId?: string;
      workerId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...options
    };

    this.log.entries.push(entry);

    // 实时写入文件
    await this.save();
  }

  /**
   * 记录任务完成
   */
  taskCompleted(): void {
    this.log.stats.tasksCompleted++;
  }

  /**
   * 记录任务失败
   */
  taskFailed(): void {
    this.log.stats.tasksFailed++;
  }

  /**
   * 记录交付物创建
   */
  deliverableCreated(): void {
    this.log.stats.deliverablesCreated++;
  }

  /**
   * 结束会话
   */
  async end(): Promise<void> {
    this.log.endTime = new Date().toISOString();
    await this.save();
  }

  /**
   * 保存日志
   */
  private async save(): Promise<void> {
    await ensureDir(join(this.basePath, LOGS_DIR));
    await writeFile(this.logPath, JSON.stringify(this.log, null, 2));
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

/**
 * 读取历史日志
 */
export async function getExecutionLogs(
  basePath: string = process.cwd()
): Promise<ExecutionLog[]> {
  const logsDir = join(basePath, LOGS_DIR);

  if (!existsSync(logsDir)) {
    return [];
  }

  const { readdir } = await import('fs/promises');
  const files = await readdir(logsDir);
  const logs: ExecutionLog[] = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = await readFile(join(logsDir, file), 'utf-8');
        logs.push(JSON.parse(content));
      } catch {
        // 忽略损坏的日志文件
      }
    }
  }

  // 按时间倒序
  return logs.sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
}

/**
 * 获取指定会话的日志
 */
export async function getLog(
  sessionId: string,
  basePath: string = process.cwd()
): Promise<ExecutionLog | null> {
  const logPath = join(basePath, LOGS_DIR, `${sessionId}.json`);
  
  if (!existsSync(logPath)) {
    return null;
  }

  try {
    const content = await readFile(logPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function getLatestRuntimeObservation(
  basePath: string = process.cwd()
): Promise<RuntimeObservationSummary | null> {
  const logs = await getExecutionLogs(basePath);
  const runtimeLog = logs.find((log) => log.command === 'runtime');

  if (!runtimeLog) {
    return null;
  }

  return summarizeRuntimeObservation(runtimeLog);
}

export async function getRuntimeObservation(
  sessionId: string,
  basePath: string = process.cwd()
): Promise<RuntimeObservationSummary | null> {
  const runtimeLog = await getLog(sessionId, basePath);

  if (!runtimeLog || runtimeLog.command !== 'runtime') {
    return null;
  }

  return summarizeRuntimeObservation(runtimeLog);
}

function summarizeRuntimeObservation(
  runtimeLog: ExecutionLog
): RuntimeObservationSummary {

  const relevantEntries = runtimeLog.entries.filter((entry) =>
    ['before_execute', 'after_execute', 'permission_blocked', 'runtime_completed'].includes(
      entry.message
    )
  );
  const events = relevantEntries.map((entry) => toRuntimeObservationEvent(entry));
  const recentEvents = relevantEntries.slice(-3).map((entry) => toRuntimeObservationEvent(entry));
  const lastEvent = recentEvents[recentEvents.length - 1] ?? null;
  const completionEntry =
    [...relevantEntries].reverse().find((entry) => entry.message === 'runtime_completed') ?? null;
  const latestTaskEntry =
    [...relevantEntries].reverse().find((entry) => entry.taskId !== undefined) ?? null;
  const completionMetadata = asRecord(completionEntry?.metadata);
  const observationMetadata = asRecord(latestTaskEntry?.metadata);
  const observation = asRecord(observationMetadata?.observation);

  return {
    sessionId: runtimeLog.sessionId,
    startTime: runtimeLog.startTime,
    endTime: runtimeLog.endTime,
    completed: getNumber(completionMetadata?.completed) ?? runtimeLog.stats.tasksCompleted,
    failed: getNumber(completionMetadata?.failed) ?? runtimeLog.stats.tasksFailed,
    blocked: getNumber(completionMetadata?.blocked) ?? 0,
    deliverables:
      getNumber(completionMetadata?.deliverables) ?? runtimeLog.stats.deliverablesCreated,
    lastEvent: lastEvent?.message ?? null,
    lastTaskId: lastEvent?.taskId ?? latestTaskEntry?.taskId ?? null,
    permissionProfile:
      lastEvent?.permissionProfile ?? getString(observationMetadata?.permissionProfile),
    signals: observation
      ? {
          readyTasks: getNumber(observation.readyTaskIds?.length) ?? getNumber(observation.counts?.readyTasks) ?? 0,
          blockedTasks: getNumber(observation.blockedTaskIds?.length) ?? getNumber(observation.counts?.blockedTasks) ?? 0,
          pendingReview:
            getNumber(observation.pendingReviewIds?.length) ??
            getNumber(observation.counts?.pendingReview) ??
            0,
          unreadMessages: getNumber(observation.counts?.unreadMessages) ?? 0
        }
      : null,
    events,
    recentEvents
  };
}

function toRuntimeObservationEvent(entry: LogEntry): RuntimeObservationEventSummary {
  const metadata = asRecord(entry.metadata);

  return {
    timestamp: entry.timestamp,
    message: entry.message,
    taskId: entry.taskId ?? null,
    workerId: entry.workerId ?? null,
    permissionProfile: getString(metadata?.permissionProfile),
    stage: getString(metadata?.stage),
    result: getString(metadata?.result),
    reason: getString(metadata?.reason)
  };
}

function asRecord(value: unknown): Record<string, any> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
