import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace, loadWorkspaceState } from '../../core/workspace.js';
import { planCommand } from '../../cli/commands/plan.js';

describe('plan command adapter', () => {
  let workspaceDir = '';

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-plan-ui-'));
    await createWorkspace(workspaceDir, { projectName: 'plan-ui' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('renders default-planning guidance when no knowledge docs exist', async () => {
    await planCommand(
      {
        template: 'auto',
        superpowers: false,
        interactive: 'false'
      },
      workspaceDir
    );

    const workspace = await loadWorkspaceState(workspaceDir);
    expect(workspace.tasks.tasks.length).toBeGreaterThan(0);
    expect(readOutput()).toContain('没有找到需求文档');
  });

  it('renders knowledge-driven summary and superpowers guidance', async () => {
    const workspace = await loadWorkspaceState(workspaceDir);
    const requirementPath = join(
      workspaceDir,
      '.webforge',
      'knowledge',
      'requirements',
      'prd.md'
    );
    await writeFile(
      requirementPath,
      '# Property Performance System\n\nVue frontend with Node.js backend and PostgreSQL.',
      'utf-8'
    );
    await writeFile(
      workspace.paths.knowledgeIndex,
      JSON.stringify(
        [
          {
            id: 'req-001',
            type: 'requirement',
            title: 'PRD',
            path: '.webforge/knowledge/requirements/prd.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z',
            tags: ['prd']
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    await planCommand(
      {
        template: 'auto',
        superpowers: true,
        execution: 'inline',
        interactive: 'false',
        force: true
      },
      workspaceDir
    );

    const output = readOutput();
    expect(output).toContain('发现 1 个知识文档');
    expect(output).toContain('Superpowers 执行指引');
    expect(output).toContain('执行模式: Inline Execution');
  });
});

function readOutput(): string {
  return vi.mocked(console.log).mock.calls.flat().map(String).join('\n');
}
