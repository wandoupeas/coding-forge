import { buildRecoveryReadModel } from '../../read-models/recovery.js';
import type { UiHttpContext, UiJsonResponse } from './projects.js';
import { getReadableProjectById, toProjectLookupErrorResponse } from './projects.js';

export async function handleProjectRecoveryRequest(
  context: UiHttpContext,
  projectId: string
): Promise<UiJsonResponse> {
  const project = await getReadableProjectById(context, projectId);
  if ('error' in project) {
    return toProjectLookupErrorResponse(project);
  }

  const recovery = await buildRecoveryReadModel(project.rootPath);

  return {
    status: 200,
    body: {
      project,
      data: recovery
    }
  };
}
