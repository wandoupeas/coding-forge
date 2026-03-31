import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Mailbox } from '../../core/mailbox.js';
import { createWorkspace } from '../../core/workspace.js';
import { writeJson } from '../../utils/file.js';
import { buildArtifactsReadModel } from '../../ui/read-models/artifacts.js';
import { buildProjectOverview } from '../../ui/read-models/overview.js';
import { buildRecoveryReadModel } from '../../ui/read-models/recovery.js';
import { buildRuntimeReadModel } from '../../ui/read-models/runtime.js';
import { buildTasksReadModel } from '../../ui/read-models/tasks.js';

describe('ui read models', () => {
  let workspaceDir = '';

  afterEach(async () => {
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('builds recovery summaries with context drift and thread linkage states', async () => {
    workspaceDir = await seedUiWorkspace();

    const recovery = await buildRecoveryReadModel(workspaceDir);

    expect(recovery.contextDrift.status).toBeDefined();
    expect(recovery.threadLinkage.status).toBeDefined();
    expect(recovery.doctor.summary.fail).toBeGreaterThan(0);
    expect(recovery.status).toBe('blocked');
    expect(recovery.onboard.shouldRead).toContain('.webforge/runtime.json');
  });

  it('builds overview and task counts from workspace state', async () => {
    workspaceDir = await seedUiWorkspace();

    const [overview, tasks] = await Promise.all([
      buildProjectOverview(workspaceDir),
      buildTasksReadModel(workspaceDir)
    ]);

    expect(overview.project.name).toBe('ui-monitor-demo');
    expect(overview.tasks.ready).toBe(1);
    expect(overview.tasks.blocked).toBe(1);
    expect(overview.tasks.pendingReview).toBe(1);
    expect(tasks.ready.map((task) => task.id)).toEqual(['T001']);
    expect(tasks.blocked.map((task) => task.id)).toEqual(['T002']);
    expect(tasks.pendingReview.map((task) => task.id)).toEqual(['T001']);
  });

  it('builds artifact and runtime summaries with their key sections', async () => {
    workspaceDir = await seedUiWorkspace();

    const [artifacts, runtime] = await Promise.all([
      buildArtifactsReadModel(workspaceDir),
      buildRuntimeReadModel(workspaceDir)
    ]);

    expect(artifacts.knowledge.total).toBe(1);
    expect(artifacts.deliverables.pendingReview).toBe(1);
    expect(artifacts.sessions.total).toBe(1);
    expect(runtime.runtime.status).toBe('idle');
    expect(runtime.mailboxes.total).toBe(1);
    expect(runtime.mailboxes.unreadMessages).toBe(1);
    expect(runtime.checkpoints.total).toBe(0);
    expect(runtime.superpowers.totalRuns).toBe(0);
  });
});

async function seedUiWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'webforge-ui-read-models-'));
  const workspace = await createWorkspace(root, { projectName: 'ui-monitor-demo' });

  await writeJson(workspace.paths.tasks, {
    tasks: [
      {
        id: 'T001',
        phase: 'P1',
        title: 'Assemble dashboard',
        status: 'ready',
        assignee: 'frontend',
        depends_on: [],
        priority: 1,
        created_at: '2026-03-31T00:00:00.000Z',
        updated_at: '2026-03-31T00:10:00.000Z'
      },
      {
        id: 'T002',
        phase: 'P1',
        title: 'Check runtime alerts',
        status: 'blocked',
        assignee: 'pm',
        depends_on: ['T001'],
        blocked_by: ['T001'],
        priority: 2,
        created_at: '2026-03-31T00:00:00.000Z',
        updated_at: '2026-03-31T00:20:00.000Z'
      }
    ]
  });

  await writeJson(workspace.paths.knowledgeIndex, [
    {
      id: 'know-001',
      type: 'requirement',
      title: 'Web UI PRD',
      path: '.webforge/knowledge/requirements/prd.md',
      createdAt: '2026-03-31T00:00:00.000Z',
      updatedAt: '2026-03-31T00:15:00.000Z'
    }
  ]);
  await writeFile(join(root, '.webforge/knowledge/requirements/prd.md'), '# Web UI\n', 'utf-8');

  await writeJson(workspace.paths.deliverablesIndex, {
    items: [
      {
        id: 'del-001',
        taskId: 'T001',
        type: 'design',
        title: 'Project dashboard draft',
        path: '.webforge/deliverables/del-001.md',
        createdBy: 'frontend',
        createdAt: '2026-03-31T00:30:00.000Z',
        status: 'pending_review'
      }
    ]
  });
  await writeFile(join(root, '.webforge/deliverables/del-001.md'), '# Draft\n', 'utf-8');

  await writeJson(workspace.paths.sessionsIndex, {
    sessions: [
      {
        id: 'sess-001',
        name: 'ui-planning',
        createdAt: '2026-03-31T00:00:00.000Z',
        lastActive: '2026-03-31T00:40:00.000Z',
        status: 'active',
        currentPhase: 'P1',
        currentTask: 'T001',
        context: 'continue dashboard',
        stats: {
          tasksCompleted: 0,
          totalTasks: 2
        }
      }
    ]
  });

  const mailbox = new Mailbox('reviewer', root);
  await mailbox.init();
  await new Mailbox('frontend', root).send('reviewer', 'notification', 'new draft available', {
    taskId: 'T001'
  });

  return root;
}
