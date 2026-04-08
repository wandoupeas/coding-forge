import { Server, type IncomingMessage, type ServerResponse } from 'http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Mailbox } from '../../core/mailbox.js';
import { createWorkspace } from '../../core/workspace.js';
import { writeJson } from '../../utils/file.js';
import { routeUiRequest } from '../../ui/http/router.js';
import { createUiHttpServer, startUiHttpServer } from '../../ui/http/server.js';

describe('ui http', () => {
  let workspaceDir = '';
  let server: Awaited<ReturnType<typeof createUiHttpServer>> | null = null;
  let startedServer: Awaited<ReturnType<typeof startUiHttpServer>> | null = null;

  afterEach(async () => {
    if (startedServer) {
      await startedServer.close();
      startedServer = null;
    } else if (server) {
      await new Promise<void>((resolve) => {
        server?.server.close(() => resolve());
      });
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

    const [projects, overview, tasks, runtime, artifacts, recovery] = await Promise.all([
      routeUiRequest('GET', '/api/projects', {
        rootPath: workspaceDir,
        registry: server.registry
      }),
      routeUiRequest('GET', `/api/projects/${projectId}/overview`, {
        rootPath: workspaceDir,
        registry: server.registry
      }),
      routeUiRequest('GET', `/api/projects/${projectId}/tasks`, {
        rootPath: workspaceDir,
        registry: server.registry
      }),
      routeUiRequest('GET', `/api/projects/${projectId}/runtime`, {
        rootPath: workspaceDir,
        registry: server.registry
      }),
      routeUiRequest('GET', `/api/projects/${projectId}/artifacts`, {
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

    expect(tasks.status).toBe(200);
    expect(tasks.body.data.counts.ready).toBe(1);
    expect(tasks.body.data.blocked).toHaveLength(1);
    expect(tasks.body.data.pendingReview).toHaveLength(1);

    expect(runtime.status).toBe(200);
    expect(runtime.body.project.name).toBe('ui-http-demo');
    expect(runtime.body.data.runtime.status).toBe('idle');
    expect(runtime.body.data.mailboxes.total).toBe(1);
    expect(runtime.body.data.superpowers.totalRuns).toBe(0);

    expect(artifacts.status).toBe(200);
    expect(artifacts.body.project.name).toBe('ui-http-demo');
    expect(artifacts.body.data.knowledge.total).toBe(1);
    expect(artifacts.body.data.deliverables.pendingReview).toBe(1);
    expect(artifacts.body.data.sessions.total).toBe(1);
    expect(artifacts.body.data.knowledge.items[0].preview).toContain('# Web UI');
    expect(artifacts.body.data.deliverables.items[0].preview).toContain('# Draft');
    expect(artifacts.body.data.sessions.items[0].preview).toContain('"sess-001"');

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

  it('returns a structured workspace_unreadable error for incomplete projects', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-ui-http-'));
    const projectRoot = join(workspaceDir, 'tmp', 'test-clean');
    await mkdir(join(projectRoot, '.webforge'), { recursive: true });
    await writeFile(
      join(projectRoot, '.webforge', 'config.yaml'),
      'project:\n  name: test-clean\n',
      'utf-8'
    );

    server = await createUiHttpServer({ rootPath: workspaceDir });

    const projectId = server.registry.projects[0]?.id;
    expect(projectId).toBeDefined();

    const [projects, overview] = await Promise.all([
      routeUiRequest('GET', '/api/projects', {
        rootPath: workspaceDir,
        registry: server.registry
      }),
      routeUiRequest('GET', `/api/projects/${projectId}/overview`, {
        rootPath: workspaceDir,
        registry: server.registry
      })
    ]);

    expect(projects.status).toBe(200);
    expect(projects.body.projects).toHaveLength(1);
    expect(projects.body.projects[0]).toMatchObject({
      name: 'test-clean',
      readable: false
    });

    expect(overview.status).toBe(409);
    expect(overview.body).toMatchObject({
      error: {
        code: 'workspace_unreadable',
        message: 'Workspace is incomplete or unreadable',
        details: {
          projectId,
          rootPath: projectRoot,
          workspacePath: join(projectRoot, '.webforge')
        }
      }
    });
  });

  it('returns structured errors for unsupported methods and unknown routes', async () => {
    workspaceDir = await seedUiWorkspace();
    server = await createUiHttpServer({ rootPath: workspaceDir });

    const projectId = server.registry.projects[0]?.id;
    expect(projectId).toBeDefined();

    const [methodNotAllowed, unknownRoute, missingSection] = await Promise.all([
      routeUiRequest('POST', '/api/projects', {
        rootPath: workspaceDir,
        registry: server.registry
      }),
      routeUiRequest('GET', '/api/unknown', {
        rootPath: workspaceDir,
        registry: server.registry
      }),
      routeUiRequest('GET', `/api/projects/${projectId}`, {
        rootPath: workspaceDir,
        registry: server.registry
      })
    ]);

    expect(methodNotAllowed).toMatchObject({
      status: 405,
      body: {
        error: {
          code: 'method_not_allowed',
          details: {
            method: 'POST'
          }
        }
      }
    });

    expect(unknownRoute).toMatchObject({
      status: 404,
      body: {
        error: {
          code: 'route_not_found',
          details: {
            pathname: '/api/unknown'
          }
        }
      }
    });

    expect(missingSection).toMatchObject({
      status: 404,
      body: {
        error: {
          code: 'route_not_found',
          details: {
            pathname: `/api/projects/${projectId}`
          }
        }
      }
    });
  });

  it('serves api responses, static assets, and spa fallbacks through the request listener', async () => {
    workspaceDir = await seedUiWorkspace();
    const staticRoot = join(workspaceDir, 'dist-ui');
    await mkdir(join(staticRoot, 'assets'), { recursive: true });
    await writeFile(
      join(staticRoot, 'index.html'),
      '<!doctype html><html><body>ui-http-demo shell</body></html>',
      'utf-8'
    );
    await writeFile(join(staticRoot, 'assets', 'app.js'), 'console.log("app");', 'utf-8');
    await writeFile(join(staticRoot, 'assets', 'app.css'), 'body { color: black; }', 'utf-8');
    await writeFile(join(staticRoot, 'assets', 'manifest.json'), '{"name":"demo"}', 'utf-8');
    await writeFile(join(staticRoot, 'assets', 'logo.svg'), '<svg></svg>', 'utf-8');
    await writeFile(join(staticRoot, 'assets', 'pixel.png'), Buffer.from([137, 80, 78, 71]));
    await writeFile(join(staticRoot, 'assets', 'favicon.ico'), Buffer.from([0, 0, 1, 0]));
    await writeFile(join(staticRoot, 'assets', 'data.bin'), Buffer.from([1, 2, 3]));

    server = await createUiHttpServer({ rootPath: workspaceDir, staticRoot });

    const apiResponse = await dispatchHttpRequest(server.server, 'GET', '/api/projects');
    expect(apiResponse.statusCode).toBe(200);
    expect(apiResponse.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(apiResponse.headers['cache-control']).toBe('no-store');
    const apiPayload = JSON.parse(apiResponse.body) as { projects: Array<{ name: string }> };
    expect(apiPayload.projects[0]?.name).toBe('ui-http-demo');

    const assets = [
      ['/assets/app.js', 'application/javascript; charset=utf-8'],
      ['/assets/app.css', 'text/css; charset=utf-8'],
      ['/assets/manifest.json', 'application/json; charset=utf-8'],
      ['/assets/logo.svg', 'image/svg+xml'],
      ['/assets/pixel.png', 'image/png'],
      ['/assets/favicon.ico', 'image/x-icon'],
      ['/assets/data.bin', 'application/octet-stream']
    ] as const;

    for (const [pathname, contentType] of assets) {
      const response = await dispatchHttpRequest(server.server, 'GET', pathname);
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe(contentType);
      expect(response.headers['cache-control']).toBe('public, max-age=60');
    }

    const spaFallback = await dispatchHttpRequest(server.server, 'GET', '/projects/detail');
    expect(spaFallback.statusCode).toBe(200);
    expect(spaFallback.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(spaFallback.headers['cache-control']).toBe('no-store');
    expect(spaFallback.body).toContain('ui-http-demo shell');
  });

  it('returns ui_bundle_missing when the static bundle is absent', async () => {
    workspaceDir = await seedUiWorkspace();
    server = await createUiHttpServer({
      rootPath: workspaceDir,
      staticRoot: join(workspaceDir, 'missing-ui')
    });

    const response = await dispatchHttpRequest(server.server, 'GET', '/');
    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    const payload = JSON.parse(response.body) as {
      error: { code: string; message: string; details: { staticRoot: string } };
    };
    expect(payload).toMatchObject({
      error: {
        code: 'ui_bundle_missing',
        message: 'UI bundle not found',
        details: {
          staticRoot: join(workspaceDir, 'missing-ui')
        }
      }
    });
  });

  it('derives bound server metadata when listen/address succeed', async () => {
    workspaceDir = await seedUiWorkspace();

    const listenSpy = vi
      .spyOn(Server.prototype, 'listen')
      .mockImplementation(function mockListen(...args: unknown[]) {
        const callback = args.find((value) => typeof value === 'function') as (() => void) | undefined;
        callback?.();
        return this;
      });
    const addressSpy = vi.spyOn(Server.prototype, 'address').mockReturnValue({
      address: '127.0.0.1',
      family: 'IPv4',
      port: 4815
    });
    const closeSpy = vi
      .spyOn(Server.prototype, 'close')
      .mockImplementation(function mockClose(callback?: (error?: Error | undefined) => void) {
        callback?.();
        return this;
      });

    startedServer = await startUiHttpServer({
      rootPath: workspaceDir,
      host: '127.0.0.1',
      port: 0
    });

    expect(listenSpy).toHaveBeenCalled();
    expect(addressSpy).toHaveBeenCalled();
    expect(startedServer).toMatchObject({
      host: '127.0.0.1',
      port: 4815,
      url: 'http://127.0.0.1:4815'
    });

    await startedServer.close();
    startedServer = null;
    expect(closeSpy).toHaveBeenCalled();
  });
});

async function dispatchHttpRequest(
  httpServer: Server,
  method: string,
  url: string
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  const headers: Record<string, string> = {};
  let body = '';
  let statusCode = 200;

  const done = new Promise<void>((resolve) => {
    const response = {
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      end(chunk?: string | Buffer) {
        body = typeof chunk === 'string' ? chunk : chunk?.toString('utf-8') ?? '';
        resolve();
      },
      get statusCode() {
        return statusCode;
      },
      set statusCode(value: number) {
        statusCode = value;
      }
    } as unknown as ServerResponse;

    httpServer.emit(
      'request',
      {
        method,
        url
      } as IncomingMessage,
      response
    );
  });

  await done;

  return {
    statusCode,
    headers,
    body
  };
}

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
  await writeJson(join(root, '.webforge/sessions/sess-001.json'), {
    id: 'sess-001',
    name: 'ui-planning',
    currentTask: 'T001',
    notes: ['continue dashboard']
  });

  const mailbox = new Mailbox('reviewer', root);
  await mailbox.init();
  await new Mailbox('frontend', root).send('reviewer', 'notification', 'new draft available', {
    taskId: 'T001'
  });

  return root;
}
