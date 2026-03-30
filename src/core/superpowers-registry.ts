import { existsSync } from 'fs';
import { join } from 'path';
import { readJson } from '../utils/file.js';
import type {
  WorkspaceSuperpowersCapability,
  WorkspaceSuperpowersExecutionMode,
  WorkspaceSuperpowersRegistry
} from '../types/index.js';

interface LegacySuperpowersConfig {
  required?: unknown;
  optional?: unknown;
  execution?: unknown;
  generatedAt?: unknown;
  capabilities?: unknown;
  techStack?: unknown;
}

const CAPABILITY_DEFINITIONS: Array<Omit<WorkspaceSuperpowersCapability, 'recommended'>> = [
  {
    id: 'brainstorming',
    kind: 'workflow',
    owner: 'superpowers',
    purpose: '在需求、方案和架构仍然发散时先完成设计收敛。',
    writes: ['.webforge/knowledge/', '.webforge/sessions/'],
    artifacts: ['decision notes', 'design clarifications']
  },
  {
    id: 'writing-plans',
    kind: 'workflow',
    owner: 'superpowers',
    purpose: '把已经稳定的 spec 拆成可执行的任务与实现步骤。',
    writes: ['.webforge/tasks.json', '.webforge/phases.json', 'docs/superpowers/plans/'],
    artifacts: ['implementation plan', 'task graph updates']
  },
  {
    id: 'subagent-driven-development',
    kind: 'workflow',
    owner: 'superpowers',
    purpose: '在当前会话中按任务波次调度隔离子 agent 实施计划。',
    writes: ['.webforge/sessions/', '.webforge/mailboxes/'],
    artifacts: ['wave metadata', 'review markers']
  },
  {
    id: 'executing-plans',
    kind: 'workflow',
    owner: 'superpowers',
    purpose: '在当前会话中按计划批量推进实现并做检查点控制。',
    writes: ['.webforge/sessions/', '.webforge/runtime.json'],
    artifacts: ['execution checkpoints', 'plan progress']
  },
  {
    id: 'using-git-worktrees',
    kind: 'workflow',
    owner: 'superpowers',
    purpose: '为隔离实现和并行开发创建独立 worktree 工作区。',
    writes: ['.webforge/sessions/', '.webforge/runtime.json'],
    artifacts: ['worktree metadata', 'branch isolation']
  },
  {
    id: 'strategic-compact',
    kind: 'workflow',
    owner: 'superpowers',
    purpose: '在合适边界主动 compact，避免上下文在错误时机被截断。',
    writes: ['.webforge/sessions/'],
    artifacts: ['compact handoff', 'next action snapshot']
  },
  {
    id: 'continuous-learning-v2',
    kind: 'workflow',
    owner: 'superpowers',
    purpose: '持续沉淀个人偏好和可复用 instincts。',
    writes: [],
    artifacts: ['personal instincts', 'learned behaviors']
  },
  {
    id: 'gsd-thread',
    kind: 'workflow',
    owner: 'superpowers',
    purpose: '维护跨 session 的持久线程上下文。',
    writes: ['.webforge/sessions/'],
    artifacts: ['thread references', 'cross-session context']
  },
  {
    id: 'gsd-resume-work',
    kind: 'workflow',
    owner: 'superpowers',
    purpose: '在恢复阶段重建前一会话的工作上下文。',
    writes: ['.webforge/sessions/', '.webforge/runtime.json'],
    artifacts: ['resume guidance', 'thread linkage']
  }
];

export function buildSuperpowersRegistry(options: {
  required?: string[];
  optional?: string[];
  execution?: WorkspaceSuperpowersExecutionMode | null;
  generatedAt?: string;
  techStack?: Record<string, unknown>;
} = {}): WorkspaceSuperpowersRegistry {
  const execution = options.execution ?? null;

  return {
    version: '1',
    required: normalizeStringList(options.required),
    optional: normalizeStringList(options.optional),
    execution,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    capabilities: CAPABILITY_DEFINITIONS.map((capability) => ({
      ...capability,
      recommended: isRecommendedCapability(capability.id, execution)
    })),
    ...(options.techStack ? { techStack: options.techStack } : {})
  };
}

export async function loadSuperpowersRegistry(
  basePath: string
): Promise<WorkspaceSuperpowersRegistry> {
  const registryPath = join(basePath, '.webforge', 'superpowers.json');

  if (!existsSync(registryPath)) {
    return buildSuperpowersRegistry();
  }

  return normalizeSuperpowersRegistry(
    await readJson<LegacySuperpowersConfig>(registryPath)
  );
}

export function normalizeSuperpowersRegistry(
  raw: LegacySuperpowersConfig
): WorkspaceSuperpowersRegistry {
  const execution = normalizeExecutionMode(raw.execution);
  const registry = buildSuperpowersRegistry({
    required: normalizeStringList(raw.required),
    optional: normalizeStringList(raw.optional),
    execution,
    generatedAt:
      typeof raw.generatedAt === 'string' && raw.generatedAt.length > 0
        ? raw.generatedAt
        : undefined,
    techStack: isRecord(raw.techStack) ? raw.techStack : undefined
  });

  if (!Array.isArray(raw.capabilities)) {
    return registry;
  }

  const capabilities = raw.capabilities
    .map((item) => normalizeCapability(item, execution))
    .filter((item): item is WorkspaceSuperpowersCapability => item !== null);

  if (capabilities.length === 0) {
    return registry;
  }

  const missing = registry.capabilities.filter(
    (capability) => !capabilities.some((item) => item.id === capability.id)
  );

  return {
    ...registry,
    capabilities: [...capabilities, ...missing]
  };
}

function normalizeCapability(
  value: unknown,
  execution: WorkspaceSuperpowersExecutionMode | null
): WorkspaceSuperpowersCapability | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }

  const base =
    CAPABILITY_DEFINITIONS.find((capability) => capability.id === value.id) ?? {
      id: value.id,
      kind: 'workflow' as const,
      owner: 'superpowers' as const,
      purpose: '',
      writes: [],
      artifacts: []
    };

  return {
    id: base.id,
    kind: 'workflow',
    owner: 'superpowers',
    purpose:
      typeof value.purpose === 'string' && value.purpose.length > 0
        ? value.purpose
        : base.purpose,
    writes: normalizeStringList(value.writes ?? base.writes),
    artifacts: normalizeStringList(value.artifacts ?? base.artifacts),
    recommended:
      typeof value.recommended === 'boolean'
        ? value.recommended
        : isRecommendedCapability(base.id, execution)
  };
}

function isRecommendedCapability(
  capabilityId: string,
  execution: WorkspaceSuperpowersExecutionMode | null
): boolean {
  if (execution === null) {
    return false;
  }

  if (capabilityId === 'writing-plans') {
    return true;
  }

  if (execution === 'subagent') {
    return (
      capabilityId === 'subagent-driven-development' ||
      capabilityId === 'using-git-worktrees'
    );
  }

  if (execution === 'inline') {
    return capabilityId === 'executing-plans';
  }

  return false;
}

function normalizeExecutionMode(
  value: unknown
): WorkspaceSuperpowersExecutionMode | null {
  return value === 'subagent' || value === 'inline' ? value : null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
