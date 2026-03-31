/**
 * ui 命令 - 输出 Web UI scaffold 信息
 */

import { Command } from 'commander';
import logger from '../utils/logger.js';

export interface UiCommandOptions {
  root?: string;
  host?: string;
  port?: string;
}

export function createUiCommand(): Command {
  return new Command('ui')
    .description('显示 WebForge 多项目只读 Web UI 的 scaffold 启动参数')
    .option('--root <path>', '要扫描的项目根目录', process.cwd())
    .option('--host <host>', '服务监听地址', '127.0.0.1')
    .option('--port <port>', '服务端口', '4173')
    .action(async (options: UiCommandOptions) => {
      await startUiServer(options);
    });
}

export async function startUiServer(options: UiCommandOptions): Promise<void> {
  const root = options.root ?? process.cwd();
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? '4173';
  const url = `http://${host}:${port}`;

  logger.h1('Web UI Scaffold');
  logger.info('Web UI 服务骨架已接入；当前任务只验证命令、构建链路与访问参数。');
  logger.list([
    `root: ${root}`,
    `host: ${host}`,
    `port: ${port}`,
    `url: ${url}`
  ]);
}
