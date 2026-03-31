/**
 * ui 命令 - 启动 Web UI 本地服务
 */

import { Command } from 'commander';
import { startUiHttpServer, type StartedUiHttpServerHandle } from '../../ui/http/server.js';
import logger from '../utils/logger.js';

export interface UiCommandOptions {
  root?: string;
  host?: string;
  port?: string;
  staticRoot?: string;
}

export function createUiCommand(): Command {
  return new Command('ui')
    .description('启动 WebForge 多项目只读 Web UI')
    .option('--root <path>', '要扫描的项目根目录', process.cwd())
    .option('--host <host>', '服务监听地址', '127.0.0.1')
    .option('--port <port>', '服务端口', '4173')
    .action(async (options: UiCommandOptions) => {
      await startUiServer(options);
    });
}

export async function startUiServer(
  options: UiCommandOptions
): Promise<StartedUiHttpServerHandle> {
  const root = options.root ?? process.cwd();
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? '4173';
  const numericPort = Number.parseInt(port, 10);

  if (Number.isNaN(numericPort) || numericPort < 0 || numericPort > 65535) {
    throw new Error(`invalid ui port: ${port}`);
  }

  const handle = await startUiHttpServer({
    rootPath: root,
    host,
    port: numericPort,
    staticRoot: options.staticRoot
  });

  logger.h1('Web UI Ready');
  logger.info('Web UI 本地服务已启动。');
  logger.list([
    `root: ${root}`,
    `host: ${handle.host}`,
    `port: ${handle.port}`,
    `url: ${handle.url}`
  ]);

  return handle;
}
