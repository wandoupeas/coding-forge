import { buildProjectOverview } from '../../read-models/overview.js';
import type { UiHttpContext, UiJsonResponse } from './projects.js';
import { getProjectById } from './projects.js';

export async function handleProjectOverviewRequest(
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

  const overview = await buildProjectOverview(project.rootPath);

  return {
    status: 200,
    body: {
      project,
      data: overview
    }
  };
}
