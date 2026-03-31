import { buildArtifactsReadModel } from '../../read-models/artifacts.js';
import type { UiHttpContext, UiJsonResponse } from './projects.js';
import { getProjectById } from './projects.js';

export async function handleProjectArtifactsRequest(
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

  const artifacts = await buildArtifactsReadModel(project.rootPath);

  return {
    status: 200,
    body: {
      project,
      data: artifacts
    }
  };
}
