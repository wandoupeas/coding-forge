/**
 * 配置管理模块
 */

import {
  AgentProfileConfig,
  WebForgeConfig,
  WorkerConfig,
  Phase
} from '../types/index.js';
import { readText, writeText } from './file.js';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { join } from 'path';

const CONFIG_FILE = '.webforge/config.yaml';
const WORKER_FILE = '.webforge/workers/{role}/worker.yaml';

/**
 * 加载项目配置
 */
export async function loadConfig(basePath?: string): Promise<WebForgeConfig> {
  const path = join(basePath || process.cwd(), CONFIG_FILE);
  const content = await readText(path);
  return parseYaml(content) as WebForgeConfig;
}

/**
 * 保存项目配置
 */
export async function saveConfig(
  config: WebForgeConfig, 
  basePath?: string
): Promise<void> {
  const path = join(basePath || process.cwd(), CONFIG_FILE);
  const content = stringifyYaml(config);
  await writeText(path, content);
}

/**
 * 加载 Worker 配置
 */
export async function loadWorkerConfig(
  role: string, 
  basePath?: string
): Promise<WorkerConfig> {
  const path = join(
    basePath || process.cwd(), 
    WORKER_FILE.replace('{role}', role)
  );
  const content = await readText(path);
  return parseYaml(content) as WorkerConfig;
}

/**
 * 保存 Worker 配置
 */
export async function saveWorkerConfig(
  role: string,
  config: WorkerConfig,
  basePath?: string
): Promise<void> {
  const path = join(
    basePath || process.cwd(),
    WORKER_FILE.replace('{role}', role)
  );
  const content = stringifyYaml(config);
  await writeText(path, content);
}

export function createDefaultAgentProfileConfig(): AgentProfileConfig {
  return {
    provider: 'stub',
    fallback_provider: 'stub',
    permission_profile: 'workspace-write'
  };
}

/**
 * 创建默认配置
 */
export function createDefaultConfig(projectName: string): WebForgeConfig {
  return {
    project: {
      name: projectName,
      version: '0.1.0',
      description: `${projectName} 项目`
    },
    orchestrator: {
      max_parallel_workers: 5,
      checkpoint_interval: 300
    },
    agent: createDefaultAgentProfileConfig(),
    workers: ['pm', 'frontend', 'backend', 'qa', 'devops'],
    phases: [
      {
        id: 'P1',
        name: '架构设计',
        status: 'pending',
        progress: 0,
        depends_on: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'P2',
        name: '核心实现',
        status: 'pending',
        progress: 0,
        depends_on: ['P1'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'P3',
        name: 'CLI 实现',
        status: 'pending',
        progress: 0,
        depends_on: ['P2'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'P4',
        name: '测试集成',
        status: 'pending',
        progress: 0,
        depends_on: ['P3'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  };
}

/**
 * 创建默认 Worker 配置
 */
export function createDefaultWorkerConfig(role: string): WorkerConfig {
  const configs: Record<string, WorkerConfig> = {
    pm: {
      role: 'pm',
      name: 'Project Manager',
      description: '负责需求分析、任务规划',
      skills: ['requirement-analysis', 'task-planning'],
      tools: ['read', 'write'],
      system_prompt: '你是项目经理，擅长需求分析和任务规划。'
    },
    frontend: {
      role: 'frontend',
      name: 'Frontend Developer',
      description: '负责前端开发',
      skills: ['react', 'typescript', 'tailwind'],
      tools: ['read', 'write', 'edit', 'bash'],
      system_prompt: '你是前端开发专家，擅长 React + TypeScript。'
    },
    backend: {
      role: 'backend',
      name: 'Backend Developer',
      description: '负责后端开发',
      skills: ['nodejs', 'database', 'api-design'],
      tools: ['read', 'write', 'edit', 'bash'],
      system_prompt: '你是后端开发专家，擅长 API 设计。'
    },
    qa: {
      role: 'qa',
      name: 'QA Engineer',
      description: '负责测试',
      skills: ['testing', 'test-design'],
      tools: ['read', 'write', 'bash'],
      system_prompt: '你是 QA 工程师，擅长测试设计。'
    },
    devops: {
      role: 'devops',
      name: 'DevOps Engineer',
      description: '负责部署',
      skills: ['docker', 'ci-cd', 'deployment'],
      tools: ['read', 'write', 'bash'],
      system_prompt: '你是 DevOps 工程师，擅长部署。'
    }
  };

  return configs[role] || configs.pm;
}
