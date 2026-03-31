import { buildTasksReadModel } from '../../read-models/tasks.js';
import type { UiHttpContext, UiJsonResponse } from './projects.js';
import { getReadableProjectById, toProjectLookupErrorResponse } from './projects.js';

export async function handleProjectTasksRequest(
  context: UiHttpContext,
  projectId: string
): Promise<UiJsonResponse> {
  const project = await getReadableProjectById(context, projectId);
  if ('error' in project) {
    return toProjectLookupErrorResponse(project);
  }

  const tasks = await buildTasksReadModel(project.rootPath);

  return {
    status: 200,
    body: {
      project,
      data: tasks
    }
  };
}
