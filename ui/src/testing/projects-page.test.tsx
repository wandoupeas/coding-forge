// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from './render-app';

vi.mock('../lib/api', () => ({
  fetchProjectsDashboard: vi.fn(
    () =>
      new Promise(() => {
        /* keep the page in its initial loading state */
      })
  )
}));

describe('projects page shell', () => {
  it('shows the homepage section markers inside the app shell', () => {
    renderApp('/');

    expect(screen.getByText('Coding Forge Monitor')).toBeInTheDocument();
    expect(screen.getByText('Project Index')).toBeInTheDocument();
    expect(screen.getByText('Workspace Ledger')).toBeInTheDocument();
    expect(screen.getByText('Signal Rail')).toBeInTheDocument();
  });
});
