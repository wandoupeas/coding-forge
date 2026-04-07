import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace } from '../../core/workspace.js';
import { createKnowledgeCommand } from '../../cli/commands/knowledge.js';

describe('knowledge command', () => {
  let workspaceDir = '';

  afterEach(async () => {
    vi.restoreAllMocks();

    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('refreshes parsed output when batch parse is rerun after the source changes', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-knowledge-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'knowledge-refresh' });
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceDir);

    const sourcePath = join(state.paths.knowledgeRequirements, 'spec.md');
    const parsedPath = join(state.paths.knowledgeParsed, 'requirements--spec--md.md');

    await writeFile(sourcePath, '# spec\n\nversion one', 'utf-8');
    await createKnowledgeCommand().parseAsync(['node', 'knowledge', 'parse']);

    await writeFile(sourcePath, '# spec\n\nversion two', 'utf-8');
    await createKnowledgeCommand().parseAsync(['node', 'knowledge', 'parse']);

    await expect(readFile(parsedPath, 'utf-8')).resolves.toContain('version two');
  });

  it('creates single-file custom output without polluting the workspace knowledge index', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-knowledge-output-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'knowledge-output' });
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceDir);

    const sourcePath = join(state.paths.knowledgeRequirements, 'spec.md');
    const customOutputDir = join(workspaceDir, '.tmp', 'exports');
    const outputPath = join(customOutputDir, 'requirements--spec--md.md');

    await writeFile(sourcePath, '# spec\n\ncustom export', 'utf-8');
    await createKnowledgeCommand().parseAsync([
      'node',
      'knowledge',
      'parse',
      sourcePath,
      '--output',
      customOutputDir
    ]);

    await expect(readFile(outputPath, 'utf-8')).resolves.toContain('custom export');
    await expect(readFile(state.paths.knowledgeIndex, 'utf-8')).resolves.toBe('[]');
  });

  it('treats normalized parsed output paths as managed workspace output', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-knowledge-managed-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'knowledge-managed' });
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceDir);

    const sourcePath = join(state.paths.knowledgeRequirements, 'spec.md');
    await writeFile(sourcePath, '# spec\n\nmanaged output', 'utf-8');

    await createKnowledgeCommand().parseAsync([
      'node',
      'knowledge',
      'parse',
      sourcePath,
      '--output',
      '.webforge/knowledge/parsed/'
    ]);

    const index = JSON.parse(await readFile(state.paths.knowledgeIndex, 'utf-8')) as Array<{
      path: string;
    }>;
    expect(index.some((entry) => entry.path === '.webforge/knowledge/parsed/requirements--spec--md.md')).toBe(true);
  });

  it('does not reparse the parsed category into duplicate artifacts', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-knowledge-parsed-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'knowledge-parsed' });
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceDir);

    const parsedPath = join(state.paths.knowledgeParsed, 'spec.md');
    await writeFile(parsedPath, '# parsed\n\ncontent', 'utf-8');

    await createKnowledgeCommand().parseAsync([
      'node',
      'knowledge',
      'parse',
      '--category',
      'parsed'
    ]);

    await expect(readFile(parsedPath, 'utf-8')).resolves.toContain('content');
    await expect(
      readFile(join(state.paths.knowledgeParsed, 'parsed--spec.md'), 'utf-8')
    ).rejects.toThrow();
  });

  it('falls back invalid add categories to raw so the file remains indexable', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-knowledge-add-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'knowledge-add' });
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceDir);

    const sourceFile = join(workspaceDir, 'outside.md');
    await writeFile(sourceFile, '# outside\n\ncontent', 'utf-8');

    await createKnowledgeCommand().parseAsync([
      'node',
      'knowledge',
      'add',
      sourceFile,
      '--category',
      'other'
    ]);

    await expect(
      readFile(join(state.paths.knowledge, 'raw', 'outside.md'), 'utf-8')
    ).resolves.toContain('content');

    const index = JSON.parse(await readFile(state.paths.knowledgeIndex, 'utf-8')) as Array<{
      path: string;
    }>;
    expect(index.some((entry) => entry.path === '.webforge/knowledge/raw/outside.md')).toBe(true);
  });

  it('rebuilds a corrupted knowledge index via the reindex command', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-knowledge-reindex-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'knowledge-reindex' });
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceDir);

    await writeFile(join(state.paths.knowledgeDesign, 'frontend-guidelines.md'), '# frontend', 'utf-8');
    await writeFile(state.paths.knowledgeIndex, '{broken json', 'utf-8');

    await createKnowledgeCommand().parseAsync(['node', 'knowledge', 'reindex']);

    const index = JSON.parse(await readFile(state.paths.knowledgeIndex, 'utf-8')) as Array<{
      path: string;
      type: string;
    }>;

    expect(index.some((entry) => entry.path === '.webforge/knowledge/design/frontend-guidelines.md')).toBe(true);
    expect(index.some((entry) => entry.type === 'design')).toBe(true);
  });
});
