# Web UI Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 WebForge 增加一个内置、本地启动、多项目只读的 Web UI，用于查看项目总览、任务、交付物、日志、恢复状态与方法层线索。

**Architecture:** 在现有 CLI 内新增 `webforge ui` 入口，由轻量 Node HTTP server 扫描一个工作根目录下的多个 `.webforge/` 项目，并通过只读聚合层暴露统一 JSON API。前端使用 React + Mantine + TanStack Table + Recharts 构建监控工作台，以轮询方式刷新，不直接写 `.webforge/`。

**Tech Stack:** Node.js 18+, TypeScript, Commander, React, Vite, Mantine, TanStack Table, Recharts, Vitest

---

**Spec Reference:** `docs/superpowers/specs/2026-03-31-webforge-web-ui-design.md`

## 文件结构与职责

- Modify: `package.json`
  增加 Web UI 依赖与构建脚本。

- Create: `vite.config.ts`
  配置前端构建输出到 `dist/ui/`。

- Create: `ui/index.html`
  Vite 前端入口 HTML。

- Create: `ui/src/main.tsx`
  React 应用入口。

- Create: `ui/src/App.tsx`
  应用壳子与路由挂载。

- Create: `ui/src/theme.ts`
  Mantine theme 与视觉变量，后续实现时要结合 `frontend-design` skill。

- Create: `ui/src/lib/api.ts`
  前端 API 客户端。

- Create: `ui/src/routes/ProjectsPage.tsx`
  多项目总览页。

- Create: `ui/src/routes/ProjectOverviewPage.tsx`
  单项目总览 dashboard。

- Create: `ui/src/routes/ProjectArtifactsPage.tsx`
  文档、交付物、sessions、knowledge 浏览页。

- Create: `ui/src/routes/ProjectRuntimePage.tsx`
  runtime、checkpoint、drift、恢复状态页。

- Create: `ui/src/components/layout/AppFrame.tsx`
  顶层页面布局。

- Create: `ui/src/components/projects/ProjectCard.tsx`
  首页项目卡片。

- Create: `ui/src/components/projects/ProjectStatusSummary.tsx`
  任务/状态统计摘要。

- Create: `ui/src/components/projects/RecoveryPanel.tsx`
  `doctor / resume / onboard / contextDrift / threadLinkage` 汇总面板。

- Create: `ui/src/components/projects/RuntimeEventsPanel.tsx`
  runtime 事件与最近日志摘要面板。

- Create: `src/ui/project-scanner.ts`
  扫描根目录下的 WebForge 项目。

- Create: `src/ui/project-registry.ts`
  维护扫描结果与缓存。

- Create: `src/ui/read-models/overview.ts`
  生成项目总览 read model。

- Create: `src/ui/read-models/tasks.ts`
  生成任务 read model。

- Create: `src/ui/read-models/recovery.ts`
  聚合 `doctor / resume / onboard / logs runtime`。

- Create: `src/ui/read-models/artifacts.ts`
  聚合 knowledge、deliverables、sessions。

- Create: `src/ui/read-models/runtime.ts`
  聚合 runtime、mailbox、checkpoint、superpowers 摘要。

- Create: `src/ui/http/server.ts`
  本地 HTTP server，提供 API 与静态资源服务。

- Create: `src/ui/http/router.ts`
  路由分发。

- Create: `src/ui/http/handlers/*.ts`
  各 API handler。

- Create: `src/cli/commands/ui.ts`
  `webforge ui` 命令入口。

- Modify: `src/cli/index.ts`
  注册新命令。

- Create: `src/testing/unit/ui-project-scanner.test.ts`
  扫描器测试。

- Create: `src/testing/unit/ui-read-models.test.ts`
  聚合 read model 测试。

- Create: `src/testing/unit/ui-command.test.ts`
  CLI 命令测试。

- Create: `src/testing/unit/ui-http.test.ts`
  API 测试。

- Modify: `README.md`
  增加 Web UI 使用方式。

- Modify: `docs/manuals/operations.md`
  增加 UI 使用场景。

- Modify: `docs/manuals/command-reference.md`
  增加 `webforge ui` 命令说明。

## Task 1: 建立 UI 构建管线与 CLI 入口骨架

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts`
- Create: `ui/index.html`
- Create: `ui/src/main.tsx`
- Create: `ui/src/App.tsx`
- Create: `src/cli/commands/ui.ts`
- Modify: `src/cli/index.ts`
- Test: `src/testing/unit/ui-command.test.ts`

- [ ] **Step 1: 先为 `webforge ui` 命令写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { createProgram } from '../../cli/index.js';

describe('ui command bootstrap', () => {
  it('应注册 ui 命令', () => {
    const names = createProgram().commands.map((command) => command.name());
    expect(names).toContain('ui');
  });
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run: `npm run test:unit -- src/testing/unit/ui-command.test.ts`
Expected: FAIL，提示 `ui` 命令未注册。

- [ ] **Step 3: 增加 Web UI 依赖与脚本**

```json
{
  "scripts": {
    "build": "tsc && vite build",
    "ui:dev": "vite"
  }
}
```

- [ ] **Step 4: 建立 Vite + React 前端最小骨架**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 5: 增加 `webforge ui` 命令骨架**

```ts
export function createUiCommand(): Command {
  return new Command('ui')
    .option('--root <path>')
    .option('--host <host>', '127.0.0.1')
    .option('--port <port>', '4173')
    .action(async (options) => {
      await startUiServer(options);
    });
}
```

- [ ] **Step 6: 运行命令级测试和构建**

Run: `npm run test:unit -- src/testing/unit/ui-command.test.ts`
Expected: PASS

Run: `npm run build`
Expected: PASS，前端静态资源输出到 `dist/ui/`，CLI 继续可编译。

- [ ] **Step 7: Commit**

```bash
git add package.json vite.config.ts ui src/cli/commands/ui.ts src/cli/index.ts src/testing/unit/ui-command.test.ts
git commit -m "feat: scaffold web ui build and command entry"
```

## Task 2: 实现项目扫描与目录发现

**Files:**
- Create: `src/ui/project-scanner.ts`
- Create: `src/ui/project-registry.ts`
- Test: `src/testing/unit/ui-project-scanner.test.ts`

- [ ] **Step 1: 先写扫描器失败测试**

```ts
it('应在根目录下发现带 .webforge 的项目', async () => {
  const projects = await scanProjects('/tmp/projects');
  expect(projects.map((item) => item.name)).toContain('alpha');
});
```

- [ ] **Step 2: 运行测试，确认扫描器尚未实现**

Run: `npm run test:unit -- src/testing/unit/ui-project-scanner.test.ts`
Expected: FAIL，提示 `scanProjects` 未定义或结果为空。

- [ ] **Step 3: 实现目录扫描与剪枝**

```ts
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);
```

- [ ] **Step 4: 为每个项目生成稳定元数据**

```ts
{
  id,
  name,
  rootPath,
  workspacePath,
  updatedAt,
  readable
}
```

- [ ] **Step 5: 增加 registry 缓存与刷新方法**

```ts
export class ProjectRegistry {
  async refresh(rootPath: string): Promise<ProjectRecord[]> { /* ... */ }
}
```

- [ ] **Step 6: 重新运行扫描测试**

Run: `npm run test:unit -- src/testing/unit/ui-project-scanner.test.ts`
Expected: PASS，能正确发现项目、跳过无关目录、标记不可读路径。

- [ ] **Step 7: Commit**

```bash
git add src/ui/project-scanner.ts src/ui/project-registry.ts src/testing/unit/ui-project-scanner.test.ts
git commit -m "feat: add web ui project scanning"
```

## Task 3: 实现只读聚合层与 HTTP API

**Files:**
- Create: `src/ui/read-models/overview.ts`
- Create: `src/ui/read-models/tasks.ts`
- Create: `src/ui/read-models/recovery.ts`
- Create: `src/ui/read-models/artifacts.ts`
- Create: `src/ui/read-models/runtime.ts`
- Create: `src/ui/http/server.ts`
- Create: `src/ui/http/router.ts`
- Create: `src/ui/http/handlers/projects.ts`
- Create: `src/ui/http/handlers/project-overview.ts`
- Create: `src/ui/http/handlers/project-runtime.ts`
- Test: `src/testing/unit/ui-read-models.test.ts`
- Test: `src/testing/unit/ui-http.test.ts`

- [ ] **Step 1: 为 read model 写失败测试**

```ts
it('应把 doctor、resume、onboard、runtime logs 聚合为 recovery summary', async () => {
  const summary = await buildRecoverySummary(projectRoot);
  expect(summary.contextDrift.status).toBeDefined();
  expect(summary.threadLinkage.status).toBeDefined();
});
```

- [ ] **Step 2: 运行测试，确认聚合函数尚未实现**

Run: `npm run test:unit -- src/testing/unit/ui-read-models.test.ts src/testing/unit/ui-http.test.ts`
Expected: FAIL，提示 read model 或 API handler 缺失。

- [ ] **Step 3: 复用现有 core/cli 读取逻辑实现 read models**

```ts
const doctor = await buildDoctorReport(projectRoot);
const resume = await buildResumeSummary(projectRoot);
const onboarding = await buildOnboardingSummary(projectRoot);
const runtimeLogs = await buildRuntimeLogsSummary(projectRoot);
```

- [ ] **Step 4: 暴露只读 API**

```ts
GET /api/projects
GET /api/projects/:id/overview
GET /api/projects/:id/runtime
GET /api/projects/:id/recovery
```

- [ ] **Step 5: 增加结构化错误返回**

```ts
res.writeHead(404, { 'content-type': 'application/json' });
res.end(JSON.stringify({ error: 'project_not_found' }));
```

- [ ] **Step 6: 重新运行 read model 和 API 测试**

Run: `npm run test:unit -- src/testing/unit/ui-read-models.test.ts src/testing/unit/ui-http.test.ts`
Expected: PASS，API 能稳定返回 overview / recovery / runtime 数据。

- [ ] **Step 7: Commit**

```bash
git add src/ui/read-models src/ui/http src/testing/unit/ui-read-models.test.ts src/testing/unit/ui-http.test.ts
git commit -m "feat: add web ui read models and api"
```

## Task 4: 实现多项目总览页与应用框架

**Files:**
- Create: `ui/src/theme.ts`
- Create: `ui/src/lib/api.ts`
- Create: `ui/src/components/layout/AppFrame.tsx`
- Create: `ui/src/components/projects/ProjectCard.tsx`
- Create: `ui/src/components/projects/ProjectStatusSummary.tsx`
- Create: `ui/src/routes/ProjectsPage.tsx`
- Modify: `ui/src/App.tsx`

- [ ] **Step 1: 先搭建页面骨架与路由**

```tsx
<Routes>
  <Route path="/" element={<ProjectsPage />} />
</Routes>
```

- [ ] **Step 2: 建立 Mantine AppShell 和全局 theme**

```tsx
<MantineProvider theme={theme}>
  <AppFrame>{children}</AppFrame>
</MantineProvider>
```

- [ ] **Step 3: 实现 `/api/projects` 的前端轮询客户端**

```ts
export async function getProjects(): Promise<ProjectOverviewCard[]> {
  const response = await fetch('/api/projects');
  return response.json();
}
```

- [ ] **Step 4: 实现多项目总览页**

页面至少展示：

- 扫描根目录
- 最后刷新时间
- 项目总数
- 每个项目的健康状态、任务分布、drift、最近 runtime

- [ ] **Step 5: 先跑本地前端构建**

Run: `npm run build`
Expected: PASS，首页可构建，静态资源可被 HTTP server 提供。

- [ ] **Step 6: Commit**

```bash
git add ui/src/theme.ts ui/src/lib/api.ts ui/src/components/layout ui/src/components/projects ui/src/routes/ProjectsPage.tsx ui/src/App.tsx
git commit -m "feat: add web ui projects overview"
```

## Task 5: 实现项目详情、文档浏览与 runtime 观察页

**Files:**
- Create: `ui/src/components/projects/RecoveryPanel.tsx`
- Create: `ui/src/components/projects/RuntimeEventsPanel.tsx`
- Create: `ui/src/routes/ProjectOverviewPage.tsx`
- Create: `ui/src/routes/ProjectArtifactsPage.tsx`
- Create: `ui/src/routes/ProjectRuntimePage.tsx`
- Modify: `ui/src/App.tsx`

- [ ] **Step 1: 扩展路由**

```tsx
<Route path="/projects/:id" element={<ProjectOverviewPage />} />
<Route path="/projects/:id/artifacts" element={<ProjectArtifactsPage />} />
<Route path="/projects/:id/runtime" element={<ProjectRuntimePage />} />
```

- [ ] **Step 2: 实现项目总览 dashboard**

至少包含：

- recovery 面板
- task 分布
- deliverable 摘要
- runtime 摘要
- superpowers / workflowContext / threadLinkage

- [ ] **Step 3: 实现文档与交付物浏览页**

至少包含：

- knowledge 列表
- deliverables 列表
- sessions 列表
- 预览区

- [ ] **Step 4: 实现 runtime 观察页**

至少包含：

- 最近 runtime 事件
- 当前快照与日志快照对比
- drift 信号
- checkpoint 列表

- [ ] **Step 5: 运行构建并人工 spot-check**

Run: `npm run build`
Expected: PASS

Manual check:
- 首页能进入单项目详情
- 详情页能切换 artifacts / runtime
- 无项目时有空状态

- [ ] **Step 6: Commit**

```bash
git add ui/src/components/projects/RecoveryPanel.tsx ui/src/components/projects/RuntimeEventsPanel.tsx ui/src/routes/ProjectOverviewPage.tsx ui/src/routes/ProjectArtifactsPage.tsx ui/src/routes/ProjectRuntimePage.tsx ui/src/App.tsx
git commit -m "feat: add web ui project detail views"
```

## Task 6: 文档、验证与 harness 自验证闭环

**Files:**
- Modify: `README.md`
- Modify: `docs/manuals/operations.md`
- Modify: `docs/manuals/command-reference.md`
- Modify: `scripts/smoke-agent-onboarding.mjs` (only if needed for new build assumptions)

- [ ] **Step 1: 更新 README 的 Web UI 使用方式**

至少写清：

- `webforge ui --root <path>`
- 它是本地只读监控台
- 它和 `.webforge/` 的关系

- [ ] **Step 2: 更新手册**

至少写清：

- 场景化使用方式
- `webforge ui` 的命令含义
- 它不执行写操作

- [ ] **Step 3: 跑完整验证**

Run: `npm run build`
Expected: PASS

Run: `npm run smoke:onboarding`
Expected: PASS，现有 onboarding 流程未被 UI 引入的改动打坏。

Run: `npm run test:coverage`
Expected: PASS，覆盖率阈值继续满足。

- [ ] **Step 4: 做一次手动 UI smoke**

建议步骤：

```bash
webforge ui --root ~/projects
```

确认：

- 能扫描出多个项目
- 首页能展示项目卡片
- 单项目页能读取 `.webforge` 信息
- 无写操作副作用

- [ ] **Step 5: Commit**

```bash
git add README.md docs/manuals/operations.md docs/manuals/command-reference.md
git commit -m "docs: add web ui usage guidance"
```

