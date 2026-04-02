/**
 * plan 命令 - 规划适配层
 * 核心规划逻辑在 src/core/planning.ts
 */

import { Command } from 'commander';
import * as readline from 'readline';
import logger from '../utils/logger.js';
import {
  TECH_STACK_OPTIONS,
  buildPlanFromKnowledge,
  getTechStackName,
  type TechStack
} from '../../core/planning.js';
import type { Phase, Task } from '../../types/index.js';

interface PlanOptions {
  template?: string;
  force?: boolean;
  superpowers?: boolean;
  execution?: 'subagent' | 'inline';
  interactive?: string;
  autoKnowledge?: boolean; // 是否自动关联知识文档
}

export function createPlanCommand(): Command {
  return new Command('plan')
    .description('分析需求文档并生成项目规划 (支持 Superpowers 工作流)')
    .option('-t, --template <template>', '使用规划模板: web/backend/mobile', 'auto')
    .option('-f, --force', '强制重新规划（覆盖现有任务）')
    .option('-s, --superpowers', '启用 Superpowers 工作流', true)
    .option('--no-superpowers', '禁用 Superpowers 工作流')
    .option('-e, --execution <mode>', '执行模式: subagent/inline', 'subagent')
    .option('-i, --interactive [boolean]', '交互式选择技术栈', 'true')
    .option('--no-auto-knowledge', '禁用自动关联知识文档（由 Agent 后续指定）')
    .action(async (options: PlanOptions) => {
      try {
        await planCommand(options);
      } catch (error) {
        logger.error(`规划失败: ${error}`);
        process.exit(1);
      }
    });
}

export async function planCommand(
  options: PlanOptions,
  basePath: string = process.cwd()
): Promise<void> {
  logger.h1('📋 智能项目规划');

  const superpowersEnabled = options.superpowers !== false;
  const executionMode = options.execution === 'inline' ? 'inline' : 'subagent';
  const interactive = options.interactive !== 'false';

  if (superpowersEnabled) {
    logger.h2('🦸 Superpowers 工作流已启用');
    logger.info(
      `执行模式: ${executionMode === 'subagent' ? 'Subagent-Driven (推荐)' : 'Inline Execution'}`
    );
    console.log();
  }

  const result = await buildPlanFromKnowledge(basePath, {
    template: options.template,
    force: options.force,
    superpowers: superpowersEnabled,
    execution: executionMode,
    autoKnowledge: options.autoKnowledge,
    resolveTechStack: interactive
      ? async (analysis) => selectTechStack(analysis.techStack)
      : undefined
  });

  if (result.reusedExistingPlan) {
    logger.warning('已存在任务规划，复用当前 workspace 中的任务与阶段');
  } else {
    logger.success('规划已写回 workspace');
  }

  if (result.analysis.documents.length === 0) {
    logger.warning('没有找到需求文档，已使用默认模板规划');
  } else {
    logger.info(`发现 ${result.analysis.documents.length} 个知识文档`);
    logger.info(`项目类型: ${result.template}`);
    if (result.analysis.keywords.length > 0) {
      logger.info(`关键词: ${result.analysis.keywords.join(', ')}`);
    }
    if (result.analysis.techStack.length > 0) {
      logger.info(`检测到的技术栈: ${result.analysis.techStack.join(', ')}`);
    }
  }

  console.log();
  logger.info('当前技术栈:');
  console.log(`  后端: ${getTechStackName('backend', result.techStack.backend)}`);
  console.log(`  前端: ${getTechStackName('frontend', result.techStack.frontend)}`);
  console.log(`  数据库: ${getTechStackName('database', result.techStack.database)}`);
  console.log(
    `  基础设施: ${result.techStack.infrastructure
      .map((item) => getTechStackName('infrastructure', item))
      .join(', ')}`
  );

  console.log();
  showPlanSummary(result.phases, result.tasks, superpowersEnabled);
  showCriticalPath(result.tasks);

  if (superpowersEnabled) {
    showSuperpowersGuidance(
      result.requiredSkills,
      executionMode,
      result.techStack,
      result.planDocumentPath
    );
  }
}

async function selectTechStack(detectedTechStack: string[]): Promise<TechStack> {
  logger.h2('🔧 选择技术栈');
  console.log('检测到的技术栈仅供参考，您可以选择或调整：\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = (question: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer.trim()));
    });

  const stack: TechStack = {
    backend: '',
    frontend: '',
    database: '',
    infrastructure: []
  };

  try {
    console.log('📦 后端技术栈:');
    TECH_STACK_OPTIONS.backend.forEach((option, index) => {
      const marker = detectedTechStack.some((item) =>
        item.toLowerCase().includes(option.value.split('-')[0].replace('nodejs', 'node'))
      )
        ? ' 👈 推荐'
        : '';
      console.log(`  ${index + 1}. ${option.name}${marker}`);
    });
    const backendChoice = parseChoice(
      await askQuestion('\n选择后端技术 (1-4，默认1): '),
      TECH_STACK_OPTIONS.backend.length
    );
    stack.backend = TECH_STACK_OPTIONS.backend[backendChoice].value;
    console.log(`✓ 选择: ${TECH_STACK_OPTIONS.backend[backendChoice].name}\n`);

    console.log('🎨 前端技术栈:');
    TECH_STACK_OPTIONS.frontend.forEach((option, index) => {
      const marker = detectedTechStack.some((item) =>
        item.toLowerCase().includes(option.value.includes('vue') ? 'vue' : option.value)
      )
        ? ' 👈 推荐'
        : '';
      console.log(`  ${index + 1}. ${option.name}${marker}`);
    });
    const frontendChoice = parseChoice(
      await askQuestion('\n选择前端技术 (1-3，默认1): '),
      TECH_STACK_OPTIONS.frontend.length
    );
    stack.frontend = TECH_STACK_OPTIONS.frontend[frontendChoice].value;
    console.log(`✓ 选择: ${TECH_STACK_OPTIONS.frontend[frontendChoice].name}\n`);

    console.log('🗄️  数据库:');
    TECH_STACK_OPTIONS.database.forEach((option, index) => {
      const marker = detectedTechStack.some((item) =>
        item.toLowerCase().includes(option.value.split('-')[0].replace('postgresql', 'postgres'))
      )
        ? ' 👈 推荐'
        : '';
      console.log(`  ${index + 1}. ${option.name}${marker}`);
    });
    const databaseChoice = parseChoice(
      await askQuestion('\n选择数据库 (1-4，默认1): '),
      TECH_STACK_OPTIONS.database.length
    );
    stack.database = TECH_STACK_OPTIONS.database[databaseChoice].value;
    console.log(`✓ 选择: ${TECH_STACK_OPTIONS.database[databaseChoice].name}\n`);

    console.log('☁️  基础设施 (多选，用逗号分隔，默认1):');
    TECH_STACK_OPTIONS.infrastructure.forEach((option, index) => {
      console.log(`  ${index + 1}. ${option.name}`);
    });
    console.log('  0. 跳过');

    const infraAnswer = await askQuestion('\n选择基础设施 (例如: 1,2): ');
    if (infraAnswer === '0' || infraAnswer === '') {
      stack.infrastructure = ['docker'];
    } else {
      const selections = infraAnswer
        .split(',')
        .map((item) => Number.parseInt(item.trim(), 10) - 1)
        .filter(
          (index) =>
            Number.isInteger(index) &&
            index >= 0 &&
            index < TECH_STACK_OPTIONS.infrastructure.length
        );

      stack.infrastructure = selections.map(
        (index) => TECH_STACK_OPTIONS.infrastructure[index].value
      );
      if (stack.infrastructure.length === 0) {
        stack.infrastructure = ['docker'];
      }
    }

    console.log(
      `✓ 选择: ${stack.infrastructure
        .map((item) => getTechStackName('infrastructure', item))
        .join(', ')}\n`
    );
  } finally {
    rl.close();
  }

  return stack;
}

function parseChoice(value: string, size: number): number {
  const index = Number.parseInt(value, 10) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= size) {
    return 0;
  }
  return index;
}

function showPlanSummary(phases: Phase[], tasks: Task[], superpowers?: boolean): void {
  logger.h2('规划摘要');
  logger.info(`阶段数: ${phases.length}`);
  logger.info(`任务数: ${tasks.length}`);

  console.log('\n阶段:');
  for (const phase of phases) {
    const phaseTasks = tasks.filter((task) => task.phase === phase.id);
    console.log(`  ${phase.id} ${phase.name} (${phaseTasks.length} tasks)`);
  }

  console.log('\n就绪任务:');
  const readyTasks = tasks.filter((task) => task.status === 'ready');
  if (readyTasks.length === 0) {
    console.log('  暂无');
  } else {
    for (const task of readyTasks) {
      console.log(`  ${task.id} ${task.title} -> ${task.assignee}`);
    }
  }

  if (superpowers) {
    console.log('\nSuperpowers: 已生成 core-driven 规划结果');
  }
}

function showCriticalPath(tasks: Task[]): void {
  console.log('\n关键路径:');
  const criticalTasks = tasks
    .filter((task) => task.depends_on.length === 0 || task.priority === 1)
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const task of criticalTasks.slice(0, 10)) {
    console.log(
      `  ${task.id} ${task.title} (${task.status})${task.depends_on.length > 0 ? ` <- ${task.depends_on.join(', ')}` : ''}`
    );
  }
}

function showSuperpowersGuidance(
  requiredSkills: string[],
  executionMode: 'subagent' | 'inline',
  techStack: TechStack,
  planDocumentPath?: string
): void {
  console.log('\n🦸 Superpowers 执行指引');
  if (planDocumentPath) {
    console.log(`  计划文档: ${planDocumentPath}`);
  }
  console.log(`  执行模式: ${executionMode === 'subagent' ? 'Subagent-Driven' : 'Inline'}`);
  console.log(
    `  技术栈: ${getTechStackName('backend', techStack.backend)} + ${getTechStackName('frontend', techStack.frontend)} + ${getTechStackName('database', techStack.database)}`
  );

  if (requiredSkills.length > 0) {
    console.log('  Skills:');
    for (const skill of requiredSkills) {
      console.log(`    @${skill}`);
    }
  }
}
