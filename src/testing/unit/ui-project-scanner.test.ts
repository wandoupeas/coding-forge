import { afterEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProjectRegistry } from '../../ui/project-registry.js';
import { scanProjects } from '../../ui/project-scanner.js';

describe('ui project scanner', () => {
  let sandboxDir = '';

  afterEach(async () => {
    if (sandboxDir) {
      await chmodIfPossible(join(sandboxDir, 'apps', 'bravo', '.webforge', 'runtime.json'));
      await rm(sandboxDir, { recursive: true, force: true });
      sandboxDir = '';
    }
  });

  it('finds projects and skips ignored directories', async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-ui-scan-'));

    await writeWorkspace(join(sandboxDir, 'apps', 'alpha'), 'alpha');
    await writeWorkspace(join(sandboxDir, 'node_modules', 'ignored'), 'ignored');
    await writeWorkspace(join(sandboxDir, '.git', 'repo'), 'git-repo');
    await writeWorkspace(join(sandboxDir, 'dist', 'bundle'), 'dist-bundle');
    await writeWorkspace(join(sandboxDir, 'coverage', 'report'), 'coverage-report');

    const projects = await scanProjects(sandboxDir);

    expect(projects.map((project) => project.name)).toEqual(['alpha']);
    expect(projects[0]).toMatchObject({
      id: expect.any(String),
      rootPath: join(sandboxDir, 'apps', 'alpha'),
      workspacePath: join(sandboxDir, 'apps', 'alpha', '.webforge'),
      updatedAt: expect.any(String),
      readable: true
    });
  });

  it('marks unreadable projects as not readable', async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-ui-scan-'));

    const projectRoot = join(sandboxDir, 'apps', 'bravo');
    await mkdir(join(projectRoot, '.webforge'), { recursive: true });
    await writeFile(
      join(projectRoot, '.webforge', 'runtime.json'),
      JSON.stringify({ version: '0.2', updatedAt: '2026-03-31T00:00:00.000Z' }, null, 2),
      'utf-8'
    );
    await chmod(join(projectRoot, '.webforge', 'runtime.json'), 0o000);

    const projects = await scanProjects(sandboxDir);

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      name: 'bravo',
      rootPath: projectRoot,
      workspacePath: join(projectRoot, '.webforge'),
      readable: false
    });
    expect(projects[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('refreshes the current root and updates the cached project list', async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-ui-scan-'));

    const registry = new ProjectRegistry();
    await writeWorkspace(join(sandboxDir, 'apps', 'alpha'), 'alpha');

    const first = await registry.refresh(sandboxDir);
    await writeWorkspace(join(sandboxDir, 'apps', 'beta'), 'beta');
    const second = await registry.refresh(sandboxDir);
    const third = await registry.refresh(join(sandboxDir, 'other-root'));

    expect(first.map((project) => project.name)).toEqual(['alpha']);
    expect(second.map((project) => project.name)).toEqual(['alpha', 'beta']);
    expect(registry.projects.map((project) => project.name)).toEqual([]);
    expect(third.map((project) => project.name)).toEqual([]);
  });
});

async function writeWorkspace(rootPath: string, projectName: string): Promise<void> {
  await mkdir(join(rootPath, '.webforge'), { recursive: true });
  await writeFile(
    join(rootPath, '.webforge', 'config.yaml'),
    `project:\n  name: ${projectName}\n`,
    'utf-8'
  );
  await writeFile(
    join(rootPath, '.webforge', 'runtime.json'),
    JSON.stringify({ version: '0.2', updatedAt: '2026-03-31T00:00:00.000Z' }, null, 2),
    'utf-8'
  );
}

async function chmodIfPossible(path: string): Promise<void> {
  try {
    await chmod(path, 0o644);
  } catch {
    // Best effort cleanup for unreadable files.
  }
}
