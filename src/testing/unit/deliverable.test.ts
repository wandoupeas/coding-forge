/**
 * Deliverable state service unit tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { isAbsolute, join } from 'path';
import {
  createDeliverable,
  getDeliverableContent,
  listDeliverables,
  reviewDeliverable
} from '../../core/deliverable.js';

let sandboxDir = '';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  const prefixPath = (path: string) => (isAbsolute(path) ? path : join(sandboxDir, path));

  return {
    ...actual,
    open: async (path: string, flags: string) => actual.open(prefixPath(path), flags),
    unlink: async (path: string) => actual.unlink(prefixPath(path)),
    mkdir: async (path: string, options?: Parameters<typeof actual.mkdir>[1]) =>
      actual.mkdir(prefixPath(path), options)
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  const prefixPath = (path: string) => join(sandboxDir, path);

  return {
    ...actual,
    existsSync: (path: string) => actual.existsSync(prefixPath(path))
  };
});

vi.mock('../../utils/file.js', async () => {
  const { readFile, writeFile, mkdir } = await vi.importActual<
    typeof import('fs/promises')
  >('fs/promises');
  const actual = await vi.importActual<typeof import('../../utils/file.js')>(
    '../../utils/file.js'
  );
  const prefixPath = (path: string) => join(sandboxDir, path);

  return {
    ...actual,
    ensureDir: async (path: string) => {
      await mkdir(prefixPath(path), { recursive: true });
    },
    readText: async (path: string) => readFile(prefixPath(path), 'utf-8'),
    writeText: async (path: string, content: string) => {
      await mkdir(join(prefixPath(path), '..'), { recursive: true });
      await writeFile(prefixPath(path), content, 'utf-8');
    },
    readJson: async <T>(path: string) =>
      JSON.parse(await readFile(prefixPath(path), 'utf-8')) as T,
    writeJson: async (path: string, data: unknown) => {
      await mkdir(join(prefixPath(path), '..'), { recursive: true });
      await writeFile(prefixPath(path), JSON.stringify(data, null, 2), 'utf-8');
    }
  };
});

describe('deliverable state service', () => {
  beforeEach(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-deliverable-'));
  });

  afterEach(async () => {
    if (sandboxDir) {
      await rm(sandboxDir, { recursive: true, force: true });
      sandboxDir = '';
    }
  });

  it('stores deliverables in an index with an items array', async () => {
    const deliverable = await createDeliverable(
      'T001',
      'document',
      '架构说明',
      'content',
      'pm'
    );

    const rawIndex = JSON.parse(
      await readFile(
        join(sandboxDir, '.webforge', 'deliverables', 'index.json'),
        'utf-8'
      )
    ) as unknown;

    expect(rawIndex).toEqual({
      items: [
        expect.objectContaining({
          id: deliverable.id,
          taskId: 'T001',
          type: 'document',
          title: '架构说明',
          content: 'content',
          path: deliverable.path,
          createdBy: 'pm',
          status: 'pending_review'
        })
      ]
    });

    const items = await listDeliverables('T001');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      taskId: 'T001',
      title: '架构说明',
      content: 'content',
      status: 'pending_review'
    });
  });

  it('updates the indexed deliverable when reviewed', async () => {
    const deliverable = await createDeliverable(
      'T002',
      'code',
      'runtime helper',
      'export const runtimeHelper = () => true;',
      'backend'
    );

    await reviewDeliverable(deliverable.id, true, 'looks good');

    const items = await listDeliverables('T002');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: deliverable.id,
      status: 'approved',
      reviewComment: 'looks good'
    });
  });

  it('assigns a unique file path per deliverable id', async () => {
    const first = await createDeliverable(
      'T003',
      'document',
      'first copy',
      'alpha',
      'pm'
    );
    const second = await createDeliverable(
      'T003',
      'document',
      'second copy',
      'beta',
      'pm'
    );

    expect(first.path).not.toBe(second.path);

    const firstContent = await readFile(join(sandboxDir, first.path), 'utf-8');
    const secondContent = await readFile(join(sandboxDir, second.path), 'utf-8');

    expect(firstContent).toBe('alpha');
    expect(secondContent).toBe('beta');
  });

  it('keeps all index entries when deliverables are created concurrently', async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        createDeliverable(
          'T004',
          'document',
          `parallel-${index}`,
          `content-${index}`,
          'pm'
        )
      )
    );

    const items = await listDeliverables('T004');
    expect(items).toHaveLength(12);
    expect(new Set(items.map(item => item.title)).size).toBe(12);
  });

  it('falls back to indexed content when the backing file no longer exists', async () => {
    const deliverable = await createDeliverable(
      'T005',
      'document',
      'lost file',
      'indexed fallback',
      'pm'
    );

    await rm(join(sandboxDir, deliverable.path), { force: true });

    await expect(getDeliverableContent(deliverable.id)).resolves.toBe('indexed fallback');
  });

  it('returns null for missing deliverables and tolerates malformed index payloads', async () => {
    await createDeliverable(
      'T006',
      'document',
      'seed',
      'seed content',
      'pm'
    );

    await expect(getDeliverableContent('missing-deliverable')).resolves.toBeNull();

    await writeFile(
      join(sandboxDir, '.webforge', 'deliverables', 'index.json'),
      JSON.stringify({ nope: true }),
      'utf-8'
    );

    await expect(listDeliverables()).resolves.toEqual([]);
    await expect(getDeliverableContent('still-missing')).resolves.toBeNull();
  });

  it('accepts legacy array-shaped indexes and can list all deliverables', async () => {
    await createDeliverable(
      'T007',
      'document',
      'seed',
      'seed content',
      'pm'
    );

    await writeFile(
      join(sandboxDir, '.webforge', 'deliverables', 'index.json'),
      JSON.stringify(
        [
          {
            id: 'del-legacy-1',
            taskId: 'T100',
            type: 'document',
            title: 'legacy one',
            content: 'one',
            path: '.webforge/deliverables/del-legacy-1.md',
            createdBy: 'pm',
            createdAt: '2026-03-30T00:00:00.000Z',
            status: 'pending_review'
          },
          {
            id: 'del-legacy-2',
            taskId: 'T101',
            type: 'document',
            title: 'legacy two',
            content: 'two',
            path: '.webforge/deliverables/del-legacy-2.md',
            createdBy: 'qa',
            createdAt: '2026-03-30T00:00:00.000Z',
            status: 'approved'
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    await expect(listDeliverables()).resolves.toHaveLength(2);
    await expect(listDeliverables('T100')).resolves.toHaveLength(1);
  });
});
