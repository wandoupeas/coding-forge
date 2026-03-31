import { buildRuntimeReadModel } from '../../read-models/runtime.js';
import type { UiHttpContext, UiJsonResponse } from './projects.js';
import { getReadableProjectById, toProjectLookupErrorResponse } from './projects.js';

export async function handleProjectRuntimeRequest(
  context: UiHttpContext,
  projectId: string
): Promise<UiJsonResponse> {
  const project = await getReadableProjectById(context, projectId);
  if ('error' in project) {
    return toProjectLookupErrorResponse(project);
  }

  const runtime = await buildRuntimeReadModel(project.rootPath);

  return {
    status: 200,
    body: {
      project,
      data: runtime
    }
  };
}
