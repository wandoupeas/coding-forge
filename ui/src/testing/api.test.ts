// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProjectsDashboard } from '../lib/api';

describe('ui api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips overview requests for unreadable projects', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rootPath: '/workspace',
        fetchedAt: '2026-03-31T06:00:00.000Z',
        projects: [
          {
            id: 'alpha',
            name: 'alpha',
            rootPath: '/workspace/alpha',
            workspacePath: '/workspace/alpha/.webforge',
            updatedAt: '2026-03-31T05:59:00.000Z',
            readable: false
          }
        ]
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchProjectsDashboard();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(snapshot.projects).toEqual([
      {
        project: {
          id: 'alpha',
          name: 'alpha',
          rootPath: '/workspace/alpha',
          workspacePath: '/workspace/alpha/.webforge',
          updatedAt: '2026-03-31T05:59:00.000Z',
          readable: false
        },
        overview: null,
        error: 'Workspace is incomplete or unreadable.'
      }
    ]);
  });
});
