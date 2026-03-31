import { buildProjectOverview } from '../../read-models/overview.js';
import type { UiHttpContext, UiJsonResponse } from './projects.js';
import { getReadableProjectById, toProjectLookupErrorResponse } from './projects.js';

export async function handleProjectOverviewRequest(
  context: UiHttpContext,
  projectId: string
): Promise<UiJsonResponse> {
  const project = await getReadableProjectById(context, projectId);
  if ('error' in project) {
    return toProjectLookupErrorResponse(project);
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
