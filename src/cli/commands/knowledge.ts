/**
 * knowledge 命令 - 知识摄入
 */

import { Command } from 'commander';
import { readdir, copyFile, writeFile, readFile, stat } from 'fs/promises';
import { join, extname, basename, relative, resolve } from 'path';
import { existsSync } from 'fs';
import logger from '../utils/logger.js';
import { ensureDir, writeJson } from '../../utils/file.js';

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
    .addCommand(createParseCommand());

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

type KnowledgeCategory =
  | 'requirements'
  | 'design'
  | 'data'
  | 'decisions'
  | 'raw'
  | 'parsed';

interface KnowledgeIndexEntry {
  id: string;
  type: 'requirement' | 'design' | 'decision' | 'parsed' | 'note';
  title: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  'requirements',
  'design',
  'data',
  'decisions',
  'raw',
  'parsed'
];

async function rebuildKnowledgeIndex(basePath: string): Promise<void> {
  const knowledgeDir = join(basePath, '.webforge', 'knowledge');
  const indexPath = join(knowledgeDir, 'index.json');
  const entries: KnowledgeIndexEntry[] = [];

  await ensureDir(knowledgeDir);

  for (const category of KNOWLEDGE_CATEGORIES) {
    const categoryDir = join(knowledgeDir, category);
    if (!existsSync(categoryDir)) {
      continue;
    }

    const files = await readdir(categoryDir);
    for (const file of files) {
      const filePath = join(categoryDir, file);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        continue;
      }

      const ext = extname(file).toLowerCase();
      const relativePath = relative(basePath, filePath).replace(/\\/g, '/');
      entries.push({
        id: createKnowledgeEntryId(relativePath),
        type: mapKnowledgeType(category),
        title: basename(file, ext),
        path: relativePath,
        createdAt: fileStat.birthtime.toISOString(),
        updatedAt: fileStat.mtime.toISOString(),
        tags: [category, ext.replace(/^\./, '')].filter(Boolean)
      });
    }
  }

  entries.sort((left, right) => left.path.localeCompare(right.path));
  await writeJson(indexPath, entries);
}

function mapKnowledgeType(category: KnowledgeCategory): KnowledgeIndexEntry['type'] {
  switch (category) {
    case 'requirements':
      return 'requirement';
    case 'design':
      return 'design';
    case 'decisions':
      return 'decision';
    case 'parsed':
      return 'parsed';
    default:
      return 'note';
  }
}

function createKnowledgeEntryId(relativePath: string): string {
  return `knowledge-${relativePath.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`;
}

function resolveKnowledgeCategory(category: string): KnowledgeCategory {
  if (KNOWLEDGE_CATEGORIES.includes(category as KnowledgeCategory) && category !== 'parsed') {
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
