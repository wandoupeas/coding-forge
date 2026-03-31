import { constants } from 'fs';
import { access, readdir, stat, readFile } from 'fs/promises';
import { basename, join, resolve } from 'path';
import { createHash } from 'crypto';
import { parse as parseYaml } from 'yaml';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

export interface ProjectRecord {
  id: string;
  name: string;
  rootPath: string;
  workspacePath: string;
  updatedAt: string;
  readable: boolean;
}

type WorkspaceFileStats = {
  exists: boolean;
  readable: boolean;
  mtimeMs: number | null;
};

export async function scanProjects(rootPath: string): Promise<ProjectRecord[]> {
  const normalizedRoot = resolve(rootPath);

  if (!(await isDirectory(normalizedRoot))) {
    return [];
  }

  const projects: ProjectRecord[] = [];
  const rootProject = await inspectProject(normalizedRoot);
  if (rootProject) {
    projects.push(rootProject);
  }

  await walk(normalizedRoot, projects);

  return projects.sort((left, right) => left.rootPath.localeCompare(right.rootPath));
}

async function walk(currentPath: string, projects: ProjectRecord[]): Promise<void> {
  let entries;

  try {
    entries = await readdir(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const childPath = join(currentPath, entry.name);
    const project = await inspectProject(childPath);
    if (project) {
      projects.push(project);
    }

    await walk(childPath, projects);
  }
}

async function inspectProject(rootPath: string): Promise<ProjectRecord | null> {
  const workspacePath = join(rootPath, '.webforge');
  const configPath = join(workspacePath, 'config.yaml');
  const runtimePath = join(workspacePath, 'runtime.json');

  const [config, runtime, workspaceStat, rootStat] = await Promise.all([
    inspectWorkspaceFile(configPath),
    inspectWorkspaceFile(runtimePath),
    statOrNull(workspacePath),
    statOrNull(rootPath)
  ]);

  const hasCandidate = config.exists || runtime.exists;
  if (!hasCandidate) {
    return null;
  }

  const readable = config.readable && runtime.readable;
  const updatedAtSource = Number(
    runtime.mtimeMs ?? config.mtimeMs ?? workspaceStat?.mtimeMs ?? rootStat?.mtimeMs ?? Date.now()
  );

  return {
    id: createHash('sha1').update(rootPath).digest('hex'),
    name: await resolveProjectName(rootPath, configPath, config.readable),
    rootPath,
    workspacePath,
    updatedAt: new Date(updatedAtSource).toISOString(),
    readable
  };
}

async function resolveProjectName(
  rootPath: string,
  configPath: string,
  configReadable: boolean
): Promise<string> {
  if (!configReadable) {
    return basename(rootPath);
  }

  try {
    const config = parseYaml(await readFile(configPath, 'utf-8')) as Record<string, unknown>;
    const project = config.project;
    if (project && typeof project === 'object' && !Array.isArray(project)) {
      const name = (project as Record<string, unknown>).name;
      if (typeof name === 'string' && name.length > 0) {
        return name;
      }
    }
  } catch {
    // Fall back to the directory name when config parsing fails.
  }

  return basename(rootPath);
}

async function inspectWorkspaceFile(path: string): Promise<WorkspaceFileStats> {
  try {
    const fileStat = await stat(path);
    let readable = true;

    try {
      await access(path, constants.R_OK);
    } catch {
      readable = false;
    }

    return {
      exists: true,
      readable,
      mtimeMs: fileStat.mtimeMs
    };
  } catch (error) {
    if (isPermissionError(error)) {
      return {
        exists: true,
        readable: false,
        mtimeMs: null
      };
    }

    return {
      exists: false,
      readable: true,
      mtimeMs: null
    };
  }
}

async function statOrNull(path: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  const pathStat = await statOrNull(path);
  return pathStat?.isDirectory() ?? false;
}

function isPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'EPERM';
}
