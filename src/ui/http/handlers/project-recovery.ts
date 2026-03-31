import { buildRecoveryReadModel } from '../../read-models/recovery.js';
import type { UiHttpContext, UiJsonResponse } from './projects.js';
import { getProjectById } from './projects.js';

export async function handleProjectRecoveryRequest(
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

  const recovery = await buildRecoveryReadModel(project.rootPath);

  return {
    status: 200,
    body: {
      project,
      data: recovery
    }
  };
}
