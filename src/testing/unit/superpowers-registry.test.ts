import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace } from '../../core/workspace.js';
import { buildExecutionContext } from '../../core/context.js';
import { buildPlanFromKnowledge } from '../../core/planning.js';

describe('superpowers registry', () => {
  let workspaceDir = '';

  afterEach(async () => {
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('seeds a capability registry when a workspace is created', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-superpowers-registry-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'registry-init' });

    const registry = JSON.parse(
      await readFile(join(state.paths.workspace, 'superpowers.json'), 'utf-8')
    ) as {
      version: string;
      capabilities: Array<{ id: string; owner: string; recommended: boolean }>;
      execution: string | null;
    };

    expect(registry.version).toBe('1');
    expect(registry.execution).toBeNull();
    expect(registry.capabilities.map((capability) => capability.id)).toEqual(
      expect.arrayContaining([
        'brainstorming',
        'writing-plans',
        'subagent-driven-development',
        'executing-plans',
        'using-git-worktrees',
        'strategic-compact',
        'continuous-learning-v2',
        'gsd-thread',
        'gsd-resume-work'
      ])
    );
    expect(registry.capabilities.every((capability) => capability.owner === 'superpowers')).toBe(
      true
    );
    expect(registry.capabilities.some((capability) => capability.recommended)).toBe(false);
  });

  it('marks recommended workflows in the registry and exposes them through execution context', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-superpowers-context-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'registry-context' });

    await writeFile(
      join(state.paths.knowledgeRequirements, 'prd.md'),
      ['# Demo', '', '需要 Vue 3 前端、Node.js API 与 PostgreSQL。'].join('\n'),
      'utf-8'
    );
    await writeFile(
      state.paths.knowledgeIndex,
      JSON.stringify(
        [
          {
            id: 'knowledge-requirements-prd-md',
            type: 'requirement',
            title: 'prd',
            path: '.webforge/knowledge/requirements/prd.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    await buildPlanFromKnowledge(workspaceDir, {
      template: 'auto',
      force: true,
      superpowers: true,
      execution: 'subagent'
    });

    const registry = JSON.parse(
      await readFile(join(state.paths.workspace, 'superpowers.json'), 'utf-8')
    ) as {
      required: string[];
      execution: string | null;
      capabilities: Array<{ id: string; recommended: boolean }>;
    };
    const context = await buildExecutionContext(workspaceDir, 'T001');

    expect(registry.execution).toBe('subagent');
    expect(registry.required).toEqual(expect.arrayContaining(['frontend-design', 'backend-patterns']));
    expect(
      registry.capabilities.find((capability) => capability.id === 'subagent-driven-development')
    ).toMatchObject({ recommended: true });
    expect(
      registry.capabilities.find((capability) => capability.id === 'writing-plans')
    ).toMatchObject({ recommended: true });
    expect(context.superpowers.capabilities.map((capability) => capability.id)).toEqual(
      expect.arrayContaining(['writing-plans', 'subagent-driven-development'])
    );
    expect(
      context.superpowers.capabilities.find(
        (capability) => capability.id === 'subagent-driven-development'
      )
    ).toMatchObject({ recommended: true });
  });
});
