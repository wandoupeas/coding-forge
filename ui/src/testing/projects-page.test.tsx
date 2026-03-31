// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from './render-app';
import type { ProjectsDashboardSnapshot } from '../lib/api';

const readySnapshot = {
  rootPath: '/workspace/webforge',
  fetchedAt: '2026-03-31T04:20:00Z',
  projects: [
    {
      project: {
        id: 'alpha',
        name: 'Alpha Workspace',
        rootPath: '/workspace/webforge/alpha',
        workspacePath: '/workspace/webforge/alpha/.webforge',
        updatedAt: '2026-03-31T04:10:00Z',
        readable: true
      },
      overview: {
        project: {
          name: 'Alpha Workspace',
          rootPath: '/workspace/webforge/alpha',
          workspacePath: '/workspace/webforge/alpha/.webforge'
        },
        runtime: {
          status: 'ready',
          summary: 'Snapshot is ready for follow-up work.',
          updatedAt: '2026-03-31T04:18:00Z',
          currentTaskId: 'task-alpha',
          currentPhaseId: 'phase-alpha',
          latestRuntimeSessionId: 'session-alpha',
          latestRuntimeEvent: 'checkpoint recorded'
        },
        tasks: {
          total: 8,
          pending: 0,
          ready: 7,
          inProgress: 1,
          blocked: 0,
          completed: 6,
          failed: 0,
          pendingReview: 0
        },
        artifacts: {
          knowledgeCount: 3,
          deliverablesCount: 2,
          pendingReviewCount: 0,
          sessionCount: 1
        },
        recovery: {
          canProceed: true,
          status: 'ready',
          doctorSummary: {
            ok: 8,
            warn: 0,
            fail: 0
          },
          contextDriftStatus: 'aligned',
          threadLinkageStatus: 'ready'
        }
      },
      error: null
    },
    {
      project: {
        id: 'beta',
        name: 'Beta Workspace',
        rootPath: '/workspace/webforge/beta',
        workspacePath: '/workspace/webforge/beta/.webforge',
        updatedAt: '2026-03-31T04:12:00Z',
        readable: true
      },
      overview: {
        project: {
          name: 'Beta Workspace',
          rootPath: '/workspace/webforge/beta',
          workspacePath: '/workspace/webforge/beta/.webforge'
        },
        runtime: {
          status: 'blocked',
          summary: 'Blocked on missing handoff artifact.',
          updatedAt: '2026-03-31T04:17:00Z',
          currentTaskId: 'task-beta',
          currentPhaseId: 'phase-beta',
          latestRuntimeSessionId: 'session-beta',
          latestRuntimeEvent: 'handoff missing'
        },
        tasks: {
          total: 5,
          pending: 1,
          ready: 2,
          inProgress: 1,
          blocked: 1,
          completed: 1,
          failed: 0,
          pendingReview: 0
        },
        artifacts: {
          knowledgeCount: 1,
          deliverablesCount: 1,
          pendingReviewCount: 0,
          sessionCount: 2
        },
        recovery: {
          canProceed: false,
          status: 'blocked',
          doctorSummary: {
            ok: 5,
            warn: 1,
            fail: 1
          },
          contextDriftStatus: 'none',
          threadLinkageStatus: 'blocked'
        }
      },
      error: null
    },
    {
      project: {
        id: 'gamma',
        name: 'Gamma Workspace',
        rootPath: '/workspace/webforge/gamma',
        workspacePath: '/workspace/webforge/gamma/.webforge',
        updatedAt: '2026-03-31T04:14:00Z',
        readable: true
      },
      overview: {
        project: {
          name: 'Gamma Workspace',
          rootPath: '/workspace/webforge/gamma',
          workspacePath: '/workspace/webforge/gamma/.webforge'
        },
        runtime: {
          status: 'ready',
          summary: 'Waiting for review approval.',
          updatedAt: '2026-03-31T04:16:00Z',
          currentTaskId: 'task-gamma',
          currentPhaseId: 'phase-gamma',
          latestRuntimeSessionId: 'session-gamma',
          latestRuntimeEvent: 'review queued'
        },
        tasks: {
          total: 9,
          pending: 2,
          ready: 5,
          inProgress: 1,
          blocked: 0,
          completed: 4,
          failed: 0,
          pendingReview: 2
        },
        artifacts: {
          knowledgeCount: 4,
          deliverablesCount: 3,
          pendingReviewCount: 2,
          sessionCount: 3
        },
        recovery: {
          canProceed: true,
          status: 'ready',
          doctorSummary: {
            ok: 7,
            warn: 1,
            fail: 0
          },
          contextDriftStatus: 'drifted',
          threadLinkageStatus: 'ready'
        }
      },
      error: null
    },
    {
      project: {
        id: 'delta',
        name: 'Delta Workspace',
        rootPath: '/workspace/webforge/delta',
        workspacePath: '/workspace/webforge/delta/.webforge',
        updatedAt: '2026-03-31T04:15:00Z',
        readable: true
      },
      overview: null,
      error: null
    }
  ]
} satisfies ProjectsDashboardSnapshot;

vi.mock('../lib/api', () => ({
  fetchProjectsDashboard: vi.fn(() => Promise.resolve(readySnapshot))
}));

describe('projects page', () => {
  it('renders project navigation, a workspace table, and ready snapshot rows', async () => {
    renderApp('/');

    const projectIndex = await screen.findByRole('navigation', { name: /project index/i });
    const ledger = await screen.findByRole('table', { name: /workspace ledger/i });
    const signalRail = screen.getByRole('complementary', { name: /signal rail/i });

    expect(projectIndex).toBeInTheDocument();
    expect(ledger).toBeInTheDocument();
    expect(signalRail).toBeInTheDocument();

    const nav = within(projectIndex);
    expect(nav.getByRole('link', { name: /alpha workspace/i })).toHaveAttribute(
      'href',
      '/projects/alpha'
    );

    expect(within(projectIndex).getByText('1 healthy')).toBeInTheDocument();
    expect(within(projectIndex).getByText('1 watch')).toBeInTheDocument();
    expect(within(projectIndex).getByText('2 blocked')).toBeInTheDocument();
    expect(screen.getByText('1 project with pending review artifacts')).toBeInTheDocument();

    expect(within(ledger).getByText('Alpha Workspace')).toBeInTheDocument();
    expect(within(ledger).getByText('7 ready / 0 blocked / 0 review')).toBeInTheDocument();
    expect(within(ledger).getByText('Beta Workspace')).toBeInTheDocument();

    const alerts = within(signalRail).getAllByRole('alert');
    expect(alerts[0]).toHaveTextContent('Missing overview');
    expect(alerts[1]).toHaveTextContent('Blocked');
    expect(within(signalRail).getByText('+1 more signals')).toBeInTheDocument();
  });
});
