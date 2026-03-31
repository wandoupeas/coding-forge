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

export interface ApiProjectArtifacts {
  knowledge: {
    total: number;
    byType: Record<string, number>;
    items: Array<{
      id: string;
      type: string;
      title: string;
      path: string;
      updatedAt: string;
      preview: string | null;
    }>;
  };
  deliverables: {
    total: number;
    pendingReview: number;
    byStatus: Record<string, number>;
    items: Array<{
      id: string;
      taskId: string;
      title: string;
      type: string;
      status: string;
      path: string;
      createdAt: string;
      createdBy: string;
      preview: string | null;
    }>;
  };
  sessions: {
    total: number;
    byStatus: Record<string, number>;
    latest: {
      id: string;
      name: string;
      status: string;
      lastActive: string;
      currentTask: string | null;
      currentPhase: string | null;
      preview: string | null;
    } | null;
    items: Array<{
      id: string;
      name: string;
      status: string;
      lastActive: string;
      currentTask: string | null;
      currentPhase: string | null;
      preview: string | null;
    }>;
  };
}

export interface ApiProjectRuntime {
  runtime: {
    status: string;
    summary: string;
    updatedAt: string;
    sessionId: string | null;
    phaseId: string | null;
    taskId: string | null;
  };
  latestObservation: {
    sessionId: string;
    startTime: string;
    endTime: string | null;
    lastEvent: string | null;
    lastTaskId: string | null;
    permissionProfile: string | null;
    completed: number;
    failed: number;
    blocked: number;
    deliverables: number;
    signals?: {
      readyTasks: number;
      blockedTasks: number;
      pendingReview: number;
      unreadMessages: number;
    };
  } | null;
  mailboxes: {
    total: number;
    unreadMessages: number;
    items: Array<{
      workerId: string;
      unreadCount: number;
      mailboxPath: string;
    }>;
  };
  checkpoints: {
    total: number;
    latest: {
      id: string;
      name: string;
      createdAt: string;
    } | null;
    items: Array<{
      id: string;
      name: string;
      createdAt: string;
    }>;
  };
  superpowers: {
    totalRuns: number;
    latestRun: {
      id: string;
      workflow: string;
      summary: string;
      recordedAt: string;
      taskId: string | null;
      sessionId: string | null;
      artifactCount: number;
      readiness: {
        missingArtifacts: string[];
        missingWorktreePath: string | null;
        missingCompactSessionId: string | null;
      };
    } | null;
  };
}

export interface ApiProjectRecovery {
  doctor: {
    summary: {
      ok: number;
      warn: number;
      fail: number;
    };
    guidance: string[];
  };
  resume: {
    nextAction: string;
    shouldRead: string[];
  };
  onboard: {
    recommendedActions: string[];
  };
  runtimeLogs: {
    events: Array<{
      timestamp: string;
      message: string;
      taskId?: string;
      reason?: string;
      permissionProfile?: string;
    }>;
    threadLinkage: {
      status: 'none' | 'ready' | 'blocked';
      threadId: string | null;
      workflow: string | null;
      branch: string | null;
      worktreePath: string | null;
      missingArtifacts: string[];
      missingWorktreePath: string | null;
      missingThreadId: string | null;
    };
    workflowContext: {
      status: 'ready' | 'blocked';
      workflow: string;
      branch: string | null;
      worktreePath: string | null;
      threadId: string | null;
      compactFromSession: string | null;
      missingArtifacts: string[];
      missingWorktreePath: string | null;
      missingCompactSessionId: string | null;
    } | null;
    currentWorkflowContext: {
      status: 'ready' | 'blocked';
      workflow: string;
      branch: string | null;
      worktreePath: string | null;
      threadId: string | null;
      compactFromSession: string | null;
      missingArtifacts: string[];
      missingWorktreePath: string | null;
      missingCompactSessionId: string | null;
    } | null;
    currentThreadLinkage: {
      status: 'none' | 'ready' | 'blocked';
      threadId: string | null;
      workflow: string | null;
      branch: string | null;
      worktreePath: string | null;
      missingArtifacts: string[];
      missingWorktreePath: string | null;
      missingThreadId: string | null;
    };
    contextDrift: {
      status: 'none' | 'aligned' | 'drifted';
      reasons: string[];
    };
  } | null;
  canProceed: boolean;
  status: 'ready' | 'blocked';
  contextDrift: {
    status: 'none' | 'aligned' | 'drifted';
    reasons: string[];
  };
  threadLinkage: {
    status: 'none' | 'ready' | 'blocked';
    threadId: string | null;
    workflow: string | null;
    branch: string | null;
    worktreePath: string | null;
    missingArtifacts: string[];
    missingWorktreePath: string | null;
    missingThreadId: string | null;
  };
  workflowContext: {
    workflow: string;
    branch: string | null;
    worktreePath: string | null;
    threadId: string | null;
    compactFromSession: string | null;
  } | null;
  recommendedActions: string[];
}

export interface ApiProjectTasks {
  counts: {
    total: number;
    pending: number;
    ready: number;
    inProgress: number;
    blocked: number;
    completed: number;
    failed: number;
    pendingReview: number;
  };
  items: Array<{
    id: string;
    phaseId: string;
    title: string;
    description?: string;
    status: string;
    assignee: string;
    priority: number;
    dependsOn: string[];
    blockedBy: string[];
    updatedAt: string;
    workflow: string | null;
  }>;
  ready: Array<{
    id: string;
    title: string;
    assignee: string;
    priority: number;
  }>;
  inProgress: Array<{
    id: string;
    title: string;
    assignee: string;
    priority: number;
  }>;
  blocked: Array<{
    id: string;
    title: string;
    assignee: string;
    priority: number;
    blockedBy: string[];
  }>;
  pendingReview: Array<{
    id: string;
    title: string;
    assignee: string;
    priority: number;
  }>;
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

interface ProjectArtifactsResponse {
  project: ApiProjectRecord;
  data: ApiProjectArtifacts;
}

interface ProjectRuntimeResponse {
  project: ApiProjectRecord;
  data: ApiProjectRuntime;
}

interface ProjectRecoveryResponse {
  project: ApiProjectRecord;
  data: ApiProjectRecovery;
}

interface ProjectTasksResponse {
  project: ApiProjectRecord;
  data: ApiProjectTasks;
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

export async function fetchProjectOverview(projectId: string): Promise<ProjectOverviewResponse> {
  return requestJson<ProjectOverviewResponse>(`/api/projects/${encodeURIComponent(projectId)}/overview`);
}

export async function fetchProjectArtifacts(projectId: string): Promise<ProjectArtifactsResponse> {
  return requestJson<ProjectArtifactsResponse>(`/api/projects/${encodeURIComponent(projectId)}/artifacts`);
}

export async function fetchProjectTasks(projectId: string): Promise<ProjectTasksResponse> {
  return requestJson<ProjectTasksResponse>(`/api/projects/${encodeURIComponent(projectId)}/tasks`);
}

export async function fetchProjectRuntime(projectId: string): Promise<ProjectRuntimeResponse> {
  return requestJson<ProjectRuntimeResponse>(`/api/projects/${encodeURIComponent(projectId)}/runtime`);
}

export async function fetchProjectRecovery(projectId: string): Promise<ProjectRecoveryResponse> {
  return requestJson<ProjectRecoveryResponse>(`/api/projects/${encodeURIComponent(projectId)}/recovery`);
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
