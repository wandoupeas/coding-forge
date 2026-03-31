import type { ProjectRecord } from '../../project-scanner.js';
import type { ProjectRegistry } from '../../project-registry.js';

export interface UiHttpContext {
  rootPath: string;
  registry: ProjectRegistry;
}

export interface UiJsonResponse {
  status: number;
  body: unknown;
}

export interface UiProjectNotFoundError {
  error: {
    code: 'project_not_found';
    message: string;
    details: {
      projectId: string;
      availableProjectIds: string[];
    };
  };
}

export interface UiWorkspaceUnreadableError {
  error: {
    code: 'workspace_unreadable';
    message: string;
    details: {
      projectId: string;
      rootPath: string;
      workspacePath: string;
      readable: boolean;
    };
  };
}

export type UiProjectLookupError = UiProjectNotFoundError | UiWorkspaceUnreadableError;

export async function handleProjectsRequest(context: UiHttpContext): Promise<UiJsonResponse> {
  const projects = await context.registry.refresh(context.rootPath);

  return {
    status: 200,
    body: {
      rootPath: context.rootPath,
      fetchedAt: new Date().toISOString(),
      projects
    }
  };
}

export async function getProjectById(
  context: UiHttpContext,
  projectId: string
): Promise<ProjectRecord | UiProjectNotFoundError> {
  const projects = await context.registry.refresh(context.rootPath);
  const project = projects.find((item) => item.id === projectId);

  if (!project) {
    return {
      error: {
        code: 'project_not_found',
        message: 'Project not found',
        details: {
          projectId,
          availableProjectIds: projects.map((item) => item.id)
        }
      }
    };
  }

  return project;
}

export async function getReadableProjectById(
  context: UiHttpContext,
  projectId: string
): Promise<ProjectRecord | UiProjectLookupError> {
  const project = await getProjectById(context, projectId);
  if ('error' in project) {
    return project;
  }

  if (project.readable) {
    return project;
  }

  return {
    error: {
      code: 'workspace_unreadable',
      message: 'Workspace is incomplete or unreadable',
      details: {
        projectId,
        rootPath: project.rootPath,
        workspacePath: project.workspacePath,
        readable: project.readable
      }
    }
  };
}

export function toProjectLookupErrorResponse(error: UiProjectLookupError): UiJsonResponse {
  return {
    status: error.error.code === 'project_not_found' ? 404 : 409,
    body: error
  };
}
