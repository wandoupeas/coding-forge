import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { ensureDir, readJson, writeJson, writeText } from '../utils/file.js';
import { buildSuperpowersRegistry } from './superpowers-registry.js';
import { loadWorkspaceState } from './workspace.js';
import type { Phase, Task, WorkspaceKnowledgeIndexEntry } from '../types/index.js';

export { buildExecutionContext } from './context.js';

export interface PlanOptions {
  template?: string;
  force?: boolean;
  superpowers?: boolean;
  execution?: 'subagent' | 'inline';
  techStack?: TechStack;
  resolveTechStack?: (
    analysis: KnowledgeAnalysis
  ) => Promise<TechStack | undefined>;
}

export interface TechStack {
  backend: string;
  frontend: string;
  database: string;
  infrastructure: string[];
}

export interface KnowledgeAnalysis {
  documents: string[];
  contents: Record<string, string>;
  projectType?: string;
  keywords: string[];
  techStack: string[];
}

export interface PlanningResult {
  phases: Phase[];
  tasks: Task[];
  analysis: KnowledgeAnalysis;
  requiredSkills: string[];
  template: string;
  techStack: TechStack;
  reusedExistingPlan: boolean;
  planDocumentPath?: string;
}

interface SkillCatalogEntry {
  name: string;
  patterns: string[];
  description: string;
  category:
    | 'frontend'
    | 'backend'
    | 'database'
    | 'language'
    | 'testing'
    | 'document'
    | 'ai'
    | 'other';
  priority: number;
}

export const TECH_STACK_OPTIONS = {
  backend: [
    { name: 'Node.js + TypeScript + NestJS', value: 'nodejs-nestjs', skills: ['backend-patterns', 'tdd-workflow'] },
    { name: 'Go + Gin', value: 'go-gin', skills: ['golang-patterns', 'backend-patterns'] },
    { name: 'Java + Spring Boot', value: 'java-spring', skills: ['backend-patterns'] },
    { name: 'Python + FastAPI', value: 'python-fastapi', skills: ['backend-patterns'] }
  ],
  frontend: [
    { name: 'Vue 3 + TypeScript', value: 'vue3', skills: ['vue-best-practices', 'frontend-design'] },
    { name: 'React 18 + TypeScript', value: 'react', skills: ['frontend-design'] },
    { name: 'Angular', value: 'angular', skills: ['frontend-design'] }
  ],
  database: [
    { name: 'PostgreSQL', value: 'postgresql', skills: ['postgres-patterns'] },
    { name: 'MySQL', value: 'mysql', skills: [] },
    { name: 'MongoDB', value: 'mongodb', skills: [] },
    { name: 'PostgreSQL + Redis', value: 'postgres-redis', skills: ['postgres-patterns'] }
  ],
  infrastructure: [
    { name: 'Docker', value: 'docker', skills: [] },
    { name: 'Docker + Kubernetes', value: 'docker-k8s', skills: [] },
    { name: 'AWS', value: 'aws', skills: [] },
    { name: '阿里云', value: 'aliyun', skills: [] }
  ]
} as const;

export const AVAILABLE_SKILLS: Record<string, SkillCatalogEntry> = {
  'frontend-design': {
    name: 'frontend-design',
    patterns: ['ui', 'frontend', '界面', '设计', 'css', '样式', '组件', 'react', 'vue', 'angular', 'html', 'tailwind'],
    description: 'Create distinctive, production-grade frontend interfaces',
    category: 'frontend',
    priority: 9
  },
  'vue-best-practices': {
    name: 'vue-best-practices',
    patterns: ['vue', 'vue3', 'pinia', 'composition api', 'vue router'],
    description: 'Vue.js Composition API with TypeScript',
    category: 'frontend',
    priority: 8
  },
  'backend-patterns': {
    name: 'backend-patterns',
    patterns: ['backend', 'api', 'server', 'rest', 'graphql', 'microservice', '后端', '接口', '服务'],
    description: 'Backend architecture patterns, API design, database optimization',
    category: 'backend',
    priority: 9
  },
  'postgres-patterns': {
    name: 'postgres-patterns',
    patterns: ['postgres', 'postgresql', 'supabase', 'sql', '关系型数据库', '事务'],
    description: 'PostgreSQL database patterns',
    category: 'database',
    priority: 8
  },
  'golang-patterns': {
    name: 'golang-patterns',
    patterns: ['go', 'golang', 'gin', 'gorm'],
    description: 'Idiomatic Go patterns and best practices',
    category: 'language',
    priority: 8
  },
  'tdd-workflow': {
    name: 'tdd-workflow',
    patterns: ['test', '测试', 'tdd', 'unit test', 'jest', 'vitest', 'pytest', 'coverage'],
    description: 'Test-driven development with 80%+ coverage',
    category: 'testing',
    priority: 7
  },
  'claude-api': {
    name: 'claude-api',
    patterns: ['claude api', 'anthropic sdk', 'claude_code', 'ai integration', 'llm api'],
    description: 'Build apps with Claude API or Anthropic SDK',
    category: 'ai',
    priority: 6
  },
  'mcp-builder': {
    name: 'mcp-builder',
    patterns: ['mcp', 'model context protocol', 'mcp server'],
    description: 'Creating MCP servers for LLM tool integration',
    category: 'ai',
    priority: 6
  },
  'docx': {
    name: 'docx',
    patterns: ['word', 'docx', 'document generation', 'report generation'],
    description: 'Create, read, edit Word documents',
    category: 'document',
    priority: 5
  },
  'pdf': {
    name: 'pdf',
    patterns: ['pdf generation', 'pdf parsing', 'pdf extraction'],
    description: 'Reading, extracting, creating PDFs',
    category: 'document',
    priority: 5
  },
  'pptx': {
    name: 'pptx',
    patterns: ['ppt generation', 'presentation', 'slide deck', 'powerpoint'],
    description: 'Creating presentations and slide decks',
    category: 'document',
    priority: 5
  },
  'xlsx': {
    name: 'xlsx',
    patterns: ['excel generation', 'spreadsheet', 'xlsx export', 'csv export', '数据导出'],
    description: 'Working with spreadsheets',
    category: 'document',
    priority: 5
  },
  'web-artifacts-builder': {
    name: 'web-artifacts-builder',
    patterns: ['react dashboard', 'tailwind', 'shadcn/ui', 'complex artifact'],
    description: 'Complex multi-component HTML artifacts',
    category: 'frontend',
    priority: 7
  },
  'algorithmic-art': {
    name: 'algorithmic-art',
    patterns: ['generative art', 'p5.js', 'algorithmic visualization', 'creative coding'],
    description: 'Creating algorithmic art using p5.js',
    category: 'other',
    priority: 4
  },
  'clickhouse-io': {
    name: 'clickhouse-io',
    patterns: ['clickhouse', 'olap', 'analytics', '大数据'],
    description: 'ClickHouse database patterns for analytics',
    category: 'database',
    priority: 6
  },
  'security-review': {
    name: 'security-review',
    patterns: ['auth', 'authentication', 'authorization', 'oauth', 'jwt', 'security', '权限', '认证'],
    description: 'Security patterns and review checklist',
    category: 'backend',
    priority: 8
  }
};

export async function buildPlanFromKnowledge(
  basePath: string,
  options: PlanOptions = {}
): Promise<PlanningResult> {
  const workspace = await loadWorkspaceState(basePath);
  const analysis = await analyzeKnowledgeBase(basePath, workspace.indexes.knowledge);
  const template = resolveTemplate(options.template, analysis.projectType);
  const requiredSkills = options.superpowers ? detectRequiredSkills(analysis) : [];

  if (!options.force && workspace.tasks.tasks.length > 0) {
    return {
      phases: workspace.phases.phases,
      tasks: workspace.tasks.tasks,
      analysis,
      requiredSkills,
      template,
      techStack:
        (await loadTechStack(basePath)) ||
        options.techStack ||
        inferTechStackFromAnalysis(analysis),
      reusedExistingPlan: true
    };
  }

  const techStack =
    options.techStack ||
    (await options.resolveTechStack?.(analysis)) ||
    (await loadTechStack(basePath)) ||
    inferTechStackFromAnalysis(analysis);

  await saveTechStack(basePath, techStack);

  const phases = generatePhases(template);
  const tasks = generateSmartTasks(
    phases,
    template,
    analysis,
    requiredSkills,
    {
      superpowers: options.superpowers,
      execution: options.execution
    },
    techStack
  );

  let planDocumentPath: string | undefined;
  if (options.superpowers) {
    planDocumentPath = await generateSuperpowersPlan(
      basePath,
      phases,
      tasks,
      analysis,
      requiredSkills,
      {
        execution: options.execution
      },
      techStack
    );
  }

  await writeJson(workspace.paths.phases, { phases });
  await writeJson(workspace.paths.tasks, { tasks });

  return {
    phases,
    tasks,
    analysis,
    requiredSkills,
    template,
    techStack,
    reusedExistingPlan: false,
    planDocumentPath
  };
}

export function getTechStackName(
  category: keyof typeof TECH_STACK_OPTIONS,
  value: string
): string {
  const found = TECH_STACK_OPTIONS[category].find((option) => option.value === value);
  return found?.name || value;
}

async function loadTechStack(basePath: string): Promise<TechStack | undefined> {
  const configPath = join(basePath, '.webforge', 'techstack.json');
  if (!existsSync(configPath)) {
    return undefined;
  }

  try {
    const config = await readJson<{
      backend: string;
      frontend: string;
      database: string;
      infrastructure: string[];
    }>(configPath);
    return {
      backend: config.backend,
      frontend: config.frontend,
      database: config.database,
      infrastructure: Array.isArray(config.infrastructure) ? config.infrastructure : []
    };
  } catch {
    return undefined;
  }
}

async function saveTechStack(basePath: string, stack: TechStack): Promise<void> {
  await writeJson(join(basePath, '.webforge', 'techstack.json'), {
    ...stack,
    updatedAt: new Date().toISOString()
  });
}

function resolveTemplate(
  requestedTemplate: string | undefined,
  detectedProjectType: string | undefined
): string {
  if (!requestedTemplate || requestedTemplate === 'auto') {
    return detectedProjectType || 'web';
  }
  return requestedTemplate;
}

async function analyzeKnowledgeBase(
  basePath: string,
  knowledgeEntries: WorkspaceKnowledgeIndexEntry[]
): Promise<KnowledgeAnalysis> {
  const documents: string[] = [];
  const contents: Record<string, string> = {};
  const keywords: string[] = [];
  const techStack: string[] = [];

  if (knowledgeEntries.length === 0) {
    return { documents: [], contents: {}, keywords: [], techStack: [] };
  }

  const parsedEntries = new Map(
    knowledgeEntries
      .filter((entry) => entry.type === 'parsed')
      .map((entry) => [entry.path, entry])
  );

  const sourceEntries = knowledgeEntries.filter((entry) => entry.type !== 'parsed');
  const sourceBasenameCounts = new Map<string, number>();

  for (const entry of sourceEntries) {
    const basename = getKnowledgeBasename(
      entry.path.replace(/^\.webforge\/knowledge\//, '')
    );
    sourceBasenameCounts.set(basename, (sourceBasenameCounts.get(basename) || 0) + 1);
  }

  const matchedParsedPaths = new Set<string>();

  for (const entry of sourceEntries) {
    const documentId = entry.path.replace(/^\.webforge\/knowledge\//, '');
    const fallbackCandidates = getParsedCandidatePaths(
      documentId,
      sourceBasenameCounts
    );
    const fallback = resolveParsedFallback(
      documentId,
      parsedEntries,
      sourceBasenameCounts
    );
    const content = await readKnowledgeContent(
      basePath,
      entry,
      fallback
    );

    if (fallback) {
      for (const candidate of fallbackCandidates) {
        if (candidate && parsedEntries.has(candidate)) {
          matchedParsedPaths.add(candidate);
        }
      }
    }

    documents.push(documentId);
    contents[documentId] = content;
    extractKeywordsFromFilename(documentId.toLowerCase(), keywords);
    if (content) {
      extractTechStackFromContent(content, techStack);
    }
  }

  for (const entry of knowledgeEntries) {
    if (
      entry.type === 'parsed' &&
      !matchedParsedPaths.has(entry.path)
    ) {
      const documentId = entry.path.replace(/^\.webforge\/knowledge\//, '');
      const content = await readKnowledgeContent(basePath, entry);

      documents.push(documentId);
      contents[documentId] = content;
      extractKeywordsFromFilename(documentId.toLowerCase(), keywords);
      if (content) {
        extractTechStackFromContent(content, techStack);
      }
    }
  }

  const allText = [...documents, ...Object.values(contents)].join(' ').toLowerCase();
  let projectType = 'web';

  if (
    allText.includes('小程序') ||
    allText.includes('移动端') ||
    allText.includes('mobile app')
  ) {
    projectType = 'mobile';
  } else if (
    allText.includes('后台') ||
    allText.includes('管理后台') ||
    allText.includes('admin')
  ) {
    projectType = 'backend';
  } else if (
    allText.includes('全栈') ||
    allText.includes('fullstack') ||
    (allText.includes('前端') && allText.includes('后端'))
  ) {
    projectType = 'web';
  }

  return {
    documents,
    contents,
    projectType,
    keywords: [...new Set(keywords)],
    techStack: [...new Set(techStack)]
  };
}

async function readKnowledgeContent(
  basePath: string,
  entry: WorkspaceKnowledgeIndexEntry,
  parsedFallback?: WorkspaceKnowledgeIndexEntry
): Promise<string> {
  const ext = extname(entry.path).toLowerCase();
  const readableDirectly = entry.type === 'parsed' || ext === '.md' || ext === '.txt';

  if (readableDirectly) {
    return readTextFile(join(basePath, entry.path));
  }

  if (parsedFallback) {
    return readTextFile(join(basePath, parsedFallback.path));
  }

  return '';
}

async function readTextFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

function buildParsedFallbackPath(relativeKnowledgePath: string): string {
  const ext = extname(relativeKnowledgePath);
  const extSuffix = ext ? `--${ext.replace(/^\./, '')}` : '';
  return `.webforge/knowledge/parsed/${getKnowledgeStem(relativeKnowledgePath).replace(/[\/]/g, '--')}${extSuffix}.md`;
}

function buildLegacyParsedFallbackPath(relativeKnowledgePath: string): string {
  return `.webforge/knowledge/parsed/${getKnowledgeBasename(relativeKnowledgePath)}.md`;
}

function buildV1ParsedFallbackPath(relativeKnowledgePath: string): string {
  return `.webforge/knowledge/parsed/${getKnowledgeStem(relativeKnowledgePath).replace(/[\/]/g, '--')}.md`;
}

function getKnowledgeStem(relativeKnowledgePath: string): string {
  const ext = extname(relativeKnowledgePath);
  return ext
    ? relativeKnowledgePath.slice(0, -ext.length)
    : relativeKnowledgePath;
}

function getKnowledgeBasename(relativeKnowledgePath: string): string {
  return getKnowledgeStem(relativeKnowledgePath).split('/').pop() || '';
}

function resolveParsedFallback(
  relativeKnowledgePath: string,
  parsedEntries: Map<string, WorkspaceKnowledgeIndexEntry>,
  sourceBasenameCounts: Map<string, number>
): WorkspaceKnowledgeIndexEntry | undefined {
  for (const candidate of getParsedCandidatePaths(
    relativeKnowledgePath,
    sourceBasenameCounts
  )) {
    const match = parsedEntries.get(candidate);
    if (match) {
      return match;
    }
  }

  return undefined;
}

function getParsedCandidatePaths(
  relativeKnowledgePath: string,
  sourceBasenameCounts: Map<string, number>
): string[] {
  const basename = getKnowledgeBasename(relativeKnowledgePath);
  const candidates = [
    buildParsedFallbackPath(relativeKnowledgePath),
    buildV1ParsedFallbackPath(relativeKnowledgePath)
  ];

  if (
    (sourceBasenameCounts.get(basename) || 0) === 1
  ) {
    candidates.push(buildLegacyParsedFallbackPath(relativeKnowledgePath));
  }

  return candidates;
}

function extractKeywordsFromFilename(filename: string, keywords: string[]): void {
  const keywordMap: Record<string, string[]> = {
    '物业': ['物业'],
    '绩效': ['绩效', '考核'],
    '管理': ['管理系统'],
    '用户': ['用户系统', '用户管理'],
    '订单': ['订单系统'],
    '支付': ['支付系统'],
    '库存': ['库存管理'],
    '财务': ['财务系统'],
    '人事': ['人事管理', 'hr'],
    '工单': ['工单系统'],
    '审批': ['审批流程'],
    '报表': ['数据报表', '统计'],
    '小程序': ['小程序', '微信小程序'],
    '移动端': ['移动端', 'app'],
    '后台': ['后台系统', '管理后台']
  };

  for (const [key, values] of Object.entries(keywordMap)) {
    if (filename.includes(key)) {
      keywords.push(...values);
    }
  }
}

function extractTechStackFromContent(content: string, techStack: string[]): void {
  const techPatterns: Record<string, string[]> = {
    Vue: ['vue', 'vue3', 'vue.js', 'pinia', 'vuex'],
    React: ['react', 'react.js', 'next.js', 'redux'],
    Angular: ['angular'],
    TypeScript: ['typescript', 'ts'],
    Go: ['golang', 'go语言', 'gin框架'],
    'Node.js': ['node.js', 'nodejs', 'express', 'koa'],
    Python: ['python', 'django', 'flask', 'fastapi'],
    Java: ['java', 'spring', 'springboot'],
    PostgreSQL: ['postgresql', 'postgres'],
    MySQL: ['mysql'],
    MongoDB: ['mongodb'],
    Redis: ['redis'],
    Docker: ['docker', '容器化'],
    Kubernetes: ['kubernetes', 'k8s'],
    AWS: ['aws', 'amazon web services'],
    阿里云: ['阿里云', 'aliyun']
  };

  const lowerContent = content.toLowerCase();
  for (const [tech, patterns] of Object.entries(techPatterns)) {
    if (patterns.some((pattern) => lowerContent.includes(pattern))) {
      techStack.push(tech);
    }
  }
}

function detectRequiredSkills(analysis: KnowledgeAnalysis): string[] {
  const skillScores = new Map<string, number>();
  const allText = [
    ...analysis.documents,
    ...Object.values(analysis.contents),
    ...analysis.keywords,
    ...analysis.techStack
  ]
    .join(' ')
    .toLowerCase();

  for (const [skillId, skillInfo] of Object.entries(AVAILABLE_SKILLS)) {
    let score = 0;

    for (const pattern of skillInfo.patterns) {
      const patternLower = pattern.toLowerCase();
      const regex = new RegExp(`\\b${escapeRegExp(patternLower)}\\b`, 'g');
      const matches = allText.match(regex);
      if (matches) {
        score += matches.length * 2;
      } else if (allText.includes(patternLower)) {
        score += 1;
      }
    }

    if (score > 0) {
      skillScores.set(skillId, score + skillInfo.priority);
    }
  }

  if (analysis.projectType === 'web') {
    if (!skillScores.has('frontend-design')) {
      skillScores.set('frontend-design', 5);
    }
    if (!skillScores.has('backend-patterns')) {
      skillScores.set('backend-patterns', 5);
    }
  } else if (analysis.projectType === 'mobile') {
    if (!skillScores.has('frontend-design')) {
      skillScores.set('frontend-design', 5);
    }
  } else if (analysis.projectType === 'backend') {
    if (!skillScores.has('backend-patterns')) {
      skillScores.set('backend-patterns', 8);
    }
  }

  for (const tech of analysis.techStack) {
    const techLower = tech.toLowerCase();
    if (techLower.includes('vue') && !skillScores.has('vue-best-practices')) {
      skillScores.set('vue-best-practices', 10);
    }
    if (techLower === 'go' && !skillScores.has('golang-patterns')) {
      skillScores.set('golang-patterns', 10);
    }
    if (techLower.includes('postgres') && !skillScores.has('postgres-patterns')) {
      skillScores.set('postgres-patterns', 10);
    }
  }

  if (allText.includes('test') || allText.includes('测试') || skillScores.size > 0) {
    skillScores.set('tdd-workflow', Math.max(skillScores.get('tdd-workflow') || 0, 7));
  }

  return Array.from(skillScores.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([skill]) => skill);
}

function inferTechStackFromAnalysis(analysis: { techStack: string[] }): TechStack {
  const techStack: TechStack = {
    backend: 'nodejs-nestjs',
    frontend: 'vue3',
    database: 'postgresql',
    infrastructure: ['docker']
  };

  if (analysis.techStack.some((item) => item.toLowerCase().includes('go'))) {
    techStack.backend = 'go-gin';
  } else if (analysis.techStack.some((item) => item.toLowerCase().includes('java'))) {
    techStack.backend = 'java-spring';
  } else if (analysis.techStack.some((item) => item.toLowerCase().includes('python'))) {
    techStack.backend = 'python-fastapi';
  }

  if (analysis.techStack.some((item) => item.toLowerCase().includes('react'))) {
    techStack.frontend = 'react';
  } else if (analysis.techStack.some((item) => item.toLowerCase().includes('angular'))) {
    techStack.frontend = 'angular';
  }

  if (analysis.techStack.some((item) => item.toLowerCase().includes('mysql'))) {
    techStack.database = 'mysql';
  } else if (analysis.techStack.some((item) => item.toLowerCase().includes('mongo'))) {
    techStack.database = 'mongodb';
  } else if (analysis.techStack.some((item) => item.toLowerCase().includes('redis'))) {
    techStack.database = 'postgres-redis';
  }

  if (
    analysis.techStack.some(
      (item) =>
        item.toLowerCase().includes('k8s') ||
        item.toLowerCase().includes('kubernetes')
    )
  ) {
    techStack.infrastructure = ['docker-k8s'];
  }

  if (analysis.techStack.some((item) => item.toLowerCase().includes('aliyun') || item.includes('阿里云'))) {
    techStack.infrastructure.push('aliyun');
  } else if (analysis.techStack.some((item) => item.toLowerCase().includes('aws'))) {
    techStack.infrastructure.push('aws');
  }

  return techStack;
}

function generatePhases(template: string): Phase[] {
  const now = new Date().toISOString();
  const basePhases = [
    { id: 'P1', name: '需求分析', depends_on: [] as string[] },
    { id: 'P2', name: '架构设计', depends_on: ['P1'] },
    { id: 'P3', name: '后端开发', depends_on: ['P2'] },
    { id: 'P4', name: '前端开发', depends_on: ['P2'] },
    { id: 'P5', name: '集成测试', depends_on: ['P3', 'P4'] },
    { id: 'P6', name: '部署上线', depends_on: ['P5'] }
  ];

  if (template === 'mobile') {
    basePhases[3].name = '移动端开发';
  } else if (template === 'backend') {
    basePhases.splice(3, 1);
    const testingPhase = basePhases.find((phase) => phase.id === 'P5');
    if (testingPhase) {
      testingPhase.depends_on = ['P3'];
    }
  }

  return basePhases.map((phase, index) => ({
    id: phase.id,
    name: phase.name,
    status: index === 0 ? 'in_progress' : 'pending',
    progress: 0,
    depends_on: phase.depends_on,
    created_at: now,
    updated_at: now
  }));
}

function generateSmartTasks(
  phases: Phase[],
  template: string,
  analysis: { keywords: string[]; techStack: string[] },
  requiredSkills: string[],
  options: { superpowers?: boolean; execution?: 'subagent' | 'inline' },
  selectedTechStack?: TechStack
): Task[] {
  const tasks: Task[] = [];
  let taskCounter = 1;

  const features = {
    hasAuth: analysis.keywords.some((keyword) =>
      ['用户', '登录', '权限', 'auth', 'authentication'].includes(keyword)
    ),
    hasPayment:
      analysis.keywords.includes('支付') || analysis.keywords.includes('payment'),
    hasData: analysis.keywords.some((keyword) =>
      ['绩效', '数据', '报表', 'data', 'report'].includes(keyword)
    ),
    hasUI: analysis.keywords.some((keyword) =>
      ['ui', '界面', '设计', '前端', 'frontend'].includes(keyword)
    ),
    hasVue: analysis.techStack.some((item) => item.toLowerCase().includes('vue')),
    hasReact: analysis.techStack.some((item) => item.toLowerCase().includes('react')),
    hasGo: analysis.techStack.some((item) => item.toLowerCase().includes('go')),
    hasPostgres: analysis.techStack.some((item) =>
      item.toLowerCase().includes('postgres')
    )
  };

  for (const phase of phases) {
    const phaseTasks = createSmartPhaseTasks(
      phase,
      taskCounter,
      template,
      features,
      requiredSkills,
      options,
      selectedTechStack
    );
    tasks.push(...phaseTasks);
    taskCounter += phaseTasks.length;
  }

  return tasks;
}

function createSmartPhaseTasks(
  phase: Phase,
  startCounter: number,
  template: string,
  features: {
    hasAuth: boolean;
    hasPayment: boolean;
    hasData: boolean;
    hasUI: boolean;
    hasVue: boolean;
    hasReact: boolean;
    hasGo: boolean;
    hasPostgres: boolean;
  },
  requiredSkills: string[],
  options: { superpowers?: boolean; execution?: 'subagent' | 'inline' },
  techStack?: TechStack
): Task[] {
  const tasks: Task[] = [];
  const now = new Date().toISOString();
  const backendSkill = techStack?.backend.includes('go')
    ? 'golang-patterns'
    : 'backend-patterns';
  const frontendSkill = techStack?.frontend.includes('vue')
    ? 'vue-best-practices'
    : 'frontend-design';
  const dbSkill = techStack?.database.includes('postgres') ? 'postgres-patterns' : '';

  const taskDefs: Record<
    string,
    Array<{ title: string; assignee: string; priority: number; skills?: string[] }>
  > = {
    P1: [
      { title: '需求梳理与确认', assignee: 'pm', priority: 1 },
      { title: '用户故事编写', assignee: 'pm', priority: 2 },
      { title: '功能清单整理', assignee: 'pm', priority: 2 }
    ],
    P2: [
      { title: '系统架构设计', assignee: 'tech-lead', priority: 1, skills: [backendSkill] },
      { title: '数据库设计', assignee: 'backend', priority: 1, skills: dbSkill ? [dbSkill] : [] },
      { title: 'API 接口设计', assignee: 'backend', priority: 2, skills: [backendSkill] },
      { title: 'UI/UX 设计', assignee: 'frontend', priority: 2, skills: [frontendSkill] }
    ],
    P3: [
      { title: '项目初始化与环境搭建', assignee: 'backend', priority: 1 },
      { title: '核心业务接口开发', assignee: 'backend', priority: 1, skills: [backendSkill] },
      { title: '数据模型实现', assignee: 'backend', priority: 1, skills: dbSkill ? [dbSkill] : [] }
    ],
    P4: [
      { title: '前端项目搭建', assignee: 'frontend', priority: 1, skills: [frontendSkill] },
      { title: '页面组件开发', assignee: 'frontend', priority: 1, skills: [frontendSkill] },
      { title: 'API 对接集成', assignee: 'frontend', priority: 2, skills: [frontendSkill, backendSkill] }
    ],
    P5: [
      { title: '单元测试编写', assignee: 'qa', priority: 1, skills: ['tdd-workflow'] },
      { title: '接口测试', assignee: 'qa', priority: 2, skills: ['tdd-workflow'] },
      { title: '端到端测试', assignee: 'qa', priority: 2, skills: ['tdd-workflow'] },
      { title: 'Bug 修复', assignee: 'backend', priority: 1 }
    ],
    P6: [
      { title: '生产环境部署', assignee: 'devops', priority: 1 },
      { title: '监控配置', assignee: 'devops', priority: 2 },
      { title: '文档交付', assignee: 'pm', priority: 2 }
    ]
  };

  if (features.hasAuth && phase.id === 'P3') {
    taskDefs[phase.id].push(
      { title: '用户认证系统开发', assignee: 'backend', priority: 1, skills: [backendSkill, 'security-review'] },
      { title: '权限管理实现', assignee: 'backend', priority: 2, skills: [backendSkill] }
    );
  }

  if (features.hasData && phase.id === 'P3') {
    taskDefs[phase.id].push(
      {
        title: '数据统计接口开发',
        assignee: 'backend',
        priority: 2,
        skills: [backendSkill, dbSkill].filter(Boolean)
      },
      { title: '报表导出功能', assignee: 'backend', priority: 3, skills: [backendSkill, 'xlsx'] }
    );
  }

  if (features.hasPayment && phase.id === 'P3') {
    taskDefs[phase.id].push(
      { title: '支付接口对接', assignee: 'backend', priority: 1, skills: [backendSkill] },
      {
        title: '订单系统开发',
        assignee: 'backend',
        priority: 1,
        skills: [backendSkill, dbSkill].filter(Boolean)
      }
    );
  }

  if (options.superpowers && phase.id === 'P2') {
    taskDefs[phase.id].unshift({
      title: 'Superpowers Skills 配置',
      assignee: 'tech-lead',
      priority: 1,
      skills: requiredSkills
    });
  }

  const defs = [...(taskDefs[phase.id] || [{ title: `${phase.name} - 通用任务`, assignee: 'backend', priority: 2 }])];
  defs.sort((left, right) => left.priority - right.priority);

  for (let index = 0; index < defs.length; index += 1) {
    const def = defs[index];
    const taskId = `T${String(startCounter + index).padStart(3, '0')}`;
    const dependsOn =
      index > 0 ? [`T${String(startCounter + index - 1).padStart(3, '0')}`] : [];
    const hasPhaseDeps = phase.depends_on.length > 0;
    const status = dependsOn.length === 0 && !hasPhaseDeps ? 'ready' : 'pending';
    const metadata: Record<string, unknown> = {};

    if (options.superpowers) {
      metadata.superpowers = true;
      metadata.execution = options.execution;
      if (def.skills && def.skills.length > 0) {
        metadata.skills = def.skills;
      }
    }

    tasks.push({
      id: taskId,
      phase: phase.id,
      title: def.title,
      description: template === 'mobile' && phase.id === 'P4' ? '移动端实现任务' : '',
      status,
      assignee: def.assignee,
      depends_on: dependsOn,
      priority: def.priority,
      created_at: now,
      updated_at: now,
      ...(Object.keys(metadata).length > 0 ? { metadata } : {})
    });
  }

  return tasks;
}

async function generateSuperpowersPlan(
  basePath: string,
  phases: Phase[],
  tasks: Task[],
  analysis: Pick<KnowledgeAnalysis, 'documents' | 'contents'>,
  requiredSkills: string[],
  options: { execution?: 'subagent' | 'inline' },
  techStack?: TechStack
): Promise<string> {
  const planDir = join(basePath, 'docs', 'superpowers', 'plans');
  await ensureDir(planDir);

  const timestamp = new Date().toISOString().split('T')[0];
  const planFile = join(planDir, `${timestamp}-implementation-plan.md`);
  const prdSummary =
    analysis.documents.length > 0
      ? analysis.documents.map((document) => `- ${document}`).join('\n')
      : '使用默认模板生成';
  const planContent = generatePlanMarkdown(
    phases,
    tasks,
    requiredSkills,
    options,
    prdSummary,
    techStack
  );

  await writeText(planFile, planContent);
  await writeJson(
    join(basePath, '.webforge', 'superpowers.json'),
    buildSuperpowersRegistry({
      required: requiredSkills,
      optional: [],
      execution: options.execution ?? null,
      ...(techStack ? { techStack: techStack as unknown as Record<string, unknown> } : {})
    })
  );

  return planFile;
}

function generatePlanMarkdown(
  phases: Phase[],
  tasks: Task[],
  requiredSkills: string[],
  options: { execution?: 'subagent' | 'inline' },
  prdSummary: string,
  techStack?: TechStack
): string {
  const executionMode =
    options.execution === 'subagent'
      ? 'superpowers:subagent-driven-development (推荐)'
      : 'superpowers:executing-plans';
  const techStackSection = techStack
    ? `
## 技术栈

### 后端
${getTechStackName('backend', techStack.backend)}

### 前端
${getTechStackName('frontend', techStack.frontend)}

### 数据库
${getTechStackName('database', techStack.database)}

### 基础设施
${techStack.infrastructure
  .map((item) => `- ${getTechStackName('infrastructure', item)}`)
  .join('\n')}

---

`
    : '';

  return `# WebForge 项目实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use ${executionMode} to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** 基于需求文档完成 Web 项目的开发与交付

**Architecture:** 采用多 Agent 协作模式，PM/Frontend/Backend/QA/DevOps 各司其职，通过任务系统协调工作。

**Tech Stack:** ${techStack ? `${getTechStackName('backend', techStack.backend)} + ${getTechStackName('frontend', techStack.frontend)} + ${getTechStackName('database', techStack.database)}` : 'TypeScript, Node.js, CLI Framework, Vitest'}

**Required Skills:** ${requiredSkills.map((skill) => `@${skill}`).join(', ')}

${techStackSection}## PRD 文档

${prdSummary}

---

## 阶段规划

| 阶段 | 名称 | 任务数 | 状态 |
|------|------|--------|------|
${phases
  .map((phase) => {
    const taskCount = tasks.filter((task) => task.phase === phase.id).length;
    return `| ${phase.id} | ${phase.name} | ${taskCount} | ${phase.status} |`;
  })
  .join('\n')}

---

## 任务详情

${phases
  .map((phase) => {
    const phaseTasks = tasks.filter((task) => task.phase === phase.id);
    return `### ${phase.id}: ${phase.name}

${phaseTasks
  .map(
    (task) => `
#### ${task.id}: ${task.title}

**Assignee:** ${task.assignee}  
**Priority:** ${task.priority}  
**Depends on:** ${task.depends_on.join(', ') || 'None'}  
**Required Skills:** ${((task.metadata?.skills as string[] | undefined) || []).map((skill) => `@${skill}`).join(', ') || 'N/A'}

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: \`npm test\`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员
`
  )
  .join('')}`;
  })
  .join('\n---\n')}

---

## Execution Guidelines

### Subagent-Driven Mode (Recommended)

1. 每个任务由一个独立的 subagent 执行
2. 任务完成后进行审查
3. 审查通过后更新任务状态
4. 继续下一个任务

### Skills Usage

执行任务时，根据任务内容选择合适的 skills:

${requiredSkills
  .map(
    (skill) =>
      `- **@${skill}**: ${AVAILABLE_SKILLS[skill]?.description || 'Use when applicable'}`
  )
  .join('\n')}

### Task State Transitions

\`\`\`
pending → ready → in_progress → completed
   ↑         ↓         ↓
   └──── blocked ←────┘
\`\`\`

---

## Generated

- **Date:** ${new Date().toISOString()}
- **Execution Mode:** ${options.execution}
- **Total Tasks:** ${tasks.length}
- **Total Phases:** ${phases.length}
`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
