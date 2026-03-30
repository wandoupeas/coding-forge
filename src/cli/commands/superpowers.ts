/**
 * superpowers 命令 - 记录外部 workflow 的回写结果
 */

import { basename } from 'path';
import { Command } from 'commander';
import {
  recordSuperpowersRun,
  type RecordSuperpowersRunInput
} from '../../core/superpowers-runs.js';
import type {
  WorkspaceSuperpowersArtifact,
  WorkspaceSuperpowersArtifactKind,
  WorkspaceSuperpowersRun
} from '../../types/index.js';
import logger from '../utils/logger.js';

export interface RecordSuperpowersRunOptions {
  summary: string;
  task?: string;
  session?: string;
  artifact: string[];
  owner?: string;
  wave?: string;
  thread?: string;
  branch?: string;
  worktree?: string;
  compactFrom?: string;
  json?: boolean;
}

export function createSuperpowersCommand(basePath: string = process.cwd()): Command {
  const command = new Command('superpowers').description('记录 superpowers workflow 的回写结果');

  command
    .command('record')
    .description('记录一次 workflow 执行结果，并把产物索引回写到 .webforge/')
    .argument('<workflow>', 'workflow 名称，例如 writing-plans / brainstorming')
    .requiredOption('--summary <text>', '本次 workflow 的结果摘要')
    .option(
      '-a, --artifact <value>',
      '记录产物，支持 path 或 kind:path，可重复传入',
      collectOption,
      [] as string[]
    )
    .option('--task <task-id>', '关联的 task id')
    .option('--session <session-id>', '关联的 session id')
    .option('--owner <worker-id>', '本次 workflow 的 owner / worker')
    .option('--wave <wave-id>', 'subagent wave id')
    .option('--thread <thread-id>', 'thread id')
    .option('--branch <branch>', '关联 branch')
    .option('--worktree <path>', '关联 worktree path')
    .option('--compact-from <session-id>', 'compact 来源 session')
    .option('--json', '输出结构化结果')
    .action(async (workflow: string, options: RecordSuperpowersRunOptions) => {
      try {
        await recordSuperpowersRunCommand(workflow, options, basePath);
      } catch (error) {
        logger.error(`记录 superpowers workflow 失败: ${error}`);
        process.exit(1);
      }
    });

  return command;
}

export async function recordSuperpowersRunCommand(
  workflow: string,
  options: RecordSuperpowersRunOptions,
  basePath: string = process.cwd()
): Promise<WorkspaceSuperpowersRun> {
  if (!Array.isArray(options.artifact) || options.artifact.length === 0) {
    throw new Error('至少提供一个 --artifact，确保 workflow 结果可恢复');
  }

  const input: RecordSuperpowersRunInput = {
    workflow,
    summary: options.summary,
    taskId: options.task,
    sessionId: options.session,
    artifacts: options.artifact.map((item) => parseArtifactOption(item, workflow)),
    metadata: buildMetadata(options)
  };

  const recorded = await recordSuperpowersRun(basePath, input);

  if (options.json) {
    console.log(JSON.stringify(recorded, null, 2));
    return recorded;
  }

  logger.h1('🦾 Superpowers Workflow 已记录');
  logger.info(`workflow: ${recorded.workflow}`);
  logger.info(`run: ${recorded.id}`);
  logger.info(`summary: ${recorded.summary}`);
  if (recorded.taskId) {
    logger.info(`task: ${recorded.taskId}`);
  }
  if (recorded.sessionId) {
    logger.info(`session: ${recorded.sessionId}`);
  }

  console.log();
  logger.h2('产物');
  logger.list(recorded.artifacts.map((artifact) => `${artifact.kind}: ${artifact.path}`));

  return recorded;
}

function buildMetadata(
  options: RecordSuperpowersRunOptions
): RecordSuperpowersRunInput['metadata'] {
  const metadata = {
    owner: options.owner,
    waveId: options.wave,
    threadId: options.thread,
    branch: options.branch,
    worktreePath: options.worktree,
    compactFromSession: options.compactFrom
  };

  return Object.values(metadata).some((value) => value !== undefined) ? metadata : undefined;
}

function parseArtifactOption(
  value: string,
  workflow: string
): WorkspaceSuperpowersArtifact {
  const separatorIndex = value.indexOf(':');
  if (separatorIndex > 0 && !value.startsWith('./') && !value.startsWith('../') && !value.startsWith('/')) {
    const kind = normalizeArtifactKind(value.slice(0, separatorIndex));
    const path = value.slice(separatorIndex + 1);
    return {
      kind,
      path,
      label: basename(path)
    };
  }

  return {
    kind: inferArtifactKind(workflow, value),
    path: value,
    label: basename(value)
  };
}

function inferArtifactKind(
  workflow: string,
  path: string
): WorkspaceSuperpowersArtifactKind {
  const normalized = `${workflow} ${path}`.toLowerCase();
  if (normalized.includes('compact')) {
    return 'compact-handoff';
  }
  if (normalized.includes('thread')) {
    return 'thread';
  }
  if (normalized.includes('decision')) {
    return 'decision';
  }
  if (normalized.includes('knowledge') || normalized.includes('requirements')) {
    return 'knowledge';
  }
  if (normalized.includes('worktree') || normalized.includes('branch')) {
    return 'worktree-metadata';
  }
  if (normalized.includes('plan')) {
    return 'plan';
  }
  return 'note';
}

function normalizeArtifactKind(raw: string): WorkspaceSuperpowersArtifactKind {
  switch (raw) {
    case 'knowledge':
    case 'decision':
    case 'plan':
    case 'compact-handoff':
    case 'thread':
    case 'worktree-metadata':
      return raw;
    case 'note':
    default:
      return 'note';
  }
}

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}
