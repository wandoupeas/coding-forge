import { buildArtifactsReadModel } from '../../read-models/artifacts.js';
import type { UiHttpContext, UiJsonResponse } from './projects.js';
import { getReadableProjectById, toProjectLookupErrorResponse } from './projects.js';

export async function handleProjectArtifactsRequest(
  context: UiHttpContext,
  projectId: string
): Promise<UiJsonResponse> {
  const project = await getReadableProjectById(context, projectId);
  if ('error' in project) {
    return toProjectLookupErrorResponse(project);
  }

  const artifacts = await buildArtifactsReadModel(project.rootPath);

  return {
    status: 200,
    body: {
      project,
      data: artifacts
    }
  };
}
