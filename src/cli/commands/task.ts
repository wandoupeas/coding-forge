/**
 * task 命令 - 任务管理
 *
 * 创建、更新、查询任务
 */

import { Command } from 'commander';
import { join } from 'path';
import logger from '../utils/logger.js';
import { readJson, writeJson } from '../../utils/file.js';
import type { Task, TaskStatus, TaskExecutionMode, WorkspaceKnowledgeIndexEntry } from '../../types/index.js';

interface CreateTaskOptions {
  phase?: string;
  title?: string;
  description?: string;
  priority?: string;
  dependsOn?: string[];
  assignee?: string;
  executionMode?: TaskExecutionMode;
  knowledge?: string[];
  autoKnowledge?: boolean; // 是否自动推断知识文档（默认 true）
}

interface UpdateTaskOptions {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: string;
  addKnowledge?: string[];
  removeKnowledge?: string[];
  autoKnowledge?: boolean; // 自动补全知识文档（默认 true）
}

export function createTaskCommand(): Command {
  const command = new Command('task')
    .description('任务管理：创建、更新、查询任务')
    .addCommand(createCreateCommand())
    .addCommand(createUpdateCommand())
    .addCommand(createListCommand())
    .addCommand(createShowCommand());

  return command;
}

function createCreateCommand(): Command {
  return new Command('create')
    .description('创建新任务')
    .argument('<task-id>', '任务 ID（如 T010）')
    .requiredOption('-t, --title <title>', '任务标题')
    .option('-p, --phase <phase>', '所属阶段（如 P1, P2）', 'P1')
    .option('-d, --description <text>', '任务描述')
    .option('--priority <n>', '优先级 1-5', '2')
    .option('--depends-on <ids...>', '依赖的任务 ID')
    .option('--assignee <role>', '负责人角色', 'agent')
    .option('--execution-mode <mode>', '执行模式: auto|manual', 'auto')
    .option('-k, --knowledge <paths...>', '关联的知识文档路径（支持简写如 ADR-005, frontend-guidelines）')
    .option('--no-auto-knowledge', '禁用自动推断知识文档')
    .action(async (taskId: string, options: CreateTaskOptions) => {
      try {
        await createTask(taskId, options);
      } catch (error) {
        logger.error(`创建任务失败: ${error}`);
        process.exit(1);
      }
    });
}

function createUpdateCommand(): Command {
  return new Command('update')
    .description('更新任务')
    .argument('<task-id>', '任务 ID（如 T010）')
    .option('-t, --title <title>', '任务标题')
    .option('-d, --description <text>', '任务描述')
    .option('-s, --status <status>', '任务状态: pending/ready/in_progress/blocked/completed/failed')
    .option('--priority <n>', '优先级 1-5')
    .option('--add-knowledge <paths...>', '添加关联的知识文档')
    .option('--remove-knowledge <paths...>', '移除关联的知识文档')
    .option('--no-auto-knowledge', '禁用自动根据任务标题补全知识文档')
    .action(async (taskId: string, options: UpdateTaskOptions) => {
      try {
        await updateTask(taskId, options);
      } catch (error) {
        logger.error(`更新任务失败: ${error}`);
        process.exit(1);
      }
    });
}

function createListCommand(): Command {
  return new Command('list')
    .description('列出任务')
    .option('-p, --phase <phase>', '按阶段过滤')
    .option('-s, --status <status>', '按状态过滤')
    .option('--ready', '只显示 ready 状态的任务')
    .option('--json', 'JSON 输出')
    .action(async (options) => {
      try {
        await listTasks(options);
      } catch (error) {
        logger.error(`列出任务失败: ${error}`);
        process.exit(1);
      }
    });
}

function createShowCommand(): Command {
  return new Command('show')
    .description('显示任务详情')
    .argument('<task-id>', '任务 ID')
    .option('--json', 'JSON 输出')
    .action(async (taskId: string, options) => {
      try {
        await showTask(taskId, options);
      } catch (error) {
        logger.error(`显示任务失败: ${error}`);
        process.exit(1);
      }
    });
}

async function createTask(
  taskId: string,
  options: CreateTaskOptions,
  basePath: string = process.cwd()
): Promise<void> {
  const tasksPath = join(basePath, '.webforge', 'tasks.json');

  // 读取现有任务
  const tasksData = await readJson<{ tasks: Task[] }>(tasksPath);
  if (!tasksData) {
    throw new Error(`无法读取任务文件: ${tasksPath}`);
  }

  // 检查任务 ID 是否已存在
  if (tasksData.tasks.some((t) => t.id === taskId)) {
    throw new Error(`任务 ${taskId} 已存在`);
  }

  // 处理 knowledgeRefs：优先使用用户指定，否则自动推断
  let knowledgeRefs: string[] | undefined;
  if (options.knowledge && options.knowledge.length > 0) {
    knowledgeRefs = await Promise.all(options.knowledge.map((k) => resolveKnowledgePath(k, basePath)));
  } else if (options.autoKnowledge !== false) {
    // 默认自动推断知识文档
    knowledgeRefs = await inferKnowledgeRefs(options.title!, options.phase || 'P1', basePath);
  }

  const now = new Date().toISOString();
  const newTask: Task = {
    id: taskId,
    phase: options.phase || 'P1',
    title: options.title!,
    description: options.description,
    status: 'pending',
    assignee: options.assignee || 'agent',
    depends_on: options.dependsOn || [],
    priority: parseInt(options.priority || '2', 10),
    created_at: now,
    updated_at: now,
    executionMode: options.executionMode || 'auto',
    knowledgeRefs
  };

  tasksData.tasks.push(newTask);
  await writeJson(tasksPath, tasksData);

  logger.success(`创建任务 ${taskId}: ${newTask.title}`);
  if (knowledgeRefs && knowledgeRefs.length > 0) {
    logger.info(`关联知识文档 (${knowledgeRefs.length}个):`);
    for (const ref of knowledgeRefs) {
      logger.info(`  - ${ref}`);
    }
  }
}

async function updateTask(
  taskId: string,
  options: UpdateTaskOptions,
  basePath: string = process.cwd()
): Promise<void> {
  const tasksPath = join(basePath, '.webforge', 'tasks.json');

  // 读取现有任务
  const tasksData = await readJson<{ tasks: Task[] }>(tasksPath);
  if (!tasksData) {
    throw new Error(`无法读取任务文件: ${tasksPath}`);
  }

  const taskIndex = tasksData.tasks.findIndex((t) => t.id === taskId);
  if (taskIndex === -1) {
    throw new Error(`任务 ${taskId} 不存在`);
  }

  const task = tasksData.tasks[taskIndex];
  const now = new Date().toISOString();

  // 更新字段
  if (options.title) task.title = options.title;
  if (options.description) task.description = options.description;
  if (options.status) task.status = options.status;
  if (options.priority) task.priority = parseInt(options.priority, 10);

  // 处理 knowledgeRefs
  let knowledgeChanged = false;
  if (options.addKnowledge && options.addKnowledge.length > 0) {
    const currentRefs = new Set(task.knowledgeRefs || []);
    for (const k of options.addKnowledge) {
      const resolved = await resolveKnowledgePath(k, basePath);
      if (!currentRefs.has(resolved)) {
        currentRefs.add(resolved);
        knowledgeChanged = true;
      }
    }
    task.knowledgeRefs = Array.from(currentRefs);
  }

  if (options.removeKnowledge && options.removeKnowledge.length > 0) {
    const removeRefs = new Set(
      await Promise.all(options.removeKnowledge.map((k) => resolveKnowledgePath(k, basePath)))
    );
    const originalLength = task.knowledgeRefs?.length || 0;
    task.knowledgeRefs = task.knowledgeRefs?.filter((ref) => !removeRefs.has(ref));
    if (task.knowledgeRefs?.length !== originalLength) {
      knowledgeChanged = true;
    }
  }

  // 自动补全知识文档（默认开启）
  if (options.autoKnowledge !== false) {
    const currentRefs = new Set(task.knowledgeRefs || []);
    const inferredRefs = await inferKnowledgeRefs(task.title, task.phase, basePath);
    let added = 0;
    for (const ref of inferredRefs) {
      if (!currentRefs.has(ref)) {
        currentRefs.add(ref);
        added++;
      }
    }
    if (added > 0) {
      task.knowledgeRefs = Array.from(currentRefs);
      knowledgeChanged = true;
      logger.info(`自动补全 ${added} 个知识文档`);
    }
  }

  task.updated_at = now;
  tasksData.tasks[taskIndex] = task;
  await writeJson(tasksPath, tasksData);

  logger.success(`更新任务 ${taskId}`);
  if (knowledgeChanged) {
    logger.info(`知识文档 (${task.knowledgeRefs?.length || 0}个):`);
    for (const ref of task.knowledgeRefs || []) {
      logger.info(`  - ${ref}`);
    }
  }
}

async function listTasks(
  options: { phase?: string; status?: string; ready?: boolean; json?: boolean },
  basePath: string = process.cwd()
): Promise<void> {
  const tasksPath = join(basePath, '.webforge', 'tasks.json');
  const tasksData = await readJson<{ tasks: Task[] }>(tasksPath);
  if (!tasksData) {
    throw new Error(`无法读取任务文件: ${tasksPath}`);
  }

  let tasks = tasksData.tasks;

  // 过滤
  if (options.phase) {
    tasks = tasks.filter((t) => t.phase === options.phase);
  }
  if (options.status) {
    tasks = tasks.filter((t) => t.status === options.status);
  }
  if (options.ready) {
    tasks = tasks.filter((t) => t.status === 'ready');
  }

  // 排序
  tasks = tasks.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id.localeCompare(b.id);
  });

  if (options.json) {
    console.log(JSON.stringify(tasks, null, 2));
    return;
  }

  // 表格输出
  if (tasks.length === 0) {
    logger.warning('没有符合条件的任务');
    return;
  }

  logger.info(`共 ${tasks.length} 个任务:\n`);
  for (const task of tasks) {
    const statusIcon = getStatusIcon(task.status);
    const knowledgeBadge = task.knowledgeRefs ? ` [📚${task.knowledgeRefs.length}]` : '';
    logger.info(`${statusIcon} ${task.id} (${task.phase}) ${task.title}${knowledgeBadge}`);
    logger.info(`   状态: ${task.status} | 优先级: ${task.priority} | 负责人: ${task.assignee}`);
    if (task.depends_on.length > 0) {
      logger.info(`   依赖: ${task.depends_on.join(', ')}`);
    }
    if (task.description) {
      logger.info(`   ${task.description.slice(0, 60)}${task.description.length > 60 ? '...' : ''}`);
    }
    console.log();
  }
}

async function showTask(
  taskId: string,
  options: { json?: boolean },
  basePath: string = process.cwd()
): Promise<void> {
  const tasksPath = join(basePath, '.webforge', 'tasks.json');
  const tasksData = await readJson<{ tasks: Task[] }>(tasksPath);
  if (!tasksData) {
    throw new Error(`无法读取任务文件: ${tasksPath}`);
  }

  const task = tasksData.tasks.find((t) => t.id === taskId);
  if (!task) {
    throw new Error(`任务 ${taskId} 不存在`);
  }

  if (options.json) {
    console.log(JSON.stringify(task, null, 2));
    return;
  }

  logger.h2(`任务 ${task.id}`);
  logger.info(`标题: ${task.title}`);
  logger.info(`阶段: ${task.phase}`);
  logger.info(`状态: ${task.status}`);
  logger.info(`优先级: ${task.priority}`);
  logger.info(`负责人: ${task.assignee}`);
  logger.info(`执行模式: ${task.executionMode || 'auto'}`);

  if (task.description) {
    console.log();
    logger.info('【描述】');
    logger.info(task.description);
  }

  if (task.depends_on.length > 0) {
    console.log();
    logger.info('【依赖】');
    for (const dep of task.depends_on) {
      logger.info(`  - ${dep}`);
    }
  }

  if (task.knowledgeRefs && task.knowledgeRefs.length > 0) {
    console.log();
    logger.info('【关联知识文档】');
    for (const ref of task.knowledgeRefs) {
      logger.info(`  📚 ${ref}`);
    }
  }

  if (task.metadata && Object.keys(task.metadata).length > 0) {
    console.log();
    logger.info('【元数据】');
    for (const [key, value] of Object.entries(task.metadata)) {
      logger.info(`  ${key}: ${value}`);
    }
  }

  console.log();
  logger.info(`创建于: ${task.created_at}`);
  logger.info(`更新于: ${task.updated_at}`);
  if (task.completed_at) {
    logger.info(`完成于: ${task.completed_at}`);
  }
}

/**
 * 解析知识文档路径简写
 * 支持: "ADR-005" -> ".webforge/knowledge/decisions/ADR-005-alova-http.md"
 *       "frontend-guidelines" -> ".webforge/knowledge/design/frontend-guidelines.md"
 */
async function resolveKnowledgePath(
  input: string,
  basePath: string = process.cwd()
): Promise<string> {
  // 如果已经是完整路径，直接返回
  if (input.startsWith('.webforge/') || input.startsWith('/')) {
    return input;
  }

  // 尝试从知识索引查找
  const knowledgeIndexPath = join(basePath, '.webforge', 'knowledge', 'index.json');
  const knowledgeIndex = await readJson<WorkspaceKnowledgeIndexEntry[]>(knowledgeIndexPath);

  if (knowledgeIndex) {
    const inputLower = input.toLowerCase();

    // 1. 完全匹配 title
    const byTitle = knowledgeIndex.find(
      (k) => k.title.toLowerCase() === inputLower
    );
    if (byTitle) return byTitle.path;

    // 2. ADR 编号匹配 (ADR-005 -> ADR-005-alova-http)
    if (input.match(/^ADR-\d+$/i)) {
      const adrMatch = knowledgeIndex.find((k) =>
        k.title.toLowerCase().startsWith(inputLower)
      );
      if (adrMatch) return adrMatch.path;
    }

    // 3. 部分匹配 title
    const partialMatch = knowledgeIndex.find((k) =>
      k.title.toLowerCase().includes(inputLower)
    );
    if (partialMatch) return partialMatch.path;

    // 4. 匹配路径
    const pathMatch = knowledgeIndex.find((k) =>
      k.path.toLowerCase().includes(inputLower)
    );
    if (pathMatch) return pathMatch.path;
  }

  // 回退：返回推测路径
  if (input.match(/^ADR-\d+$/i)) {
    return `.webforge/knowledge/decisions/${input.toUpperCase()}-*.md`;
  }
  return `.webforge/knowledge/design/${input}.md`;
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    ready: '✅',
    in_progress: '🔄',
    blocked: '❌',
    completed: '✓',
    failed: '💥'
  };
  return icons[status] || '❓';
}

/**
 * 根据任务标题和阶段推断知识文档关联
 * 基于项目的 knowledge/index.json 动态查找，不硬编码具体文档
 */
async function inferKnowledgeRefs(
  title: string,
  phase: string,
  basePath: string = process.cwd()
): Promise<string[]> {
  const titleLower = title.toLowerCase();
  const knowledgeTypes = new Set<string>();
  
  // 根据标题关键词匹配知识文档类型
  if (titleLower.includes('前端') || titleLower.includes('frontend') || 
      titleLower.includes('react') || titleLower.includes('vue') ||
      titleLower.includes('vite') || titleLower.includes('ui')) {
    knowledgeTypes.add('frontend');
  }
  if (titleLower.includes('后端') || titleLower.includes('backend') || 
      titleLower.includes('api') || titleLower.includes('接口') ||
      titleLower.includes('server')) {
    knowledgeTypes.add('backend');
  }
  if (titleLower.includes('数据库') || titleLower.includes('database') || 
      titleLower.includes('prisma') || titleLower.includes('schema') ||
      titleLower.includes('sql') || titleLower.includes('rls') ||
      titleLower.includes('租户') || titleLower.includes('tenant')) {
    knowledgeTypes.add('database');
  }
  if (titleLower.includes('测试') || titleLower.includes('test') || 
      titleLower.includes('e2e') || titleLower.includes('unit')) {
    knowledgeTypes.add('testing');
  }
  if (titleLower.includes('架构') || titleLower.includes('architecture') || 
      titleLower.includes('设计') || titleLower.includes('design')) {
    knowledgeTypes.add('architecture');
  }
  if (titleLower.includes('认证') || titleLower.includes('auth') || 
      titleLower.includes('jwt') || titleLower.includes('登录') ||
      titleLower.includes('权限')) {
    knowledgeTypes.add('auth');
  }
  
  // 从知识索引中查找匹配的文档
  const knowledgeIndexPath = join(basePath, '.webforge', 'knowledge', 'index.json');
  const knowledgeIndex = await readJson<WorkspaceKnowledgeIndexEntry[]>(knowledgeIndexPath);
  
  if (!knowledgeIndex || knowledgeIndex.length === 0) {
    return [];
  }
  
  const matchedRefs: string[] = [];
  
  for (const entry of knowledgeIndex) {
    // 匹配 design 目录下的文档
    if (entry.type === 'design') {
      // 从路径中提取文档类型，如 design/frontend-guidelines.md -> frontend
      const pathMatch = entry.path.match(/design\/([a-z]+)-/);
      if (pathMatch) {
        const docType = pathMatch[1]; // frontend, backend, database, testing, architecture
        if (knowledgeTypes.has(docType)) {
          matchedRefs.push(entry.path);
        }
      }
    }
    
    // 匹配 decisions 目录下的文档（架构/认证相关）
    if (entry.type === 'decision') {
      // 决策文档通常与架构、认证、数据库相关
      if (knowledgeTypes.has('backend') || knowledgeTypes.has('architecture') || 
          knowledgeTypes.has('auth') || knowledgeTypes.has('database')) {
        matchedRefs.push(entry.path);
      }
    }
  }
  
  // 去重并返回
  return [...new Set(matchedRefs)];
}
