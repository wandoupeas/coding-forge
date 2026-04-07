/**
 * knowledge 命令 - 知识摄入
 */

import { Command } from 'commander';
import { readdir, copyFile, writeFile, readFile } from 'fs/promises';
import { join, extname, basename, relative, resolve } from 'path';
import { existsSync } from 'fs';
import logger from '../utils/logger.js';
import { ensureDir } from '../../utils/file.js';
import {
  isManagedKnowledgeCategory,
  rebuildKnowledgeIndex,
  type KnowledgeCategory
} from '../../core/knowledge-index.js';

// 动态导入 xlsx（避免启动时加载）
async function loadXlsx() {
  return await import('xlsx');
}

export function createKnowledgeCommand(): Command {
  const command = new Command('knowledge')
    .description('知识文档管理')
    .addCommand(createAddCommand())
    .addCommand(createCreateCommand())
    .addCommand(createListCommand())
    .addCommand(createParseCommand())
    .addCommand(createReindexCommand())
    .addCommand(createSyncStackCommand());

  return command;
}

function createAddCommand(): Command {
  return new Command('add')
    .description('添加知识文档 (docx, pdf, xlsx, txt, md)')
    .argument('<files...>', '文件路径')
    .option('-c, --category <category>', '分类: requirements/design/data', 'raw')
    .action(async (files: string[], options) => {
      try {
        await addKnowledge(files, options);
      } catch (error) {
        logger.error(`添加失败: ${error}`);
        process.exit(1);
      }
    });
}

function createCreateCommand(): Command {
  return new Command('create')
    .description('创建知识文档（规范、ADR等）')
    .argument('<name>', '文档名称（如 backend-guidelines, ADR-001）')
    .requiredOption('-c, --category <category>', '分类: design|decisions|requirements|data')
    .option('-t, --template <template>', '模板类型: guidelines|adr|spec', 'spec')
    .option('--title <title>', '文档标题')
    .action(async (name: string, options) => {
      try {
        await createKnowledgeDoc(name, options);
      } catch (error) {
        logger.error(`创建失败: ${error}`);
        process.exit(1);
      }
    });
}

function createListCommand(): Command {
  return new Command('list')
    .description('列出知识文档')
    .option('-c, --category <category>', '按分类过滤')
    .action(async (options) => {
      try {
        await listKnowledge(options);
      } catch (error) {
        logger.error(`列出失败: ${error}`);
        process.exit(1);
      }
    });
}

function createParseCommand(): Command {
  return new Command('parse')
    .description('解析文档为 Markdown（不指定文件则解析全部）')
    .argument('[file]', '文件路径（可选，不填则解析全部）')
    .option('-c, --category <category>', '指定分类解析全部')
    .option('-o, --output <output>', '输出路径')
    .action(async (file: string | undefined, options) => {
      try {
        if (file) {
          await parseDocument(file, options);
        } else {
          await parseAllDocuments(options);
        }
      } catch (error) {
        logger.error(`解析失败: ${error}`);
        process.exit(1);
      }
    });
}

function createReindexCommand(): Command {
  return new Command('reindex')
    .description('重建 knowledge/index.json，修复手工修改或损坏后的知识索引')
    .action(async () => {
      try {
        const entries = await rebuildKnowledgeIndex(process.cwd());
        logger.success(`已重建知识索引: ${entries.length} 条`);
      } catch (error) {
        logger.error(`重建失败: ${error}`);
        process.exit(1);
      }
    });
}

function createSyncStackCommand(): Command {
  return new Command('sync-stack')
    .description('根据 ADR 决策自动同步 tech-stack.md')
    .option('--dry-run', '预览变更但不写入文件')
    .action(async (options) => {
      try {
        await syncTechStack(options);
      } catch (error) {
        logger.error(`同步失败: ${error}`);
        process.exit(1);
      }
    });
}

async function addKnowledge(
  files: string[], 
  options: { category: string }
): Promise<void> {
  logger.h1('📚 添加知识文档');

  const knowledgeDir = join(process.cwd(), '.webforge', 'knowledge');
  const category = resolveKnowledgeCategory(options.category);
  const targetDir = join(knowledgeDir, category);
  
  await ensureDir(targetDir);

  const supportedExts = ['.docx', '.pdf', '.xlsx', '.xls', '.txt', '.md'];
  const added: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const filename = basename(file);

    if (!supportedExts.includes(ext)) {
      logger.warning(`跳过不支持的格式: ${filename}`);
      skipped.push(filename);
      continue;
    }

    try {
      const targetPath = join(targetDir, filename);
      await copyFile(file, targetPath);
      logger.success(`添加: ${filename} → ${category}/`);
      added.push(filename);
    } catch (error) {
      logger.error(`失败: ${filename} - ${error}`);
      skipped.push(filename);
    }
  }

  console.log();
  logger.h2('摘要');
  logger.info(`成功: ${added.length} 个文件`);
  if (skipped.length > 0) {
    logger.warning(`跳过: ${skipped.length} 个文件`);
  }

  if (added.length > 0) {
    await rebuildKnowledgeIndex(process.cwd());
    console.log();
    logger.info('提示: 使用 webforge knowledge parse 解析文档');
  }
}

async function listKnowledge(options: { category?: string }): Promise<void> {
  logger.h1('📚 知识文档列表');

  const knowledgeDir = join(process.cwd(), '.webforge', 'knowledge');
  
  if (!existsSync(knowledgeDir)) {
    logger.warning('知识库目录不存在');
    return;
  }

  const categories = options.category 
    ? [options.category]
    : ['requirements', 'design', 'data', 'decisions', 'raw'];

  for (const category of categories) {
    const dir = join(knowledgeDir, category);
    
    if (!existsSync(dir)) continue;

    const files = await readdir(dir);
    
    if (files.length === 0) continue;

    logger.h2(`${category}/`);
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      const icon = ext === '.md' ? '📝' :
                   ext === '.pdf' ? '📄' :
                   ext === '.docx' ? '📘' :
                   ext === '.xlsx' ? '📊' :
                   '📎';
      console.log(`  ${icon} ${file}`);
    }
  }
}

async function parseAllDocuments(
  options: { category?: string; output?: string }
): Promise<void> {
  logger.h1('🔍 批量解析文档');

  const knowledgeDir = join(process.cwd(), '.webforge', 'knowledge');
  
  if (!existsSync(knowledgeDir)) {
    logger.warning('知识库目录不存在');
    return;
  }

  if (options.category === 'parsed') {
    logger.warning('parsed 是生成目录，不能作为批量解析输入');
    return;
  }

  const categories = options.category
    ? [options.category]
    : ['requirements', 'design', 'data', 'decisions', 'raw'];

  const supportedExts = ['.txt', '.md', '.docx', '.pdf', '.xlsx', '.xls'];
  const parsed: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  const outputDir = options.output 
    ? resolve(process.cwd(), options.output)
    : join(process.cwd(), '.webforge', 'knowledge', 'parsed');
  
  await ensureDir(outputDir);

  for (const category of categories) {
    const dir = join(knowledgeDir, category);
    
    if (!existsSync(dir)) continue;

    const files = await readdir(dir);
    
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      
      if (!supportedExts.includes(ext)) {
        skipped.push(`${category}/${file}`);
        continue;
      }

      const outputPath = join(outputDir, buildParsedFilename(`${category}/${file}`));

      try {
        const filePath = join(dir, file);
        await parseSingleFile(filePath, outputPath);
        parsed.push(file);
      } catch (error) {
        logger.error(`失败: ${file} - ${error}`);
        failed.push(file);
      }
    }
  }

  console.log();
  logger.h2('批量解析完成');
  logger.success(`成功: ${parsed.length} 个文件`);
  
  if (skipped.length > 0) {
    logger.info(`跳过: ${skipped.length} 个文件`);
  }
  if (failed.length > 0) {
    logger.error(`失败: ${failed.length} 个文件`);
  }

  if (parsed.length > 0) {
    if (isManagedParsedOutput(process.cwd(), outputDir)) {
      await rebuildKnowledgeIndex(process.cwd());
    } else {
      logger.info('自定义输出目录未纳入 knowledge index');
    }
    console.log();
    logger.info(`输出目录: ${outputDir}`);
  } else if (isManagedParsedOutput(process.cwd(), outputDir)) {
    await rebuildKnowledgeIndex(process.cwd());
  }
}

async function parseDocument(
  file: string, 
  options: { output?: string }
): Promise<void> {
  logger.h1('🔍 解析文档');

  if (!existsSync(file)) {
    logger.error(`文件不存在: ${file}`);
    return;
  }

  const outputDir = options.output 
    ? resolve(process.cwd(), options.output)
    : join(process.cwd(), '.webforge', 'knowledge', 'parsed');
  await ensureDir(outputDir);
  await parseSingleFile(file, resolveParsedOutputPath(process.cwd(), file, outputDir));

  if (isManagedParsedOutput(process.cwd(), outputDir)) {
    await rebuildKnowledgeIndex(process.cwd());
  } else {
    logger.info('自定义输出目录未纳入 knowledge index');
  }

  console.log();
  logger.success('解析完成');
  logger.info(`输出目录: ${outputDir}`);
}

async function parseSingleFile(filePath: string, outputPath: string): Promise<void> {
  const ext = extname(filePath).toLowerCase();

  logger.info(`解析: ${basename(filePath)}`);

  switch (ext) {
    case '.txt':
    case '.md':
      await copyFile(filePath, outputPath);
      logger.success('  → 已复制文本文件');
      break;
    
    case '.docx':
      await parseDocx(filePath, outputPath);
      break;
    
    case '.pdf':
      await parsePdf(filePath, outputPath);
      break;
    
    case '.xlsx':
    case '.xls':
      await parseXlsx(filePath, outputPath);
      break;
    
    default:
      throw new Error(`不支持的格式: ${ext}`);
  }
}

async function parseDocx(inputPath: string, outputPath: string): Promise<void> {
  try {
    const mammoth = await import('mammoth');
    const buffer = await readFile(inputPath);
    const result = await mammoth.convertToHtml({ buffer });
    
    // HTML 转 Markdown（简化版）
    let markdown = result.value
      .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''); // 移除剩余标签
    
    const content = `# ${basename(inputPath, '.docx')}\n\n${markdown}`;
    await writeFile(outputPath, content, 'utf-8');
    logger.success('  → 已解析 Word 文档');
  } catch (error) {
    logger.error(`  解析失败: ${error}`);
    throw error;
  }
}

async function parsePdf(inputPath: string, outputPath: string): Promise<void> {
  try {
    // pdf-parse 在 ESM 下需要特殊处理
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const buffer = await readFile(inputPath);
    const result = await pdfParse(buffer);
    
    const content = `# ${basename(inputPath, '.pdf')}\n\n${result.text}`;
    await writeFile(outputPath, content, 'utf-8');
    logger.success('  → 已解析 PDF 文档');
  } catch (error) {
    logger.error(`  解析失败: ${error}`);
    throw error;
  }
}

async function parseXlsx(inputPath: string, outputPath: string): Promise<void> {
  try {
    const xlsx = await loadXlsx();
    const buffer = await readFile(inputPath);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    
    let markdown = `# ${basename(inputPath, extname(inputPath))}\n\n`;
    
    // 转换每个工作表
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
      
      markdown += `## ${sheetName}\n\n`;
      
      if (data.length === 0) continue;
      
      // 表头
      const headers = data[0];
      markdown += '| ' + headers.join(' | ') + ' |\n';
      markdown += '|' + headers.map(() => '---').join('|') + '|\n';
      
      // 数据行
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        markdown += '| ' + row.map(cell => cell ?? '').join(' | ') + ' |\n';
      }
      
      markdown += '\n';
    }
    
    await writeFile(outputPath, markdown, 'utf-8');
    logger.success('  → 已解析 Excel 文档');
  } catch (error) {
    logger.error(`  解析失败: ${error}`);
    throw error;
  }
}

function resolveKnowledgeCategory(category: string): KnowledgeCategory {
  if (isManagedKnowledgeCategory(category) && category !== 'parsed') {
    return category as KnowledgeCategory;
  }

  logger.warning(`未知或不可写入的分类 "${category}"，已回退到 raw`);
  return 'raw';
}

function resolveParsedOutputPath(
  basePath: string,
  filePath: string,
  outputDir: string
): string {
  const knowledgeRoot = join(basePath, '.webforge', 'knowledge');
  const relativePath = relative(knowledgeRoot, filePath).replace(/\\/g, '/');

  if (!relativePath.startsWith('..') && !relativePath.startsWith('parsed/')) {
    return join(outputDir, buildParsedFilename(relativePath));
  }

  return join(outputDir, `${basename(filePath, extname(filePath))}.md`);
}

function buildParsedFilename(relativeSourcePath: string): string {
  const normalized = relativeSourcePath.replace(/\\/g, '/');
  const ext = extname(normalized);
  const stem = ext ? normalized.slice(0, -ext.length) : normalized;
  const extSuffix = ext ? `--${ext.replace(/^\./, '')}` : '';
  return `${stem.replace(/[\/]/g, '--')}${extSuffix}.md`;
}

function isManagedParsedOutput(basePath: string, outputDir: string): boolean {
  return resolve(outputDir) === resolve(basePath, '.webforge', 'knowledge', 'parsed');
}

interface CreateKnowledgeOptions {
  category: string;
  template: string;
  title?: string;
}

async function createKnowledgeDoc(
  name: string,
  options: CreateKnowledgeOptions,
  basePath: string = process.cwd()
): Promise<void> {
  logger.h1('📝 创建知识文档');

  const category = resolveKnowledgeCategory(options.category);
  
  // 只允许 design/decisions/requirements/data，禁止 raw/parsed
  if (category === 'raw' && options.category !== 'raw') {
    throw new Error(`分类 "${options.category}" 无效或不允许直接写入。可用: design, decisions, requirements, data`);
  }

  const knowledgeDir = join(basePath, '.webforge', 'knowledge');
  const targetDir = join(knowledgeDir, category);
  await ensureDir(targetDir);

  const filename = name.endsWith('.md') ? name : `${name}.md`;
  const targetPath = join(targetDir, filename);

  if (existsSync(targetPath)) {
    throw new Error(`文档已存在: ${targetPath}`);
  }

  // 根据模板生成内容
  const content = generateKnowledgeTemplate(options.template, options.title || name);
  
  await writeFile(targetPath, content, 'utf-8');
  logger.success(`创建: ${filename} → ${category}/`);

  // 更新索引
  await rebuildKnowledgeIndex(basePath);
  
  // 🔄 自动同步: 如果是 ADR，尝试同步 tech-stack.md
  if (category === 'decisions' && filename.match(/^ADR-\d+/i)) {
    logger.info('检测到 ADR 创建，检查技术栈同步...');
    await trySyncTechStack(basePath, { silent: true });
  }
  
  console.log();
  logger.info(`提示: 编辑 ${relative(basePath, targetPath)}`);
}

function generateKnowledgeTemplate(template: string, title: string): string {
  const now = new Date().toISOString().split('T')[0];
  
  switch (template) {
    case 'adr':
      return `# ADR-XXX: ${title}

## 状态

- **状态**: 提案 (Proposed)
- **日期**: ${now}
- **决策人**: 

## 背景

描述决策背景和问题。

## 考虑的方案

### 方案 A
- **优点**:
- **缺点**:

### 方案 B
- **优点**:
- **缺点**:

## 决策

**采用方案 X**，原因：
1. 
2. 
3. 

## 影响

### 积极影响
- 

### 消极影响
- 

## 参考

- 
`;

    case 'guidelines':
      return `# ${title}

> 制定时间: ${now}
> 适用任务: 
> 执行模式: 

---

## 1. 概述

## 2. 规范内容

## 3. 示例

## 4. 检查清单

- [ ] 

---

> 规范制定: Agent
> 审核状态: pending_review
`;

    default:
      return `# ${title}

> 创建时间: ${now}

## 概述

## 详细内容

## 参考
`;
  }
}

// ============================================
// Tech Stack 同步机制
// ============================================

interface TechStackChange {
  category: 'frontend' | 'backend' | 'database' | 'devops';
  type: 'add' | 'remove' | 'replace';
  package?: string;
  oldPackage?: string;
  newPackage?: string;
  version?: string;
  reason?: string;
  adrFile: string;
}

interface ParsedADR {
  file: string;
  status: string;
  title: string;
  decision: string;
  changes: TechStackChange[];
}

/**
 * 同步 ADR 决策到知识库
 * 分析已接受 ADR 对 tech-stack.md 和 design/guidelines 的影响
 * 生成待办任务报告，由 Agent 手动更新
 */
async function syncTechStack(options: { dryRun?: boolean } = {}): Promise<void> {
  logger.h1('🔄 ADR 知识库同步分析');
  
  const basePath = process.cwd();
  const decisionsDir = join(basePath, '.webforge', 'knowledge', 'decisions');
  
  // 1. 扫描所有 ADR 文件
  const adrFiles = await scanADRFiles(decisionsDir);
  logger.info(`发现 ${adrFiles.length} 个 ADR 文件`);
  
  // 2. 解析已接受的 ADR
  const acceptedADRs: ParsedADR[] = [];
  for (const file of adrFiles) {
    const adr = await parseADRFile(file);
    if (adr && adr.status.toLowerCase().includes('accepted')) {
      acceptedADRs.push(adr);
    }
  }
  
  if (acceptedADRs.length === 0) {
    logger.warning('没有发现已接受的 ADR');
    return;
  }
  
  logger.success(`已接受 ADR: ${acceptedADRs.length} 个`);
  
  // 3. 提取技术栈变更
  const allChanges: TechStackChange[] = [];
  for (const adr of acceptedADRs) {
    allChanges.push(...adr.changes);
  }
  
  if (allChanges.length === 0) {
    logger.info('没有需要同步的技术栈变更');
    return;
  }
  
  // 4. 显示变更摘要
  logger.h2('检测到的技术栈变更');
  for (const change of allChanges) {
    const icon = change.type === 'add' ? '➕' : change.type === 'remove' ? '➖' : '🔄';
    if (change.type === 'replace') {
      logger.info(`${icon} [${change.category}] ${change.oldPackage} → ${change.newPackage} (${change.adrFile})`);
    } else {
      logger.info(`${icon} [${change.category}] ${change.package} ${change.type === 'add' ? '添加' : '移除'} (${change.adrFile})`);
    }
  }
  
  if (options.dryRun) {
    logger.info('\n(dry-run 模式，仅预览不生成任务)');
    return;
  }
  
  // 5. 生成知识库同步报告
  const report = await generateKnowledgeSyncReport(basePath, acceptedADRs, allChanges);
  
  if (report.tasks.length === 0) {
    logger.success('\n✅ 所有知识库文档已与 ADR 保持一致');
    return;
  }
  
  // 6. 显示待办任务
  logger.h2('📝 需要人工审查的文档');
  logger.info('以下文档需要根据 ADR 决策更新：\n');
  
  for (const task of report.tasks) {
    const icon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
    logger.info(`${icon} [${task.type}] ${task.target}`);
    logger.info(`   原因: ${task.reason}`);
    if (task.details) {
      logger.info(`   详情: ${task.details}`);
    }
    if (task.suggestedActions && task.suggestedActions.length > 0) {
      logger.info(`   建议操作:`);
      for (const action of task.suggestedActions) {
        logger.info(`     - ${action}`);
      }
    }
    console.log();
  }
  
  logger.h2('📋 处理建议');
  logger.info('1. 根据上述任务列表，逐一审查并更新相关文档');
  logger.info('2. 更新完成后，再次运行 webforge knowledge sync-stack 验证');
  logger.info('3. 确保所有 design/guidelines 与 ADR 决策保持一致\n');
  
  // 7. 重建索引
  await rebuildKnowledgeIndex(basePath);
}

/**
 * 扫描 ADR 文件
 */
async function scanADRFiles(decisionsDir: string): Promise<string[]> {
  if (!existsSync(decisionsDir)) {
    return [];
  }
  
  const files = await readdir(decisionsDir);
  return files
    .filter(f => f.match(/^ADR-\d+.*\.md$/i))
    .map(f => join(decisionsDir, f));
}

/**
 * 解析 ADR 文件，提取技术栈变更
 */
async function parseADRFile(filePath: string): Promise<ParsedADR | null> {
  const content = await readFile(filePath, 'utf-8');
  const filename = basename(filePath);
  
  // 提取状态
  const statusMatch = content.match(/\*\*状态\*\*:\s*(.+)/i);
  const status = statusMatch ? statusMatch[1].trim() : 'Unknown';
  
  // 提取标题
  const titleMatch = content.match(/^#\s*(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : filename;
  
  // 提取决策（在 "## 决策" 部分）
  const decisionMatch = content.match(/##\s*决策[\s\S]*?(?=##|$)/);
  const decision = decisionMatch ? decisionMatch[0] : '';
  
  // 提取技术栈变更
  const changes: TechStackChange[] = [];
  
  // 检测技术栈变更模式
  // 1. 检测 "使用 X 替代 Y" 模式
  const replacePattern = /使用\s+(\w+)\s+替代\s+(\w+)|采用\s+(\w+)\s+.*替代\s+(\w+)|迁移到\s+(\w+).*从\s+(\w+)/gi;
  let match;
  while ((match = replacePattern.exec(content)) !== null) {
    const newTech = match[1] || match[3] || match[5];
    const oldTech = match[2] || match[4] || match[6];
    if (newTech && oldTech) {
      changes.push({
        category: inferCategory(newTech),
        type: 'replace',
        oldPackage: oldTech.toLowerCase(),
        newPackage: newTech.toLowerCase(),
        reason: `ADR 决策: ${title}`,
        adrFile: filename
      });
    }
  }
  
  // 2. 检测依赖添加模式（在核心依赖部分）
  const packagePatterns = [
    /["'](\w+)["']\s*:\s*["']\^?([\d.]+)["']/g,
    /(\w+)\s*[:@]\s*([\d.]+)/g
  ];
  
  for (const pattern of packagePatterns) {
    while ((match = pattern.exec(content)) !== null) {
      const pkgName = match[1];
      const version = match[2];
      
      // 跳过常见的非技术栈模式
      if (isTechPackage(pkgName)) {
        // 检查是否已经在 changes 中（替换模式）
        const exists = changes.some(c => 
          c.newPackage === pkgName.toLowerCase() || c.oldPackage === pkgName.toLowerCase()
        );
        
        if (!exists) {
          changes.push({
            category: inferCategory(pkgName),
            type: 'add',
            package: pkgName.toLowerCase(),
            version: version,
            reason: `ADR 决策: ${title}`,
            adrFile: filename
          });
        }
      }
    }
  }
  
  return { file: filePath, status, title, decision, changes };
}

/**
 * 判断是否为技术包名
 */
function isTechPackage(name: string): boolean {
  const techPackages = [
    'react', 'vue', 'angular', 'svelte', 'next', 'nuxt',
    'express', 'koa', 'fastify', 'nest',
    'axios', 'alova', 'fetch', 'swr', 'tanstack',
    'prisma', 'typeorm', 'sequelize', 'mongoose',
    'zustand', 'redux', 'mobx', 'pinia', 'recoil',
    'antd', 'mui', 'chakra', 'tailwind',
    'vite', 'webpack', 'rollup', 'esbuild',
    'jest', 'vitest', 'cypress', 'playwright',
    'typescript', 'javascript', 'python', 'go', 'rust'
  ];
  
  return techPackages.some(p => name.toLowerCase().includes(p));
}

/**
 * 推断技术类别
 */
function inferCategory(pkgName: string): TechStackChange['category'] {
  const name = pkgName.toLowerCase();
  
  // 前端框架/库
  if (name.match(/react|vue|angular|svelte|next|nuxt|antd|mui|chakra|tailwind|zustand|redux|mobx|pinia/)) {
    return 'frontend';
  }
  
  // HTTP 客户端
  if (name.match(/axios|alova|swr|tanstack/)) {
    return 'frontend';
  }
  
  // 后端框架
  if (name.match(/express|koa|fastify|nest/)) {
    return 'backend';
  }
  
  // 数据库/ORM
  if (name.match(/prisma|typeorm|sequelize|mongoose|postgres|mysql|mongo/)) {
    return 'database';
  }
  
  // 构建工具
  if (name.match(/vite|webpack|rollup|esbuild/)) {
    return 'frontend';
  }
  
  // 测试工具
  if (name.match(/jest|vitest|cypress|playwright/)) {
    return 'devops';
  }
  
  return 'frontend'; // 默认
}

/**
 * 尝试同步 Tech Stack（生成待办任务模式）
 * 在 ADR 创建/更新后自动调用
 * 
 * 注意：此功能不自动修改任何文档，仅生成任务报告
 * 由 Agent 根据报告手动更新相关文档
 */
async function trySyncTechStack(
  basePath: string,
  options: { silent?: boolean } = {}
): Promise<void> {
  try {
    const decisionsDir = join(basePath, '.webforge', 'knowledge', 'decisions');
    
    // 扫描所有 ADR 文件
    const adrFiles = await scanADRFiles(decisionsDir);
    if (adrFiles.length === 0) return;
    
    // 解析已接受的 ADR
    const acceptedADRs: ParsedADR[] = [];
    for (const file of adrFiles) {
      const adr = await parseADRFile(file);
      if (adr && adr.status.toLowerCase().includes('accepted')) {
        acceptedADRs.push(adr);
      }
    }
    
    if (acceptedADRs.length === 0) return;
    
    // 提取技术栈变更
    const allChanges: TechStackChange[] = [];
    for (const adr of acceptedADRs) {
      allChanges.push(...adr.changes);
    }
    
    if (allChanges.length === 0) return;
    
    if (!options.silent) {
      logger.h2('🔄 ADR 技术栈变更检测');
      for (const change of allChanges) {
        const icon = change.type === 'add' ? '➕' : change.type === 'remove' ? '➖' : '🔄';
        if (change.type === 'replace') {
          logger.info(`${icon} ${change.oldPackage} → ${change.newPackage} (${change.adrFile})`);
        } else {
          logger.info(`${icon} ${change.package} ${change.type === 'add' ? '添加' : '移除'}`);
        }
      }
    }
    
    // 🔄 生成知识库同步任务报告
    const report = await generateKnowledgeSyncReport(basePath, acceptedADRs, allChanges);
    
    if (!options.silent && report.tasks.length > 0) {
      logger.h2('📝 需要人工审查的文档');
      logger.info('以下文档可能需要根据 ADR 决策更新：\n');
      
      for (const task of report.tasks) {
        const icon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
        logger.info(`${icon} [${task.type}] ${task.target}`);
        logger.info(`   原因: ${task.reason}`);
        if (task.details) {
          logger.info(`   详情: ${task.details}`);
        }
        console.log();
      }
      
      logger.info('提示: 请根据 ADR 决策手动更新上述文档\n');
    }
    
    // 重建索引
    await rebuildKnowledgeIndex(basePath);
  } catch (error) {
    // 静默失败，不中断主流程
    if (!options.silent) {
      logger.warning(`知识库同步检测失败: ${error}`);
    }
  }
}

/**
 * 知识库同步任务
 */
interface KnowledgeSyncTask {
  type: 'tech-stack' | 'design-guideline' | 'adr-reference';
  target: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  details?: string;
  suggestedActions?: string[];
}

/**
 * 知识库同步报告
 */
interface KnowledgeSyncReport {
  generatedAt: string;
  adrs: ParsedADR[];
  changes: TechStackChange[];
  tasks: KnowledgeSyncTask[];
}

/**
 * 生成知识库同步报告
 * 分析 ADR 变更对 tech-stack.md 和 design/guidelines 的影响
 */
async function generateKnowledgeSyncReport(
  basePath: string,
  adrs: ParsedADR[],
  changes: TechStackChange[]
): Promise<KnowledgeSyncReport> {
  const tasks: KnowledgeSyncTask[] = [];
  
  const decisionsDir = join(basePath, '.webforge', 'knowledge', 'decisions');
  const designDir = join(basePath, '.webforge', 'knowledge', 'design');
  
  // 1. 检查 tech-stack.md 是否需要更新
  const techStackPath = join(decisionsDir, 'tech-stack.md');
  if (existsSync(techStackPath)) {
    const techStackContent = await readFile(techStackPath, 'utf-8');
    
    for (const change of changes) {
      if (change.type === 'replace') {
        // 检查是否包含旧技术
        const hasOld = new RegExp(`"${change.oldPackage}"\\s*:`).test(techStackContent);
        const hasNew = new RegExp(`"${change.newPackage}"\\s*:`).test(techStackContent);
        
        if (hasOld && !hasNew) {
          tasks.push({
            type: 'tech-stack',
            target: 'decisions/tech-stack.md',
            reason: `需要将 ${change.oldPackage} 替换为 ${change.newPackage}`,
            priority: 'high',
            details: `ADR ${change.adrFile} 决定使用 ${change.newPackage} 替代 ${change.oldPackage}`,
            suggestedActions: [
              `更新 \"核心依赖\" 部分的 JSON，将 "${change.oldPackage}" 替换为 "${change.newPackage}"`,
              `添加 ${change.newPackage} 的简介和链接`,
              `记录同步时间和对应的 ADR`
            ]
          });
        }
      }
    }
  }
  
  // 2. 检查 design/guidelines 是否需要更新
  if (existsSync(designDir)) {
    const files = await readdir(designDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    // 提取受影响的技术（被替换的旧技术）
    const affectedTechs = changes
      .filter(c => c.type === 'replace' && c.oldPackage)
      .map(c => ({ 
        old: c.oldPackage!.toLowerCase(), 
        new: c.newPackage!.toLowerCase(),
        adr: c.adrFile
      }));
    
    for (const file of mdFiles) {
      const filePath = join(designDir, file);
      const content = await readFile(filePath, 'utf-8');
      const contentLower = content.toLowerCase();
      
      for (const tech of affectedTechs) {
        const regex = new RegExp(`\\b${tech.old}\\b`, 'gi');
        const matches = contentLower.match(regex);
        
        if (matches && matches.length > 0) {
          tasks.push({
            type: 'design-guideline',
            target: `design/${file}`,
            reason: `文档引用了被替换的技术 ${tech.old}，需要根据 ADR 更新为 ${tech.new} 的实现规范`,
            priority: matches.length > 5 ? 'high' : 'medium',
            details: `发现 ${matches.length} 处 "${tech.old}" 引用，需更新为 "${tech.new}" 的具体使用规范`,
            suggestedActions: [
              `将 ${tech.old} 的具体使用规范替换为 ${tech.new} 的规范`,
              `更新代码示例和配置说明`,
              `检查相关工具和插件是否需要变更`,
              `在文档中添加迁移说明，引用 ADR ${tech.adr}`
            ]
          });
        }
      }
    }
  }
  
  // 3. 检查 ADR 之间的引用一致性
  // TODO: 检查是否有 ADR 引用了已被替换的技术
  
  return {
    generatedAt: new Date().toISOString(),
    adrs,
    changes,
    tasks
  };
}
