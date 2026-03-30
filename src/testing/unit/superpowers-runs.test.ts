import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getLatestSuperpowersRun,
  inspectSuperpowersRun,
  loadSuperpowersRuns,
  recordSuperpowersRun
} from '../../core/superpowers-runs.js';
import { getThreadLink } from '../../core/threads.js';
import { createWorkspace } from '../../core/workspace.js';

describe('superpowers runs core', () => {
  let workspaceDir = '';

  afterEach(async () => {
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('loads legacy array-based run indexes and exposes the latest run', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-superpowers-runs-'));
    await createWorkspace(workspaceDir, { projectName: 'superpowers-runs' });
    await writeFile(
      join(workspaceDir, '.webforge', 'superpowers-runs.json'),
      JSON.stringify(
        [
          {
            id: 'spr-legacy',
            workflow: 'gsd-thread',
            artifacts: [
              {
                kind: 'thread',
                path: '.webforge/sessions/index.json'
              }
            ],
            metadata: {
              worktreePath: '/tmp/external-worktree'
            }
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    const runs = await loadSuperpowersRuns(workspaceDir);
    const latest = await getLatestSuperpowersRun(workspaceDir);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      id: 'spr-legacy',
      workflow: 'gsd-thread'
    });
    expect(latest?.id).toBe('spr-legacy');
    expect(typeof runs[0]?.recordedAt).toBe('string');
    expect(runs[0]?.metadata?.worktreePath).toBe('/tmp/external-worktree');
  });

  it('reports missing worktree metadata separately from artifact readiness', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-superpowers-readiness-'));
    await createWorkspace(workspaceDir, { projectName: 'superpowers-readiness' });
    await writeFile(join(workspaceDir, 'note.md'), '# note', 'utf-8');

    const readiness = inspectSuperpowersRun(workspaceDir, {
      id: 'spr-readiness',
      workflow: 'subagent-driven-development',
      recordedAt: '2026-03-30T00:00:00.000Z',
      summary: 'wave execution metadata',
      artifacts: [
        {
          kind: 'note',
          path: 'note.md'
        }
      ],
      metadata: {
        worktreePath: 'missing-worktree'
      }
    });

    expect(readiness.missingArtifacts).toEqual([]);
    expect(readiness.missingWorktreePath).toBe('missing-worktree');
  });

  it('fails fast when a recorded run references a task that does not exist', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-superpowers-missing-task-'));
    await createWorkspace(workspaceDir, { projectName: 'superpowers-missing-task' });
    await writeFile(join(workspaceDir, 'note.md'), '# note', 'utf-8');

    await expect(
      recordSuperpowersRun(workspaceDir, {
        workflow: 'writing-plans',
        summary: 'missing task linkage',
        taskId: 'T404',
        artifacts: [
          {
            kind: 'note',
            path: 'note.md'
          }
        ]
      })
    ).rejects.toThrow('task not found: T404');
  });

  it('creates a thread linkage record when a run carries thread metadata', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-thread-link-'));
    await createWorkspace(workspaceDir, { projectName: 'thread-link' });
    await writeFile(join(workspaceDir, 'note.md'), '# note', 'utf-8');

    const run = await recordSuperpowersRun(workspaceDir, {
      workflow: 'gsd-thread',
      summary: 'linked a persistent thread',
      artifacts: [
        {
          kind: 'thread',
          path: 'note.md'
        }
      ],
      metadata: {
        threadId: 'thread-001',
        branch: 'feature/thread',
        worktreePath: '.worktrees/thread'
      }
    });
    const threadLink = await getThreadLink(workspaceDir, 'thread-001');

    expect(run.metadata?.threadId).toBe('thread-001');
    expect(threadLink).toMatchObject({
      id: 'thread-001',
      workflow: 'gsd-thread',
      runId: run.id,
      branch: 'feature/thread'
    });
    expect(threadLink?.artifacts).toEqual(['note.md']);
  });
});
