# WebForge Web UI 重构设计

> **状态：** 已在对话中确认，等待实现
> **日期：** 2026-03-31
> **范围：** 重构现有 Web UI，使其从“卡片化后台”转为更克制的研究终端式监控台，并保持 WebForge 的只读 harness 观察定位。

---

## 1. 设计目标

本次重构不是补功能，而是纠正方向。

当前 Web UI 在技术上已经能看多项目、任务、runtime、deliverables、recovery，但视觉和版式仍然过度依赖：

- 大卡片
- 大圆角
- 指标块堆叠
- 状态 pill 泛滥
- 过强的装饰性背景与 glow

这让界面更像通用 AI dashboard，而不像一个严肃的项目研究终端。

本次重构的目标是：

1. 保留当前只读监控能力，不改 WebForge 作为 repo-side harness 的定位
2. 以 Mantine UI 原生组件为主，减少自定义视觉干预
3. 把信息组织从“卡片展示”改成“索引、总表、侧栏、时间线、预览”
4. 让首页、详情页、artifact 页、runtime 页都更像工作台，而不是营销式产品页

## 2. 已确认边界

以下边界已经在对话中确认：

1. 仍然是多项目、本地启动、只读的 Web UI
2. 继续内置在 `webforge` CLI 中，通过 `webforge ui` 启动
3. 继续扫描一个根目录下所有带 `.webforge/` 的项目
4. 前端组件库以 Mantine UI 原生组件为主
5. 不追求重品牌化，不做额外强风格包装
6. 不再以“大卡片 dashboard”作为默认版式语言

## 3. 视觉基线

### 3.1 视觉气质

新版气质定义为：

> `research terminal`

它应该更接近：

- 项目观察台
- 研究工作台
- 档案索引终端

而不是：

- 企业后台
- AI 控制台模板
- 统计卡片墙

### 3.2 视觉约束

新版应遵守以下约束：

- 优先使用 Mantine 原生浅色主题与默认节奏
- 尽量不自定义复杂背景、纹理、渐变发光
- 圆角收回到 Mantine 默认或接近默认
- 以 `Table`、`Paper`、`Tabs`、`NavLink`、`Alert`、`Badge`、`ScrollArea` 为核心原语
- 以“行、列、区块、时间线、预览”组织信息，而不是大卡片

### 3.3 明确移除的现有风格

以下现有表现应被移除或明显弱化：

- 首页项目大卡片
- metric card 泛滥
- 强 glow 与大面积渐变背景
- 夸张圆角
- 深色块套亮色块的强营销式对比
- 页面到处都是胶囊式状态 pill

## 4. 总体信息架构

### 4.1 首页 `/`

首页不再是项目卡片墙，而改成三栏研究终端结构：

1. `Project Index`
   左侧项目索引列表

   每个项目仅显示：
   - 名称
   - 路径
   - health
   - 最近 runtime 时间
   - 是否存在 blocked / pending review / drift

2. `Workspace Ledger`
   中间主视图，使用表格作为核心观察面

   每行一个项目，主要列：
   - project
   - recovery
   - runtime
   - tasks
   - review
   - drift
   - thread/workflow
   - next action

3. `Signal Rail`
   右侧信号栏，只显示需要关注的异常和恢复线索：
   - blocked 项目
   - pending review 项目
   - drifted 项目
   - 最近 runtime 事件
   - 最近 superpowers run

首页顶部只保留一条薄 header，显示：

- `Coding Forge Monitor`
- 当前扫描根目录
- 刷新时间
- 项目总数

### 4.2 项目详情 `/projects/:id`

详情页不再把每个子页都做成独立的卡片集合，而是统一成一个稳定骨架：

- 顶部：项目名、路径、少量状态 badge
- 主体：`Tabs`
  - `Summary`
  - `Evidence`
  - `Runtime`
- 布局：`主栏 + 右侧恢复栏`

右侧恢复栏固定显示：

- doctor summary
- next action
- workflow context
- thread linkage
- drift summary
- recommended actions

这样恢复线索在所有视角下都稳定可见，不再散落在不同页面中。

## 5. 各页面落版

### 5.1 Summary 视角

目标：看清项目总体态势。

主栏应包含：

- recovery posture 摘要
- task distribution
- ready / blocked / pending review 列表
- runtime pulse 摘要

不再把这些内容拆成一堆独立统计卡，而是更偏：

- 小型摘要区块
- 列表
- 紧凑分栏

### 5.2 Evidence 视角

目标：做成资源浏览器，而不是三列大盒子。

推荐结构：

- 左侧：artifact type 导航
  - knowledge
  - deliverables
  - sessions
- 中间：当前类别条目列表
- 右侧：preview pane

preview pane 显示：

- 标题
- metadata
- path
- 文本预览

核心体验应接近“浏览器”而不是“内容卡片展板”。

### 5.3 Runtime 视角

目标：看 runtime 事件流与恢复状态的关系。

推荐结构：

- 顶部：少量摘要
  - runtime status
  - last event
  - drift
  - checkpoints
- 中部主区：
  - `Recent events` 时间线/列表
  - `Snapshots comparison`
    - runtime log snapshot
    - current workspace snapshot
- 次级区：
  - drift reasons
  - checkpoint list
  - mailbox / superpowers signals

Runtime 页的主角应是：

- 事件流
- 快照对照
- 漂移原因

而不是四排统计块。

## 6. Mantine 使用原则

本次重构对 Mantine 的使用原则如下：

1. 优先直接使用 Mantine UI 原生视觉，不做重 theme 包装
2. 优先使用这些组件：
   - `AppShell`
   - `Paper`
   - `Table`
   - `Tabs`
   - `NavLink`
   - `Badge`
   - `Alert`
   - `ScrollArea`
   - `Stack`
   - `Group`
3. 页面观感主要由信息架构和组件组合产生，而不是由大量自定义 CSS 产生
4. 仅保留必要的品牌标识和轻量色彩映射，不做强品牌化监控台外壳

## 7. 与现有数据模型的关系

这次是 UI 重构，不改数据事实源。

必须继续遵守：

- `.webforge/` 是唯一事实源
- UI 继续消费现有 read model 和 API
- 不引入第二套 recovery / runtime / task 语义

现有这些能力仍然要完整保留：

- 多项目扫描
- overview / tasks / artifacts / runtime / recovery 聚合接口
- `workflowContext`
- `threadLinkage`
- `contextDrift`
- `doctor / resume / onboard / logs runtime` 的只读语义

## 8. 重构重点

这次实现应优先处理以下重构重点：

1. 主题与全局样式收口
   去掉过重的背景、渐变、阴影、圆角

2. 首页重排
   从项目卡片墙重构为项目索引 + 总表 + 信号栏

3. 详情页骨架统一
   用统一骨架承载 `Summary / Evidence / Runtime`

4. Artifact 浏览体验重构
   从三列均分盒子重构为资源浏览器

5. Runtime 页重构
   从 stats-card + panel 重构为事件流 + 快照对照

## 9. 验收标准

当以下条件满足时，本次重构可视为达标：

1. 首页不再以项目大卡片作为主结构
2. 详情页不再依赖大面积统计卡和胶囊导航
3. Mantine 原生组件成为主要视觉语言
4. 页面仍能完整查看：
   - 项目列表
   - 任务状态
   - deliverables / knowledge / sessions
   - runtime events
   - checkpoints
   - workflow context / thread linkage / drift
5. 与当前只读 API 和 CLI 语义保持一致
6. 界面整体观感从“通用 AI dashboard”转为“克制的研究终端”

## 10. 结论

这次 Web UI 重构的核心，不是“再做一个更花的 dashboard”，而是：

> 把现有 WebForge 监控能力，重新组织成一个更克制、更可靠、更像研究终端的观察界面。

它的成功标准不是装饰性，而是：

- 信息更清晰
- 结构更稳定
- Mantine 使用更自然
- WebForge 的运行状态更容易被持续观察
