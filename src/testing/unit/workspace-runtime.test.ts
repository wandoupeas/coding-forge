import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace, loadWorkspaceState } from '../../core/workspace.js';

describe('workspace runtime validation', () => {
  let workspaceDir = '';

  afterEach(async () => {
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('rejects loading when runtime.json is missing', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-runtime-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-missing' });

    await unlink(state.paths.runtime);

    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(/runtime file not found/);
  });

  it('defaults optional runtime fields when status and summary are omitted', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-runtime-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-defaults' });

    await writeRuntime(state.paths.runtime, {
      version: '0.2',
      updatedAt: '2026-03-30T00:00:00.000Z',
      sessionId: null,
      phaseId: null,
      taskId: null
    });

    const loaded = await loadWorkspaceState(workspaceDir);
    expect(loaded.runtime).toMatchObject({
      version: '0.2',
      status: 'idle',
      summary: 'workspace ready',
      sessionId: null,
      phaseId: null,
      taskId: null
    });
  });

  it('rejects non-object runtime payloads', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-runtime-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-shape' });

    await writeRuntime(state.paths.runtime, []);

    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(
      /Workspace runtime must be an object/
    );
  });

  it('rejects unsupported runtime versions and statuses', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-runtime-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-version' });

    await writeRuntime(state.paths.runtime, validRuntime({ version: '0.1' }));
    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(/Unsupported workspace version/);

    await writeRuntime(state.paths.runtime, validRuntime({ status: 'paused' }));
    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(
      /Unsupported workspace runtime status/
    );
  });

  it('rejects invalid updatedAt and identity field shapes', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-runtime-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-fields' });

    await writeRuntime(state.paths.runtime, validRuntime({ updatedAt: '' }));
    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(
      /runtime\.updatedAt must be a non-empty string/
    );

    await writeRuntime(state.paths.runtime, validRuntime({ sessionId: 1 }));
    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(
      /runtime\.sessionId must be a string or null/
    );

    await writeRuntime(state.paths.runtime, validRuntime({ phaseId: 1 }));
    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(
      /runtime\.phaseId must be a string or null/
    );

    await writeRuntime(state.paths.runtime, validRuntime({ taskId: 1 }));
    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(
      /runtime\.taskId must be a string or null/
    );
  });

  it('rejects non-string runtime summaries', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-workspace-runtime-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'runtime-summary' });

    await writeRuntime(state.paths.runtime, validRuntime({ summary: { text: 'bad' } }));

    await expect(loadWorkspaceState(workspaceDir)).rejects.toThrow(
      /runtime\.summary must be a string/
    );
  });
});

async function writeRuntime(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), 'utf-8');
}

function validRuntime(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    version: '0.2',
    status: 'idle',
    updatedAt: '2026-03-30T00:00:00.000Z',
    sessionId: null,
    phaseId: null,
    taskId: null,
    summary: 'ok',
    ...overrides
  };
}
