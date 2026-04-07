import { existsSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { basename, extname, join, relative } from 'path';
import type { WorkspaceKnowledgeIndexEntry } from '../types/index.js';
import { ensureDir, readJson, writeJson } from '../utils/file.js';

export const MANAGED_KNOWLEDGE_CATEGORIES = [
  'requirements',
  'design',
  'data',
  'decisions',
  'raw',
  'parsed'
] as const;

export type KnowledgeCategory = (typeof MANAGED_KNOWLEDGE_CATEGORIES)[number];

const KNOWLEDGE_INDEX_PATH = '.webforge/knowledge/index.json';
const KNOWN_WRAPPER_KEYS = ['documents', 'items', 'entries'];

export interface KnowledgeStructureReport {
  rootFiles: string[];
  unknownDirectories: string[];
}

export async function rebuildKnowledgeIndex(
  basePath: string
): Promise<WorkspaceKnowledgeIndexEntry[]> {
  const knowledgeDir = join(basePath, '.webforge', 'knowledge');
  const indexPath = join(basePath, KNOWLEDGE_INDEX_PATH);
  const entries: WorkspaceKnowledgeIndexEntry[] = [];

  await ensureDir(knowledgeDir);

  for (const category of MANAGED_KNOWLEDGE_CATEGORIES) {
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
  return entries;
}

export async function loadKnowledgeIndex(
  basePath: string,
  options: { repairIfInvalid?: boolean } = {}
): Promise<WorkspaceKnowledgeIndexEntry[]> {
  const indexPath = join(basePath, KNOWLEDGE_INDEX_PATH);

  if (!existsSync(indexPath)) {
    return [];
  }

  try {
    const parsed = await readJson<unknown>(indexPath);
    return normalizeKnowledgeIndexPayload(parsed);
  } catch (error) {
    if (options.repairIfInvalid) {
      return rebuildKnowledgeIndex(basePath);
    }
    throw error;
  }
}

export async function repairKnowledgeIndexIfNeeded(
  basePath: string
): Promise<boolean> {
  const indexPath = join(basePath, KNOWLEDGE_INDEX_PATH);

  if (!existsSync(indexPath)) {
    await rebuildKnowledgeIndex(basePath);
    return true;
  }

  try {
    const parsed = await readJson<unknown>(indexPath);
    normalizeKnowledgeIndexPayload(parsed);
    return false;
  } catch {
    await rebuildKnowledgeIndex(basePath);
    return true;
  }
}

export async function inspectKnowledgeStructure(
  basePath: string
): Promise<KnowledgeStructureReport> {
  const knowledgeDir = join(basePath, '.webforge', 'knowledge');
  const report: KnowledgeStructureReport = {
    rootFiles: [],
    unknownDirectories: []
  };

  if (!existsSync(knowledgeDir)) {
    return report;
  }

  const entries = await readdir(knowledgeDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name !== 'index.json') {
      report.rootFiles.push(entry.name);
      continue;
    }

    if (entry.isDirectory() && !MANAGED_KNOWLEDGE_CATEGORIES.includes(entry.name as KnowledgeCategory)) {
      report.unknownDirectories.push(entry.name);
    }
  }

  report.rootFiles.sort();
  report.unknownDirectories.sort();
  return report;
}

export function createKnowledgeEntryId(relativePath: string): string {
  return `knowledge-${relativePath.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`;
}

export function mapKnowledgeType(category: KnowledgeCategory): WorkspaceKnowledgeIndexEntry['type'] {
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

export function isManagedKnowledgeCategory(category: string): category is KnowledgeCategory {
  return MANAGED_KNOWLEDGE_CATEGORIES.includes(category as KnowledgeCategory);
}

function normalizeKnowledgeIndexPayload(
  value: unknown
): WorkspaceKnowledgeIndexEntry[] {
  if (Array.isArray(value)) {
    return value as WorkspaceKnowledgeIndexEntry[];
  }

  if (value && typeof value === 'object') {
    for (const key of KNOWN_WRAPPER_KEYS) {
      if (Array.isArray((value as Record<string, unknown>)[key])) {
        return (value as Record<string, WorkspaceKnowledgeIndexEntry[]>)[key];
      }
    }
  }

  throw new Error('knowledge/index.json must be an array');
}
