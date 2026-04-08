/**
 * Workspace v0.2 合约测试
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace, loadWorkspaceState } from '../../core/workspace.js';

describe('workspace v0.2', () => {
  let workspaceDir = '';

  afterEach(async () => {
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('creates the v0.2 workspace contract on disk', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-'));

    const state = await createWorkspace(workspaceDir, { projectName: 'demo' });

    expect(state.runtime.version).toBe('0.2');
    expect(state.runtime.status).toBe('idle');
    expect(state.runtime.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(state.paths.runtime).toContain('.webforge/runtime.json');
    expect(state.paths.sessionsIndex).toContain('.webforge/sessions/index.json');
    expect(state.paths.threadsIndex).toContain('.webforge/threads.json');
    expect(state.paths.deliverablesIndex).toContain('.webforge/deliverables/index.json');
    expect(state.paths.knowledgeIndex).toContain('.webforge/knowledge/index.json');

    expect(state.indexes.sessions).toHaveLength(1);
    expect(state.indexes.sessions[0]).toMatchObject({
      id: 'session-demo-001',
      name: '初始会话',
      status: 'active',
      contextSummary: 'Workspace 初始化完成',
      nextAction: '开始第一个任务',
      stats: {
        tasksCompleted: 0,
        totalTasks: 0
      }
    });
    expect(state.indexes.threads).toEqual([]);
    expect(state.indexes.deliverables).toEqual([]);
    expect(state.indexes.knowledge).toEqual([]);

    const knowledgeIndex = JSON.parse(await readFile(state.paths.knowledgeIndex, 'utf-8')) as unknown[];
    const deliverablesIndex = JSON.parse(await readFile(state.paths.deliverablesIndex, 'utf-8')) as {
      items: unknown[];
    };
    const sessionsIndex = JSON.parse(await readFile(state.paths.sessionsIndex, 'utf-8')) as {
      sessions: Array<Record<string, unknown>>;
    };

    expect(knowledgeIndex).toEqual([]);
    expect(deliverablesIndex.items).toEqual([]);
    expect(sessionsIndex.sessions).toHaveLength(1);
    expect(sessionsIndex.sessions[0]).toMatchObject({
      id: 'session-demo-001',
      name: '初始会话',
      status: 'active'
    });

    const runtime = JSON.parse(await readFile(state.paths.runtime, 'utf-8')) as {
      version: string;
      status: string;
      updatedAt: string;
    };

    expect(runtime.version).toBe('0.2');
    expect(runtime.status).toBe('idle');
    expect(runtime.updatedAt).toBe(state.runtime.updatedAt);
  });

  it('loads workspace state from disk', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-'));

    await createWorkspace(workspaceDir, { projectName: 'demo' });
    const state = await loadWorkspaceState(workspaceDir);

    expect(state.runtime.version).toBe('0.2');
    expect(state.runtime.status).toBe('idle');
    expect(state.indexes.sessions).toHaveLength(1);
    expect(state.indexes.sessions[0]).toMatchObject({
      id: 'session-demo-001',
      name: '初始会话',
      status: 'active'
    });
    expect(state.indexes.threads).toEqual([]);
    expect(state.indexes.deliverables).toEqual([]);
    expect(state.indexes.knowledge).toEqual([]);
  });

  it('accepts wrapped deliverable and session indexes from state services', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-'));

    const state = await createWorkspace(workspaceDir, { projectName: 'demo' });
    await writeFile(
      state.paths.deliverablesIndex,
      JSON.stringify(
        {
          items: [
            {
              id: 'del-001',
              taskId: 'T001',
              type: 'document',
              title: 'Architecture',
              path: '.webforge/deliverables/del-001.md',
              createdBy: 'pm',
              createdAt: '2026-03-30T00:00:00.000Z',
              status: 'approved'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      state.paths.sessionsIndex,
      JSON.stringify(
        {
          sessions: [
            {
              id: 'sess-001',
              name: 'planning',
              createdAt: '2026-03-30T00:00:00.000Z',
              lastActive: '2026-03-30T01:00:00.000Z',
              status: 'active',
              currentPhase: 'P1',
              currentTask: 'T001',
              context: 'continue task',
              stats: {
                tasksCompleted: 0,
                totalTasks: 1
              }
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    const loaded = await loadWorkspaceState(workspaceDir);
    expect(loaded.indexes.deliverables).toHaveLength(1);
    expect(loaded.indexes.sessions).toHaveLength(1);
  });

  it('refuses to re-initialize an existing workspace without rewriting files', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-'));

    const state = await createWorkspace(workspaceDir, { projectName: 'demo' });
    const tasksSnapshot = JSON.stringify({ tasks: [{ id: 'T999', title: 'keep me' }] });
    await writeFile(state.paths.tasks, tasksSnapshot, 'utf-8');

    await expect(
      createWorkspace(workspaceDir, { projectName: 'demo' })
    ).rejects.toThrow(/Workspace already exists/);

    await expect(readFile(state.paths.tasks, 'utf-8')).resolves.toBe(tasksSnapshot);
  });

  it('surfaces malformed workspace json instead of falling back to empty state', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-'));

    const state = await createWorkspace(workspaceDir, { projectName: 'demo' });
    await writeFile(state.paths.knowledgeIndex, '{not valid json', 'utf-8');

    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow();
  });

  it('rejects invalid workspace index shapes', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-'));

    const state = await createWorkspace(workspaceDir, { projectName: 'demo' });
    await writeFile(state.paths.sessionsIndex, '{}', 'utf-8');

    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(
      /sessions\/index\.json must be an array/
    );
  });

  it('rejects invalid workspace graph shapes', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-'));

    const state = await createWorkspace(workspaceDir, { projectName: 'demo' });
    await writeFile(state.paths.tasks, JSON.stringify({ tasks: {} }), 'utf-8');

    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(
      /tasks\.json must contain a tasks array/
    );
  });
});
