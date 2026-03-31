import type { IncomingMessage, ServerResponse } from 'http';
import { handleProjectsRequest } from './handlers/projects.js';
import { handleProjectOverviewRequest } from './handlers/project-overview.js';
import { handleProjectTasksRequest } from './handlers/project-tasks.js';
import { handleProjectArtifactsRequest } from './handlers/project-artifacts.js';
import { handleProjectRuntimeRequest } from './handlers/project-runtime.js';
import { handleProjectRecoveryRequest } from './handlers/project-recovery.js';
import type { UiHttpContext, UiJsonResponse } from './handlers/projects.js';

export function createUiRequestListener(context: UiHttpContext) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const method = request.method ?? 'GET';
    const pathname = getPathname(request.url);

    const result = await routeUiRequest(method, pathname, context);
    writeUiResponse(response, result);
  };
}

export async function routeUiRequest(
  method: string,
  pathname: string,
  context: UiHttpContext
): Promise<UiJsonResponse> {
  if (method !== 'GET') {
    return methodNotAllowed(method);
  }

  if (pathname === '/api/projects') {
    return handleProjectsRequest(context);
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)(?:\/([^/]+))?$/);
  if (!projectMatch) {
    return notFound('route_not_found', 'Route not found', {
      pathname
    });
  }

  const projectId = decodeURIComponent(projectMatch[1]);
  const section = projectMatch[2];

  if (section === 'overview') {
    return handleProjectOverviewRequest(context, projectId);
  }

  if (section === 'tasks') {
    return handleProjectTasksRequest(context, projectId);
  }

  if (section === 'artifacts') {
    return handleProjectArtifactsRequest(context, projectId);
  }

  if (section === 'runtime') {
    return handleProjectRuntimeRequest(context, projectId);
  }

  if (section === 'recovery') {
    return handleProjectRecoveryRequest(context, projectId);
  }

  return notFound('route_not_found', 'Route not found', {
    pathname
  });
}

function getPathname(url: string | undefined): string {
  if (!url) {
    return '/';
  }

  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

function writeUiResponse(response: ServerResponse, result: UiJsonResponse): void {
  response.statusCode = result.status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(result.body));
}

function methodNotAllowed(method: string): UiJsonResponse {
  return notFound('method_not_allowed', 'Method not allowed', { method }, 405);
}

function notFound(
  code: string,
  message: string,
  details: Record<string, unknown>,
  status = 404
): UiJsonResponse {
  return {
    status,
    body: {
      error: {
        code,
        message,
        details
      }
    }
  };
}
