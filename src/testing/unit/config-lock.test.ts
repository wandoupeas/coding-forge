import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, open, rm, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createDefaultConfig,
  createDefaultWorkerConfig,
  loadConfig,
  loadWorkerConfig,
  saveConfig,
  saveWorkerConfig
} from '../../utils/config.js';
import { withFileLock } from '../../utils/lock.js';

describe('config and lock utilities', () => {
  let sandboxDir = '';

  beforeEach(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-config-lock-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (sandboxDir) {
      await rm(sandboxDir, { recursive: true, force: true });
      sandboxDir = '';
    }
  });

  it('saves and loads project and worker config with explicit basePath', async () => {
    const config = createDefaultConfig('explicit-config');
    const workerConfig = createDefaultWorkerConfig('backend');

    await saveConfig(config, sandboxDir);
    await saveWorkerConfig('backend', workerConfig, sandboxDir);

    await expect(loadConfig(sandboxDir)).resolves.toMatchObject({
      project: {
        name: 'explicit-config'
      },
      agent: {
        provider: 'stub',
        permission_profile: 'workspace-write'
      }
    });
    await expect(loadWorkerConfig('backend', sandboxDir)).resolves.toMatchObject({
      role: 'backend',
      name: 'Backend Developer'
    });
  });

  it('uses process.cwd when basePath is omitted and falls back unknown workers to pm', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(sandboxDir);

    await saveConfig(createDefaultConfig('cwd-config'));
    await saveWorkerConfig('qa', createDefaultWorkerConfig('qa'));

    await expect(loadConfig()).resolves.toMatchObject({
      project: {
        name: 'cwd-config'
      },
      agent: {
        provider: 'stub',
        permission_profile: 'workspace-write'
      }
    });
    await expect(loadWorkerConfig('qa')).resolves.toMatchObject({
      role: 'qa',
      name: 'QA Engineer'
    });
    expect(createDefaultWorkerConfig('unknown-role')).toMatchObject({
      role: 'pm',
      name: 'Project Manager'
    });
  });

  it('supports custom lock options and tolerates cleanup when the lock file is already gone', async () => {
    const lockPath = join(sandboxDir, 'cleanup.lock');

    const result = await withFileLock(
      lockPath,
      async () => {
        await unlink(lockPath);
        return 'ok';
      },
      {
        retryDelayMs: 1,
        timeoutMs: 50
      }
    );

    expect(result).toBe('ok');
  });

  it('times out when the file lock stays occupied', async () => {
    const lockPath = join(sandboxDir, 'busy.lock');
    const handle = await open(lockPath, 'w');

    await expect(
      withFileLock(
        lockPath,
        async () => 'never',
        {
          retryDelayMs: 1,
          timeoutMs: 5
        }
      )
    ).rejects.toThrow(/Timed out acquiring file lock/);

    await handle.close();
  });
});
