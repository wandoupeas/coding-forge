#!/usr/bin/env node
/**
 * WebForge Stop Hook
 *
 * 当 Claude Code 会话结束时自动保存工作快照到 .webforge/
 * 触发时机：Stop event（agent 停止响应时）
 */

import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, resolve } from 'path';

const basePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const webforgePath = join(basePath, '.webforge', 'runtime.json');

if (!existsSync(webforgePath)) {
  // 不是 WebForge 项目，静默退出
  process.exit(0);
}

try {
  // 找到 webforge CLI 的路径
  const cliPaths = [
    join(basePath, 'dist', 'cli', 'index.js'),
    join(basePath, 'node_modules', '.bin', 'webforge')
  ];

  let cliPath = null;
  for (const p of cliPaths) {
    if (existsSync(p)) {
      cliPath = p;
      break;
    }
  }

  if (!cliPath) {
    // 尝试全局 webforge
    try {
      execSync('which webforge', { encoding: 'utf-8', timeout: 3000 });
      cliPath = 'webforge';
    } catch {
      process.exit(0);
    }
  }

  const cmd = cliPath === 'webforge'
    ? `webforge record snapshot --reason session_end --json`
    : `node "${cliPath}" record snapshot --reason session_end --json`;

  const result = execSync(cmd, {
    cwd: basePath,
    encoding: 'utf-8',
    timeout: 10000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' }
  });

  // 输出到 stderr 让 Claude Code 看到但不阻塞
  if (result.trim()) {
    process.stderr.write(`[webforge] ${result.trim()}\n`);
  }
} catch (error) {
  // hook 失败不应阻塞会话结束
  process.stderr.write(`[webforge] snapshot failed: ${error.message || error}\n`);
}
