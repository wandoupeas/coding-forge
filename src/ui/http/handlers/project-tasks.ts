import { buildTasksReadModel } from '../../read-models/tasks.js';
import type { UiHttpContext, UiJsonResponse } from './projects.js';
import { getProjectById } from './projects.js';

export async function handleProjectTasksRequest(
  context: UiHttpContext,
  projectId: string
): Promise<UiJsonResponse> {
  const project = await getProjectById(context, projectId);
  if ('error' in project) {
    return {
      status: 404,
      body: project
    };
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
