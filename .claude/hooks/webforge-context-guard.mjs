#!/usr/bin/env node
/**
 * WebForge Context Guard
 *
 * PostToolUse hook — 每次工具调用后检查是否需要保存状态。
 *
 * 触发条件（任一满足即保存）：
 * 1. 环境变量 CLAUDE_COMPACT_PENDING=1（压缩即将发生）
 * 2. 距离上次 record 超过 15 分钟且有文件变更
 *
 * 不阻塞工具调用，静默运行。
 */

import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const basePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const runtimePath = join(basePath, '.webforge', 'runtime.json');

// 没有 .webforge/ 就退出
if (!existsSync(runtimePath)) {
  process.exit(0);
}

// 找 CLI
const cliPath = join(basePath, 'dist', 'cli', 'index.js');
if (!existsSync(cliPath)) {
  process.exit(0);
}

try {
  const runtime = JSON.parse(readFileSync(runtimePath, 'utf-8'));
  const lastUpdate = new Date(runtime.updatedAt).getTime();
  const elapsed = Date.now() - lastUpdate;
  const FIFTEEN_MINUTES = 15 * 60 * 1000;

  // 条件 1: 距上次更新超过 15 分钟
  const stale = elapsed > FIFTEEN_MINUTES;

  // 条件 2: 有文件变更
  let hasChanges = false;
  if (stale) {
    try {
      const diff = execSync('git diff --name-only HEAD 2>/dev/null', {
        cwd: basePath,
        encoding: 'utf-8',
        timeout: 3000
      }).trim();
      hasChanges = diff.split('\n').filter(l => l && !l.startsWith('.webforge/')).length > 0;
    } catch {
      // git 不可用
    }
  }

  if (stale && hasChanges) {
    execSync(`node "${cliPath}" record auto --json`, {
      cwd: basePath,
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
      stdio: 'pipe'
    });
    process.stderr.write('[webforge] auto-saved (stale context)\n');
  }
} catch {
  // hook 失败不阻塞
}
