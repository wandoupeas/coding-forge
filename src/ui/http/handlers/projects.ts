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

export async function handleProjectsRequest(context: UiHttpContext): Promise<UiJsonResponse> {
  const projects = await context.registry.refresh(context.rootPath);

  return {
    status: 200,
    body: {
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
