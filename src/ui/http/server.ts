import { readFile } from 'fs/promises';
import { createServer, type Server } from 'http';
import { fileURLToPath } from 'url';
import { extname, isAbsolute, join, relative, resolve } from 'path';
import { ProjectRegistry } from '../project-registry.js';
import { createUiRequestListener } from './router.js';
import type { ProjectRecord } from '../project-scanner.js';

export interface UiHttpServerOptions {
  rootPath?: string;
  registry?: ProjectRegistry;
  staticRoot?: string;
}

export interface StartUiHttpServerOptions extends UiHttpServerOptions {
  host?: string;
  port?: number;
}

export interface UiHttpServerHandle {
  server: Server;
  registry: ProjectRegistry;
  rootPath: string;
  staticRoot: string;
  refreshProjects: () => Promise<ProjectRecord[]>;
}

export interface StartedUiHttpServerHandle extends UiHttpServerHandle {
  host: string;
  port: number;
  url: string;
  close: () => Promise<void>;
}

export async function createUiHttpServer(
  options: UiHttpServerOptions = {}
): Promise<UiHttpServerHandle> {
  const rootPath = options.rootPath ?? process.cwd();
  const registry = options.registry ?? new ProjectRegistry();
  const staticRoot = resolve(options.staticRoot ?? getDefaultUiStaticRoot());

  await registry.refresh(rootPath);
  const apiListener = createUiRequestListener({
    rootPath,
    registry
  });

  const server = createServer(async (request, response) => {
    const pathname = getPathname(request.url);
    if (pathname.startsWith('/api/')) {
      await apiListener(request, response);
      return;
    }

    await serveStaticAsset(response, pathname, staticRoot);
  });

  return {
    server,
    registry,
    rootPath,
    staticRoot,
    refreshProjects: () => registry.refresh(rootPath)
  };
}

export async function startUiHttpServer(
  options: StartUiHttpServerOptions = {}
): Promise<StartedUiHttpServerHandle> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 4317;
  const handle = await createUiHttpServer(options);

  await new Promise<void>((resolvePromise, rejectPromise) => {
    handle.server.once('error', rejectPromise);
    handle.server.listen(port, host, () => {
      handle.server.off('error', rejectPromise);
      resolvePromise();
    });
  });

  const address = handle.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('UI server failed to bind to a TCP port');
  }

  return {
    ...handle,
    host,
    port: address.port,
    url: `http://${host}:${address.port}`,
    close: () =>
      new Promise<void>((resolvePromise, rejectPromise) => {
        handle.server.close((error) => {
          if (error) {
            rejectPromise(error);
            return;
          }

          resolvePromise();
        });
      })
  };
}

export function getDefaultUiStaticRoot(): string {
  return fileURLToPath(new URL('../../../dist/ui', import.meta.url));
}

function getPathname(url: string | undefined): string {
  if (!url) {
    return '/';
  }

  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

async function serveStaticAsset(
  response: import('http').ServerResponse,
  pathname: string,
  staticRoot: string
): Promise<void> {
  const indexPath = join(staticRoot, 'index.html');
  const resolvedPath = resolveStaticPath(staticRoot, pathname);

  try {
    const content = await readFile(resolvedPath);
    response.statusCode = 200;
    response.setHeader('Content-Type', contentTypeFor(resolvedPath));
    response.setHeader('Cache-Control', pathname === '/' ? 'no-store' : 'public, max-age=60');
    response.end(content);
    return;
  } catch {
    try {
      const content = await readFile(indexPath);
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(content);
      return;
    } catch {
      response.statusCode = 503;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          error: {
            code: 'ui_bundle_missing',
            message: 'UI bundle not found',
            details: {
              staticRoot
            }
          }
        })
      );
    }
  }
}

function resolveStaticPath(staticRoot: string, pathname: string): string {
  const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = resolve(staticRoot, requestedPath);
  const normalizedRoot = resolve(staticRoot);
  const relativePath = relative(normalizedRoot, candidate);

  if (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !isAbsolute(relativePath))
  ) {
    return candidate;
  }

  return join(staticRoot, 'index.html');
}

function contentTypeFor(path: string): string {
  switch (extname(path)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}
