export interface ApiProjectRecord {
  id: string;
  name: string;
  rootPath: string;
  workspacePath: string;
  updatedAt: string;
  readable: boolean;
}

export interface ApiProjectOverview {
  project: {
    name: string;
    rootPath: string;
    workspacePath: string;
  };
  runtime: {
    status: string;
    summary: string;
    updatedAt: string;
    currentTaskId: string | null;
    currentPhaseId: string | null;
    latestRuntimeSessionId: string | null;
    latestRuntimeEvent: string | null;
  };
  tasks: {
    total: number;
    pending: number;
    ready: number;
    inProgress: number;
    blocked: number;
    completed: number;
    failed: number;
    pendingReview: number;
  };
  artifacts: {
    knowledgeCount: number;
    deliverablesCount: number;
    pendingReviewCount: number;
    sessionCount: number;
  };
  recovery: {
    canProceed: boolean;
    status: 'ready' | 'blocked';
    doctorSummary: {
      ok: number;
      warn: number;
      fail: number;
    };
    contextDriftStatus: 'none' | 'aligned' | 'drifted';
    threadLinkageStatus: 'none' | 'ready' | 'blocked';
  };
}

export interface ProjectsDashboardSnapshot {
  rootPath: string;
  fetchedAt: string;
  projects: Array<{
    project: ApiProjectRecord;
    overview: ApiProjectOverview | null;
    error: string | null;
  }>;
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

interface ProjectsResponse {
  rootPath: string;
  fetchedAt: string;
  projects: ApiProjectRecord[];
}

interface ProjectOverviewResponse {
  project: ApiProjectRecord;
  data: ApiProjectOverview;
}

export async function fetchProjectsDashboard(): Promise<ProjectsDashboardSnapshot> {
  const payload = await requestJson<ProjectsResponse>('/api/projects');
  const projects = await Promise.all(
    payload.projects.map(async (project) => {
      try {
        const overview = await requestJson<ProjectOverviewResponse>(
          `/api/projects/${encodeURIComponent(project.id)}/overview`
        );

        return {
          project,
          overview: overview.data,
          error: null
        };
      } catch (error) {
        return {
          project,
          overview: null,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );

  return {
    rootPath: payload.rootPath,
    fetchedAt: payload.fetchedAt,
    projects
  };
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      accept: 'application/json'
    }
  });
  const payload = (await response.json()) as T & ApiErrorPayload;

  if (!response.ok) {
    const errorMessage = payload?.error?.message ?? `Request failed: ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload;
}
