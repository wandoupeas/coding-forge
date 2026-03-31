# WebForge Web UI 设计

> **状态：** 已在对话中确认，现写入仓库供审阅
> **日期：** 2026-03-31
> **范围：** 为 WebForge 增加一个内置的、本地启动的、多项目只读 Web UI，用于查看项目运行状态、文档、任务、日志、恢复线索与协作信号。

---

## 1. 目标

这一版 Web UI 的目标非常明确：

- 让使用了 `.webforge/` 的多个项目可以在一个本地总控台里统一查看。
- 把当前已经存在的 CLI 观察面能力，变成更连续、更直观的可视化界面。
- 保持 `WebForge = repo-side harness` 的定位不变，UI 只是事实源的读取与投影层，不是新的控制面。
- 保持与 `Codex / Claude Code + superpowers` 的整体方法一致：由 agent 执行工作，由 harness 提供状态、恢复、观察与协作协议。

v1 的成功标准不是“可控制项目”，而是“能稳定看清项目”。

## 2. 约束与已确认边界

以下边界已经在对话中确认：

1. **多项目总控台**
   不是只看单个项目，而是能查看一个根目录下多个带 `.webforge/` 的项目。

2. **内置在当前仓库**
   Web UI 不拆成独立仓库，而是作为 `coding-forge` / `webforge` CLI 的一部分，通过新命令启动本地服务。

3. **v1 只读**
   初版不做任务操作、回滚、审核动作、运行控制，也不做文档在线编辑。

4. **自动扫描根目录**
   通过扫描一个工作根目录来发现所有带 `.webforge/` 的项目，而不是手工逐个注册。

5. **技术栈方向已确认**
   - 主组件库：`Mantine`
   - 复杂表格：`TanStack Table`
   - 图表：`Recharts`

6. **实现时应使用 `frontend-design` skill**
   UI 不能做成普通后台模板，要有明确的视觉方向和信息层次。

## 3. 非目标

v1 明确不做这些事情：

- 远程 SaaS 服务
- 多用户登录与权限系统
- 通过 UI 执行 `run / plan / checkpoint rollback`
- 在线编辑 `.webforge/` 或项目源代码
- WebSocket / SSE 实时推送
- 跨机器或跨网络代理查看本地项目

这些内容可以在后续版本继续演进，但不属于当前设计范围。

## 4. 设计驱动因素

### 4.1 现有仓库已经具备 UI 读取条件

当前 WebForge 已经具备一套比较完整的只读观察基础：

- `.webforge/` 是稳定事实源
- `doctor --json`
- `resume --json`
- `onboard --json`
- `logs runtime --json`
- `superpowers-runs`
- `threadLinkage`
- `workflowContext`
- `contextDrift`

这意味着 Web UI 不需要再发明第二套项目模型，而应该直接消费已有状态。

### 4.2 UI 的价值不在“多一个命令”，而在“信息连续性”

CLI 现在已经能回答很多问题，但跨项目切换、日志阅读、任务分布、交付物与恢复线索的关联观察，在终端里仍然是碎片化的。

Web UI 的价值在于：

- 一个地方看多个项目
- 一个地方同时看任务、交付物、日志、恢复线索
- 用更稳定的信息层次呈现 drift、blocked、pending review、thread linkage 等状态

### 4.3 UI 不能破坏现有契约

UI 必须遵守以下原则：

- `.webforge/` 仍然是唯一事实源
- 只读投影不能篡改状态语义
- 不允许 UI 和 CLI 各自维护两套 `doctor / resume / recovery` 解释逻辑

## 5. 总体方案

推荐方案是：

**CLI 内嵌轻量 HTTP server + 只读 JSON API + 本地前端应用**

顶层结构如下：

```text
webforge ui --root <projects-root>
  -> project scanner
  -> read-model aggregation services
  -> local HTTP API
  -> web dashboard
  -> poll-based refresh
```

这是一套本地工作台，而不是远程控制台。

## 6. 模块设计

### 6.1 CLI 入口

新增命令形态：

```bash
webforge ui
webforge ui --root ~/projects
webforge ui --port 4173
webforge ui --host 127.0.0.1
```

职责：

- 启动本地服务
- 指定扫描根目录
- 指定服务端口
- 输出本地访问地址

CLI 命令本身不承担扫描逻辑或投影逻辑。

### 6.2 项目扫描层

这一层负责扫描某个根目录下所有带 `.webforge/` 的项目。

每个项目最少需要得到以下元信息：

- `projectId`
- `name`
- `rootPath`
- `workspacePath`
- 最近修改时间
- 是否可读取

约定：

- 只把检测到 `.webforge/config.yaml` 或 `.webforge/runtime.json` 的目录视为候选项目
- 不做递归无限扫描，应有最大深度或合理剪枝
- 对不可读取目录要有错误状态，而不是直接忽略

### 6.3 只读聚合层

这是 Web UI 的核心。

它不直接把原始 `.json` 文件暴露给前端，而是先做成稳定的 read model。

建议至少拆出以下聚合服务：

1. `project overview`
   项目名、路径、最近 runtime、任务分布、待审数量、drift 状态、可恢复性摘要

2. `task summary`
   task 总数、ready / blocked / in_progress / completed / pending_review 分布，以及关键任务列表

3. `runtime summary`
   当前 runtime 状态、最近 session、最近事件、最近失败/阻塞原因

4. `deliverable summary`
   最近交付物、按状态分布、待审交付物、按任务查看

5. `knowledge summary`
   knowledge 索引、已解析文档、requirements / design / decisions 分类

6. `mailbox summary`
   worker mailbox 列表、未读数、最近消息

7. `checkpoint summary`
   checkpoint 列表、最近 checkpoint、可回滚信息摘要

8. `recovery summary`
   `doctor / resume / onboard / logs runtime` 的聚合视图

9. `superpowers summary`
   最近 workflow run、`workflowContext`、`threadLinkage`、`compactFromSession`

### 6.4 HTTP API

v1 只做只读 JSON API。

建议的接口集合：

- `GET /api/projects`
- `GET /api/projects/:id/overview`
- `GET /api/projects/:id/tasks`
- `GET /api/projects/:id/deliverables`
- `GET /api/projects/:id/knowledge`
- `GET /api/projects/:id/mailboxes`
- `GET /api/projects/:id/checkpoints`
- `GET /api/projects/:id/recovery`
- `GET /api/projects/:id/runtime`
- `GET /api/projects/:id/runtime/logs`

API 设计原则：

- 返回聚合结果，不返回零散文件路径拼图
- 保持和现有 CLI 语义一致
- 明确标出 `ready / blocked / none / drifted` 等状态枚举
- 对读取失败返回结构化错误，而不是 500 文本

### 6.5 前端应用

前端建议做成一个轻量 SPA。

路由结构建议：

- `/`
  多项目总览
- `/projects/:id`
  项目总览 dashboard
- `/projects/:id/artifacts`
  文档、交付物、session、knowledge 浏览
- `/projects/:id/runtime`
  runtime 日志、checkpoint、恢复状态

## 7. 页面信息架构

### 7.1 多项目总览页

目标：

- 在一屏内看清哪些项目健康、哪些项目阻塞、哪些项目在 drift、哪些项目待审

每个项目卡片建议包含：

- 项目名
- 根路径
- 最近 runtime 时间
- ready / blocked / pending review 数量
- drift 状态
- 是否可恢复
- 最近一次 `superpowers run`

顶部全局区域建议包含：

- 当前扫描根目录
- 最后刷新时间
- 项目总数
- 处于健康 / 警告 / 阻塞 状态的项目数量

### 7.2 单项目总览页

目标：

- 像一个只读控制面板一样，把任务、运行态、恢复态、交付物和方法层线索放在同一页

建议分为 4 个主区域：

1. `Recovery`
   - `doctor` 摘要
   - `resume.nextAction`
   - `contextDrift`
   - `workflowContext`
   - `threadLinkage`

2. `Tasks`
   - 任务状态分布
   - ready 列表
   - blocked 列表
   - pending review 任务

3. `Artifacts`
   - deliverables
   - knowledge
   - sessions

4. `Runtime`
   - 最近 session
   - 最近事件
   - 最近失败/阻塞原因
   - mailbox 摘要

### 7.3 文档与交付物页

目标：

- 快速查看，不编辑

建议包含：

- knowledge 分类树
- deliverables 列表
- session 列表
- spec / plan / decision 文档入口
- 文本预览区

### 7.4 日志与恢复页

目标：

- 把 CLI 里的 `logs runtime --json`、`doctor --json`、`resume --json`、`onboard --json` 的关系可视化

建议包含：

- runtime event timeline
- 日志对应快照
- 当前工作区快照
- drift 对比
- checkpoint 列表
- 最近 mailbox / review 信号

## 8. 刷新模型

v1 建议使用**轮询刷新**，而不是 WebSocket。

推荐策略：

- 总览页：每 5 秒刷新
- 单项目 runtime 页：每 3 秒刷新
- 文档浏览页：手动刷新或更低频率

原因：

- 当前状态数据都在本地文件系统
- 轮询足够支持监控场景
- 能明显降低 v1 的工程复杂度

## 9. 技术选型

### 9.1 前端

- 主组件库：`Mantine`
- 复杂表格：`TanStack Table`
- 图表：`Recharts`

选择理由：

- `Mantine` 很适合 dashboard 外壳、导航和内容区结构
- `TanStack Table` 更适合后续扩展任务、交付物、mailbox 这类复杂表格
- `Recharts` 足够支撑初版的状态分布和趋势图

### 9.2 后端

- Node.js + TypeScript
- 轻量 HTTP server
- 复用 `src/core/` 的现有只读逻辑与状态语义

### 9.3 设计约束

真正开始实现 Web UI 时，必须使用 `frontend-design` skill。

这意味着：

- 不做通用后台模板风
- 需要明确的视觉方向
- 需要有项目监控产品感，而不是普通 CRUD 面板感
- 重点强化信息层次、状态色彩、日志阅读体验、密度与可读性的平衡

## 10. 与现有 CLI / Core 的关系

Web UI 不应该另起一套读取逻辑。

应尽量复用或抽象这些现有能力：

- `doctor`
- `resume`
- `onboard`
- `logs runtime`
- `workspace`
- `session`
- `deliverable`
- `mailbox`
- `superpowers runs`
- `threads`

如果当前某些 CLI 逻辑不适合复用，应该把它们下沉成更通用的 read service，而不是在 UI 中重复实现。

## 11. 风险与注意事项

### 11.1 读取一致性风险

如果前端页面、HTTP API、CLI 三处各自定义自己的状态语义，后面一定会裂。

应对策略：

- 统一由聚合层产出 read model
- CLI 和 UI 尽量共享底层读取逻辑

### 11.2 扫描性能风险

扫描一个很大的项目根目录时，可能遇到性能问题。

应对策略：

- 做目录深度限制
- 跳过 `node_modules`、`.git`、`dist`、`coverage` 等目录
- 为扫描结果做缓存和刷新机制

### 11.3 UI 贪多风险

一旦在 v1 就加上写操作、实时推送和复杂权限控制，项目复杂度会快速失控。

应对策略：

- v1 严格只读
- 先把观察面做稳

## 12. 验收标准

当以下条件全部满足时，可认为 v1 设计达标：

1. 能扫描一个工作根目录下多个带 `.webforge/` 的项目
2. 能展示多项目总览
3. 能进入单项目详情查看任务、runtime、交付物、恢复线索
4. 能查看 knowledge / deliverables / sessions / logs / checkpoint
5. 能读出 `workflowContext / threadLinkage / contextDrift`
6. 不修改任何 `.webforge/` 状态
7. 页面与现有 CLI 语义一致

## 13. 后续演进方向

v1 之后可以继续考虑：

- 轻量只读操作以外的受控操作
- 手动项目注册与扫描根目录并存
- WebSocket / SSE 实时推送
- 更强的日志筛选和时间线
- 远程查看模式

但这些都应建立在 v1 的只读观测面稳定之后。

## 14. 结论

这次 Web UI 的正确定位是：

> 一个内置在 `coding-forge` / `webforge` 中的、本地启动的、多项目只读监控工作台。

它不替代 `.webforge/`，也不替代 agent，更不替代 CLI。

它的价值在于：

- 让多个项目的状态更容易看清
- 让恢复、日志、任务、交付物和方法层线索更容易关联观察
- 让 WebForge 这套 harness 具备一个真正可视化的操作外壳

