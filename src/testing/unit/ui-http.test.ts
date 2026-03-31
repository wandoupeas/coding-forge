import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Mailbox } from '../../core/mailbox.js';
import { createWorkspace } from '../../core/workspace.js';
import { writeJson } from '../../utils/file.js';
import { routeUiRequest } from '../../ui/http/router.js';
import { createUiHttpServer } from '../../ui/http/server.js';

describe('ui http', () => {
  let workspaceDir = '';
  let server: Awaited<ReturnType<typeof createUiHttpServer>> | null = null;

  afterEach(async () => {
    if (server) {
      server.server.close();
      server = null;
    }

    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('serves overview, runtime and recovery data for a project', async () => {
    workspaceDir = await seedUiWorkspace();
    server = await createUiHttpServer({ rootPath: workspaceDir });

    const projectId = server.registry.projects[0]?.id;
    expect(projectId).toBeDefined();

    const [projects, overview, runtime, recovery] = await Promise.all([
      routeUiRequest('GET', '/api/projects', {
        rootPath: workspaceDir,
        registry: server.registry
      }),
      routeUiRequest('GET', `/api/projects/${projectId}/overview`, {
        rootPath: workspaceDir,
        registry: server.registry
      }),
      routeUiRequest('GET', `/api/projects/${projectId}/runtime`, {
        rootPath: workspaceDir,
        registry: server.registry
      }),
      routeUiRequest('GET', `/api/projects/${projectId}/recovery`, {
        rootPath: workspaceDir,
        registry: server.registry
      })
    ]);

    expect(projects.status).toBe(200);
    expect(projects.body.rootPath).toBe(workspaceDir);
    expect(projects.body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(projects.body.projects).toHaveLength(1);
    expect(projects.body.projects[0].id).toBe(projectId);

    expect(overview.status).toBe(200);
    expect(overview.body.project.name).toBe('ui-http-demo');
    expect(overview.body.data.tasks.ready).toBe(1);
    expect(overview.body.data.artifacts.pendingReviewCount).toBe(1);

    expect(runtime.status).toBe(200);
    expect(runtime.body.project.name).toBe('ui-http-demo');
    expect(runtime.body.data.runtime.status).toBe('idle');
    expect(runtime.body.data.mailboxes.total).toBe(1);
    expect(runtime.body.data.superpowers.totalRuns).toBe(0);

    expect(recovery.status).toBe(200);
    expect(recovery.body.project.name).toBe('ui-http-demo');
    expect(recovery.body.data.doctor.summary).toBeDefined();
    expect(recovery.body.data.status).toMatch(/ready|blocked/);
  });

  it('returns a structured project_not_found error', async () => {
    workspaceDir = await seedUiWorkspace();
    server = await createUiHttpServer({ rootPath: workspaceDir });

    const response = await routeUiRequest('GET', '/api/projects/missing-project/runtime', {
      rootPath: workspaceDir,
      registry: server.registry
    });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: 'project_not_found',
        message: 'Project not found',
        details: {
          projectId: 'missing-project'
        }
      }
    });
    expect(response.body.error.details.availableProjectIds).toHaveLength(1);
  });
});

async function seedUiWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'webforge-ui-http-'));
  const workspace = await createWorkspace(root, { projectName: 'ui-http-demo' });

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
