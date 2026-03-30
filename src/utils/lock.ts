import { open, unlink } from 'fs/promises';
import { dirname } from 'path';
import { ensureDir } from './file.js';

interface FileLockOptions {
  retryDelayMs?: number;
  timeoutMs?: number;
}

export async function withFileLock<T>(
  lockPath: string,
  fn: () => Promise<T>,
  options?: FileLockOptions
): Promise<T> {
  const retryDelayMs = options?.retryDelayMs ?? 20;
  const timeoutMs = options?.timeoutMs ?? 5000;
  const startTime = Date.now();

  await ensureDir(dirname(lockPath));

  let handle: Awaited<ReturnType<typeof open>> | undefined;

  while (true) {

    try {
      handle = await open(lockPath, 'wx');
      break;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      if (Date.now() - startTime >= timeoutMs) {
        throw new Error(`Timed out acquiring file lock: ${lockPath}`);
      }

      await sleep(retryDelayMs);
    }
  }

  try {
    return await fn();
  } finally {
    await handle?.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
