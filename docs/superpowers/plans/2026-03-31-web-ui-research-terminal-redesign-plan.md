# Web UI Research Terminal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 WebForge Web UI 从大卡片式 dashboard 重构为 Mantine 原生优先、研究终端气质的只读监控台。

**Architecture:** 保留现有 `src/ui/` 只读 API 和扫描/聚合层，不改 `.webforge/` 语义，只重构前端信息架构与页面骨架。首页改为 `Project Index + Workspace Ledger + Signal Rail`，项目详情页改为统一 `Tabs + Recovery Rail` 骨架，`Evidence` 和 `Runtime` 视图改为资源浏览器与事件工作台。补充最小 DOM 测试，确保页面结构不再回退到卡片墙。

**Tech Stack:** TypeScript, React 19, Mantine 8, React Router 6, Vitest, jsdom, Testing Library

---

**Spec Reference:** `docs/superpowers/specs/2026-03-31-webforge-web-ui-design.md`

## 文件结构与职责

- Modify: `package.json`
  增加前端 DOM 测试依赖。

- Modify: `vitest.config.ts`
  为 UI DOM 测试留出可执行路径，不改现有 coverage 边界。

- Modify: `ui/src/theme.ts`
  收口主题与全局样式，去掉重背景、重 glow、大圆角和营销式视觉层。

- Modify: `ui/src/App.tsx`
  保持路由结构，但接入新的整体骨架。

- Modify: `ui/src/components/layout/AppFrame.tsx`
  从“海报式头部”改成薄 header 和终端式页面骨架。

- Create: `ui/src/components/projects/ProjectIndexPanel.tsx`
  首页左侧项目索引。

- Create: `ui/src/components/projects/WorkspaceLedgerTable.tsx`
  首页主表格视图。

- Create: `ui/src/components/projects/SignalRail.tsx`
  首页右侧异常/恢复信号栏。

- Modify or Delete: `ui/src/components/projects/ProjectCard.tsx`
  不再作为首页主结构；若仅剩零星用途则删除。

- Create: `ui/src/components/projects/ProjectDetailShell.tsx`
  项目详情共享骨架，负责标题、Tabs 和双栏布局。

- Create: `ui/src/components/projects/ProjectRecoveryRail.tsx`
  右侧固定恢复栏，承载 doctor / next action / workflow / thread / drift。

- Modify: `ui/src/routes/ProjectsPage.tsx`
  重写首页结构，使用索引 + 总表 + 信号栏。

- Modify: `ui/src/routes/ProjectOverviewPage.tsx`
  收口为 `Summary` 视角，接入共享详情骨架。

- Modify: `ui/src/routes/ProjectArtifactsPage.tsx`
  改为资源浏览器布局。

- Modify: `ui/src/routes/ProjectRuntimePage.tsx`
  改为事件流 + 快照对照布局。

- Modify: `ui/src/components/projects/RecoveryPanel.tsx`
  拆掉深色营销面板写法，作为 `Summary` 主栏中的摘要区块。

- Modify: `ui/src/components/projects/RuntimeEventsPanel.tsx`
  从 stats-card 组合改成时间线/事件工作台。

- Create: `ui/src/components/projects/ArtifactBrowser.tsx`
  统一 artifacts 页三栏浏览器布局。

- Create: `ui/src/components/projects/RuntimeSnapshotComparison.tsx`
  负责 runtime log snapshot 与 current workspace snapshot 的对照。

- Create: `ui/src/testing/render-app.tsx`
  UI 渲染辅助，封装 MantineProvider 和 MemoryRouter。

- Create: `ui/src/testing/projects-page.test.tsx`
  首页结构测试。

- Create: `ui/src/testing/project-detail-shell.test.tsx`
  项目详情骨架测试。

- Modify: `README.md`
  更新 Web UI 说明，强调研究终端式监控台定位。

- Modify: `docs/manuals/operations.md`
  更新使用说明与页面理解方式。

- Modify: `docs/manuals/command-reference.md`
  更新 `webforge ui` 的界面说明。

## Task 1: 建立 UI DOM 测试支撑并收口主题基线

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Modify: `ui/src/theme.ts`
- Modify: `ui/src/components/layout/AppFrame.tsx`
- Create: `ui/src/testing/render-app.tsx`
- Create: `ui/src/testing/projects-page.test.tsx`

- [ ] **Step 1: 为首页结构先写失败测试**

```tsx
// @vitest-environment jsdom
it('renders project index, workspace ledger and signal rail', async () => {
  render(<ProjectsPage />);
  expect(await screen.findByText(/Project Index/i)).toBeInTheDocument();
  expect(screen.getByText(/Workspace Ledger/i)).toBeInTheDocument();
  expect(screen.getByText(/Signal Rail/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试，确认当前布局不满足新结构**

Run: `npm run test:unit -- ui/src/testing/projects-page.test.tsx`
Expected: FAIL，缺少 `Project Index` / `Workspace Ledger` / `Signal Rail`。

- [ ] **Step 3: 增加 DOM 测试依赖和渲染辅助**

```json
{
  "devDependencies": {
    "@testing-library/react": "...",
    "@testing-library/jest-dom": "...",
    "jsdom": "..."
  }
}
```

- [ ] **Step 4: 收口主题和 AppFrame**

```ts
export const forgeTheme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'sm'
});
```

要求：
- 去掉全局网格背景、径向 glow、大圆角和厚阴影
- Header 改为薄而稳定的工作台头部

- [ ] **Step 5: 重新运行首页结构测试**

Run: `npm run test:unit -- ui/src/testing/projects-page.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.ts ui/src/theme.ts ui/src/components/layout/AppFrame.tsx ui/src/testing/render-app.tsx ui/src/testing/projects-page.test.tsx
git commit -m "test: add ui layout harness for redesign"
```

## Task 2: 重构首页为 Index + Ledger + Signal Rail

**Files:**
- Modify: `ui/src/routes/ProjectsPage.tsx`
- Create: `ui/src/components/projects/ProjectIndexPanel.tsx`
- Create: `ui/src/components/projects/WorkspaceLedgerTable.tsx`
- Create: `ui/src/components/projects/SignalRail.tsx`
- Modify or Delete: `ui/src/components/projects/ProjectCard.tsx`
- Test: `ui/src/testing/projects-page.test.tsx`

- [ ] **Step 1: 扩展首页测试，先锁定主表和项目索引行为**

```tsx
expect(screen.getByRole('table')).toBeInTheDocument();
expect(screen.getByRole('navigation', { name: /projects/i })).toBeInTheDocument();
expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
```

- [ ] **Step 2: 运行测试，确认当前页面仍然是旧卡片结构**

Run: `npm run test:unit -- ui/src/testing/projects-page.test.tsx`
Expected: FAIL，找不到主表或项目导航语义。

- [ ] **Step 3: 实现项目索引面板**

```tsx
<NavLink label={project.name} description={project.rootPath} />
```

要求：
- 紧凑列表
- 不使用大卡片

- [ ] **Step 4: 实现 Workspace Ledger 主表**

```tsx
<Table>
  <Table.Thead>...</Table.Thead>
  <Table.Tbody>...</Table.Tbody>
</Table>
```

要求：
- 列出 recovery/runtime/tasks/review/drift/next action
- 用小 badge 和行级信息代替指标块

- [ ] **Step 5: 实现 Signal Rail**

```tsx
<Paper>
  <Stack>
    <Alert>Blocked</Alert>
  </Stack>
</Paper>
```

要求：
- 只展示异常项目和最近信号
- 不堆 stats 卡

- [ ] **Step 6: 移除首页对 ProjectCard 的依赖**

```tsx
// 删除 ProjectsPage 中的 <ProjectCard ... />
```

- [ ] **Step 7: 重新运行首页测试**

Run: `npm run test:unit -- ui/src/testing/projects-page.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add ui/src/routes/ProjectsPage.tsx ui/src/components/projects/ProjectIndexPanel.tsx ui/src/components/projects/WorkspaceLedgerTable.tsx ui/src/components/projects/SignalRail.tsx ui/src/components/projects/ProjectCard.tsx ui/src/testing/projects-page.test.tsx
git commit -m "feat: redesign web ui projects overview"
```

## Task 3: 统一项目详情骨架与恢复侧栏

**Files:**
- Create: `ui/src/components/projects/ProjectDetailShell.tsx`
- Create: `ui/src/components/projects/ProjectRecoveryRail.tsx`
- Modify: `ui/src/routes/ProjectOverviewPage.tsx`
- Modify: `ui/src/routes/ProjectArtifactsPage.tsx`
- Modify: `ui/src/routes/ProjectRuntimePage.tsx`
- Create: `ui/src/testing/project-detail-shell.test.tsx`

- [ ] **Step 1: 为详情骨架先写失败测试**

```tsx
// @vitest-environment jsdom
it('renders tabs with a persistent recovery rail', async () => {
  render(<ProjectOverviewPage />);
  expect(await screen.findByRole('tab', { name: /Summary/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Evidence/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Runtime/i })).toBeInTheDocument();
  expect(screen.getByText(/Next action/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试，确认当前详情页还没有统一骨架**

Run: `npm run test:unit -- ui/src/testing/project-detail-shell.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现共享 ProjectDetailShell**

```tsx
<Stack>
  <ProjectHeader />
  <Tabs value={tab}>...</Tabs>
  <Grid>
    <Grid.Col span={8}>{children}</Grid.Col>
    <Grid.Col span={4}><ProjectRecoveryRail ... /></Grid.Col>
  </Grid>
</Stack>
```

- [ ] **Step 4: 实现 ProjectRecoveryRail**

```tsx
<Paper>
  <Stack>
    <Text>Doctor</Text>
    <Text>Next action</Text>
    <Text>Workflow context</Text>
  </Stack>
</Paper>
```

要求：
- 不用深色宣传式 panel
- 结构稳定、信息紧凑

- [ ] **Step 5: 将三个详情路由统一接到共享骨架**

```tsx
return (
  <ProjectDetailShell project={...} tab="summary" recovery={...}>
    <SummaryContent ... />
  </ProjectDetailShell>
);
```

- [ ] **Step 6: 重新运行详情骨架测试**

Run: `npm run test:unit -- ui/src/testing/project-detail-shell.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/projects/ProjectDetailShell.tsx ui/src/components/projects/ProjectRecoveryRail.tsx ui/src/routes/ProjectOverviewPage.tsx ui/src/routes/ProjectArtifactsPage.tsx ui/src/routes/ProjectRuntimePage.tsx ui/src/testing/project-detail-shell.test.tsx
git commit -m "feat: unify project detail shell for web ui"
```

## Task 4: 重构 Summary / Evidence / Runtime 三个主视图

**Files:**
- Modify: `ui/src/components/projects/RecoveryPanel.tsx`
- Modify: `ui/src/components/projects/RuntimeEventsPanel.tsx`
- Create: `ui/src/components/projects/ArtifactBrowser.tsx`
- Create: `ui/src/components/projects/RuntimeSnapshotComparison.tsx`
- Modify: `ui/src/routes/ProjectOverviewPage.tsx`
- Modify: `ui/src/routes/ProjectArtifactsPage.tsx`
- Modify: `ui/src/routes/ProjectRuntimePage.tsx`
- Test: `ui/src/testing/project-detail-shell.test.tsx`

- [ ] **Step 1: 先扩展详情测试，锁定三种视图的关键结构**

```tsx
expect(screen.getByText(/Ready now/i)).toBeInTheDocument();
expect(screen.getByText(/Preview/i)).toBeInTheDocument();
expect(screen.getByText(/Recent events/i)).toBeInTheDocument();
expect(screen.getByText(/Snapshots comparison/i)).toBeInTheDocument();
```

- [ ] **Step 2: 运行测试，确认旧视图结构不满足新布局**

Run: `npm run test:unit -- ui/src/testing/project-detail-shell.test.tsx`
Expected: FAIL

- [ ] **Step 3: 重写 Summary 视角**

要求：
- `RecoveryPanel` 改成浅色紧凑摘要区
- 任务区以列表和小摘要为主
- 不再堆叠大号 metric cards

- [ ] **Step 4: 实现 ArtifactBrowser**

```tsx
<Group align="stretch">
  <Tabs orientation="vertical">...</Tabs>
  <ScrollArea>{list}</ScrollArea>
  <Paper>{preview}</Paper>
</Group>
```

- [ ] **Step 5: 重写 RuntimeEventsPanel 与 SnapshotComparison**

```tsx
<Stack>
  <Paper>{eventTimeline}</Paper>
  <SimpleGrid cols={2}>
    <RuntimeSnapshotComparison ... />
  </SimpleGrid>
</Stack>
```

要求：
- 主角是事件流和双快照对照
- drift reasons 放在次级区
- 仅保留少量 summary，不做 stats 墙

- [ ] **Step 6: 重新运行详情视图测试**

Run: `npm run test:unit -- ui/src/testing/project-detail-shell.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/projects/RecoveryPanel.tsx ui/src/components/projects/RuntimeEventsPanel.tsx ui/src/components/projects/ArtifactBrowser.tsx ui/src/components/projects/RuntimeSnapshotComparison.tsx ui/src/routes/ProjectOverviewPage.tsx ui/src/routes/ProjectArtifactsPage.tsx ui/src/routes/ProjectRuntimePage.tsx ui/src/testing/project-detail-shell.test.tsx
git commit -m "feat: redesign project views for research terminal ui"
```

## Task 5: 文档收口与全量验证

**Files:**
- Modify: `README.md`
- Modify: `docs/manuals/operations.md`
- Modify: `docs/manuals/command-reference.md`
- Optionally Modify: `docs/superpowers/plans/2026-03-31-web-ui-monitoring-plan.md`

- [ ] **Step 1: 更新 README 中的 UI 定位**

要求：
- 明确新版是“研究终端式监控台”
- 说明 Mantine 原生优先与只读定位

- [ ] **Step 2: 更新操作手册和命令参考**

要求：
- 解释首页三栏
- 解释详情页共享骨架
- 解释 Evidence / Runtime 两个主要工作视角

- [ ] **Step 3: 运行前端相关测试**

Run: `npm run test:unit -- ui/src/testing/projects-page.test.tsx ui/src/testing/project-detail-shell.test.tsx src/testing/unit/ui-http.test.ts src/testing/unit/ui-command.test.ts`
Expected: PASS

- [ ] **Step 4: 运行全量验证**

Run: `npm run build`
Expected: PASS

Run: `npm run test:coverage`
Expected: PASS，现有全局阈值仍满足

Run: `npm run smoke:onboarding`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md docs/manuals/operations.md docs/manuals/command-reference.md docs/superpowers/plans/2026-03-31-web-ui-monitoring-plan.md
git commit -m "docs: update web ui guidance for redesigned monitor"
```
