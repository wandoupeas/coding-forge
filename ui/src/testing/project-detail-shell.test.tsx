// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from './render-app';
import type {
  ApiProjectArtifacts,
  ApiProjectOverview,
  ApiProjectRecord,
  ApiProjectRecovery,
  ApiProjectRuntime,
  ApiProjectTasks
} from '../lib/api';

const mockProject = {
  id: 'alpha',
  name: 'Alpha Workspace',
  rootPath: '/workspace/webforge/alpha',
  workspacePath: '/workspace/webforge/alpha/.webforge',
  updatedAt: '2026-03-31T08:00:00Z',
  readable: true
} satisfies ApiProjectRecord;

const mockOverview = {
  project: {
    name: mockProject.name,
    rootPath: mockProject.rootPath,
    workspacePath: mockProject.workspacePath
  },
  runtime: {
    status: 'ready',
    summary: 'Snapshot is ready for follow-up work.',
    updatedAt: '2026-03-31T08:00:00Z',
    currentTaskId: 'T001',
    currentPhaseId: 'P1',
    latestRuntimeSessionId: 'session-alpha',
    latestRuntimeEvent: 'runtime_completed'
  },
  tasks: {
    total: 8,
    pending: 0,
    ready: 5,
    inProgress: 1,
    blocked: 1,
    completed: 2,
    failed: 0,
    pendingReview: 1
  },
  artifacts: {
    knowledgeCount: 4,
    deliverablesCount: 3,
    pendingReviewCount: 1,
    sessionCount: 2
  },
  recovery: {
    canProceed: true,
    status: 'ready',
    doctorSummary: {
      ok: 8,
      warn: 1,
      fail: 0
    },
    contextDriftStatus: 'aligned',
    threadLinkageStatus: 'ready'
  }
} satisfies ApiProjectOverview;

const mockTasks = {
  counts: {
    total: 8,
    pending: 0,
    ready: 5,
    inProgress: 1,
    blocked: 1,
    completed: 2,
    failed: 0,
    pendingReview: 1
  },
  items: [],
  ready: [{ id: 'T001', title: 'Build overview shell', assignee: 'agent', priority: 1 }],
  inProgress: [{ id: 'T002', title: 'Review recovery rail', assignee: 'agent', priority: 2 }],
  blocked: [
    {
      id: 'T003',
      title: 'Missing handoff',
      assignee: 'agent',
      priority: 3,
      blockedBy: ['handoff.md']
    }
  ],
  pendingReview: [
    { id: 'T004', title: 'Approve artifact layout', assignee: 'reviewer', priority: 2 }
  ]
} satisfies ApiProjectTasks;

const mockRecovery = {
  doctor: {
    summary: {
      ok: 8,
      warn: 1,
      fail: 0
    },
    guidance: ['Run webforge logs runtime to inspect the latest session.']
  },
  resume: {
    nextAction: 'Inspect the latest runtime log before resuming T001.',
    shouldRead: ['AGENTS.md', '.webforge/runtime.json']
  },
  onboard: {
    recommendedActions: ['Read AGENTS.md first.']
  },
  runtimeLogs: {
    events: [
      {
        timestamp: '2026-03-31T08:00:00Z',
        message: 'runtime_completed',
        taskId: 'T001',
        permissionProfile: 'approval-required'
      }
    ],
    threadLinkage: {
      status: 'ready',
      threadId: 'thread-alpha',
      workflow: 'writing-plans',
      branch: 'main',
      worktreePath: '/workspace/webforge/alpha',
      missingArtifacts: [],
      missingWorktreePath: null,
      missingThreadId: null
    },
    workflowContext: {
      status: 'ready',
      workflow: 'writing-plans',
      branch: 'main',
      worktreePath: '/workspace/webforge/alpha',
      threadId: 'thread-alpha',
      compactFromSession: null,
      missingArtifacts: [],
      missingWorktreePath: null,
      missingCompactSessionId: null
    },
    currentWorkflowContext: {
      status: 'ready',
      workflow: 'writing-plans',
      branch: 'main',
      worktreePath: '/workspace/webforge/alpha',
      threadId: 'thread-alpha',
      compactFromSession: null,
      missingArtifacts: [],
      missingWorktreePath: null,
      missingCompactSessionId: null
    },
    currentThreadLinkage: {
      status: 'ready',
      threadId: 'thread-alpha',
      workflow: 'writing-plans',
      branch: 'main',
      worktreePath: '/workspace/webforge/alpha',
      missingArtifacts: [],
      missingWorktreePath: null,
      missingThreadId: null
    },
    contextDrift: {
      status: 'aligned',
      reasons: []
    }
  },
  canProceed: true,
  status: 'ready',
  contextDrift: {
    status: 'aligned',
    reasons: []
  },
  threadLinkage: {
    status: 'ready',
    threadId: 'thread-alpha',
    workflow: 'writing-plans',
    branch: 'main',
    worktreePath: '/workspace/webforge/alpha',
    missingArtifacts: [],
    missingWorktreePath: null,
    missingThreadId: null
  },
  workflowContext: {
    workflow: 'writing-plans',
    branch: 'main',
    worktreePath: '/workspace/webforge/alpha',
    threadId: 'thread-alpha',
    compactFromSession: null
  },
  recommendedActions: ['Review the summary view before editing artifacts.']
} satisfies ApiProjectRecovery;

const mockRuntime = {
  runtime: {
    status: 'ready',
    summary: 'Runtime is idle and ready for the next task.',
    updatedAt: '2026-03-31T08:00:00Z',
    sessionId: 'session-alpha',
    phaseId: 'P1',
    taskId: 'T001'
  },
  latestObservation: {
    sessionId: 'session-alpha',
    startTime: '2026-03-31T07:55:00Z',
    endTime: '2026-03-31T08:00:00Z',
    lastEvent: 'runtime_completed',
    lastTaskId: 'T001',
    permissionProfile: 'approval-required',
    completed: 1,
    failed: 0,
    blocked: 0,
    deliverables: 1,
    signals: {
      readyTasks: 5,
      blockedTasks: 1,
      pendingReview: 1,
      unreadMessages: 0
    }
  },
  mailboxes: {
    total: 1,
    unreadMessages: 0,
    items: [{ workerId: 'agent', unreadCount: 0, mailboxPath: '.webforge/mailboxes/agent.jsonl' }]
  },
  checkpoints: {
    total: 1,
    latest: {
      id: 'cp-001',
      name: 'summary checkpoint',
      createdAt: '2026-03-31T08:00:00Z'
    },
    items: [{ id: 'cp-001', name: 'summary checkpoint', createdAt: '2026-03-31T08:00:00Z' }]
  },
  superpowers: {
    totalRuns: 1,
    latestRun: {
      id: 'sp-001',
      workflow: 'writing-plans',
      summary: 'Created project detail redesign plan.',
      recordedAt: '2026-03-31T07:50:00Z',
      taskId: 'T001',
      sessionId: 'session-alpha',
      artifactCount: 1,
      readiness: {
        missingArtifacts: [],
        missingWorktreePath: null,
        missingCompactSessionId: null
      }
    }
  }
} satisfies ApiProjectRuntime;

const mockArtifacts = {
  knowledge: {
    total: 1,
    byType: { spec: 1 },
    items: [
      {
        id: 'K001',
        type: 'spec',
        title: 'UI redesign spec',
        path: 'docs/spec.md',
        updatedAt: '2026-03-31T07:40:00Z',
        preview: 'Research terminal redesign spec.'
      }
    ]
  },
  deliverables: {
    total: 1,
    pendingReview: 1,
    byStatus: { pending_review: 1 },
    items: [
      {
        id: 'D001',
        taskId: 'T004',
        title: 'Artifact browser draft',
        type: 'doc',
        status: 'pending_review',
        path: 'docs/artifact.md',
        createdAt: '2026-03-31T07:50:00Z',
        createdBy: 'agent',
        preview: 'Artifact browser summary.'
      }
    ]
  },
  sessions: {
    total: 1,
    byStatus: { active: 1 },
    latest: {
      id: 'session-alpha',
      name: 'UI redesign session',
      status: 'active',
      lastActive: '2026-03-31T08:00:00Z',
      currentTask: 'T001',
      currentPhase: 'P1',
      preview: 'Focused on project detail shell.'
    },
    items: [
      {
        id: 'session-alpha',
        name: 'UI redesign session',
        status: 'active',
        lastActive: '2026-03-31T08:00:00Z',
        currentTask: 'T001',
        currentPhase: 'P1',
        preview: 'Focused on project detail shell.'
      }
    ]
  }
} satisfies ApiProjectArtifacts;

vi.mock('../lib/api', () => ({
  fetchProjectsDashboard: vi.fn(() =>
    Promise.resolve({
      rootPath: '/workspace/webforge',
      fetchedAt: '2026-03-31T08:00:00Z',
      projects: []
    })
  ),
  fetchProjectOverview: vi.fn(() => Promise.resolve({ project: mockProject, data: mockOverview })),
  fetchProjectTasks: vi.fn(() => Promise.resolve({ project: mockProject, data: mockTasks })),
  fetchProjectRecovery: vi.fn(() => Promise.resolve({ project: mockProject, data: mockRecovery })),
  fetchProjectRuntime: vi.fn(() => Promise.resolve({ project: mockProject, data: mockRuntime })),
  fetchProjectArtifacts: vi.fn(() => Promise.resolve({ project: mockProject, data: mockArtifacts }))
}));

describe('project detail shell', () => {
  it('renders tabs with a persistent recovery rail on the summary route', async () => {
    renderApp('/projects/alpha');

    expect(await screen.findByRole('tab', { name: /summary/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /evidence/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /runtime/i })).toBeInTheDocument();
    const recoveryRail = screen.getByRole('complementary', { name: /recovery rail/i });
    expect(recoveryRail).toBeInTheDocument();
    expect(within(recoveryRail).getByText(/^Next action$/i)).toBeInTheDocument();
    expect(within(recoveryRail).getByText(mockRecovery.resume.nextAction)).toBeInTheDocument();
    expect(screen.getByText(/^Ready now$/i)).toBeInTheDocument();
  });

  it('reuses the same shell on the evidence route', async () => {
    renderApp('/projects/alpha/artifacts');

    const evidenceTab = await screen.findByRole('tab', { name: /evidence/i });
    expect(evidenceTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('complementary', { name: /recovery rail/i })).toBeInTheDocument();
    expect(screen.getByText(/preview/i)).toBeInTheDocument();
  });

  it('reuses the same shell on the runtime route', async () => {
    renderApp('/projects/alpha/runtime');

    const runtimeTab = await screen.findByRole('tab', { name: /runtime/i });
    expect(runtimeTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('complementary', { name: /recovery rail/i })).toBeInTheDocument();
    expect(screen.getByText(/recent events/i)).toBeInTheDocument();
    expect(screen.getByText(/snapshots comparison/i)).toBeInTheDocument();
  });
});
