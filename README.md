# WebForge

WebForge 是一个面向 Coding Agent 的 `agent-first harness` 参考实现。  
它的目标不是替 agent 做决策，而是把项目状态、执行上下文、恢复机制和协作协议稳定地落在仓库里。

最重要的一点：

> 你应该直接使用 `Codex` 或 `Claude Code` 在仓库里工作，而 WebForge 负责约束和辅助它们如何工作。

## 它是什么

- 一个可持久化的 workspace contract
- 一组围绕 `.webforge/` 运行的 core services
- 一个 ready-task runtime 主循环
- 一层以观察和校验为主的轻量 CLI
- 一套能与 `superpowers` 共存的工程方法

## 它不是什么

- 不是把 CLI 当成主控制面的工作流引擎
- 不是 if/else 驱动的伪 agent 编排器
- 不是只靠聊天上下文维持连续性的工具
- 不是把 `superpowers` 当成唯一记忆源的包装器

## 核心模型

```text
用户目标
  -> Coding Agent
  -> WebForge workspace contract (.webforge/)
  -> WebForge repo-side harness contract
  -> planning/context/runtime core
  -> deliverables / code / sessions
```

真正的项目真相位于 `.webforge/`：

- `runtime.json`：当前执行状态
- `tasks.json` / `phases.json`：任务图与阶段图
- `knowledge/index.json`：知识入口
- `deliverables/index.json`：交付物索引
- `sessions/index.json`：跨会话恢复入口

## 快速开始

先构建 CLI：

```bash
npm install
npm run build
```

如果你是 npm 使用者，安装方式会是：

```bash
npm install -g @wandoupeas/coding-forge
```

或者直接临时运行：

```bash
npx @wandoupeas/coding-forge --help
```

然后初始化一个新仓库：

```bash
node dist/cli/index.js init demo-app
```

这一步会同时生成：

- `.webforge/` workspace contract
- `AGENTS.md`
- `docs/agent-guide.md`
- `docs/methodology/superpowers-integration.md`

初始化完成后，进入新仓库先运行：

```bash
node dist/cli/index.js doctor
```

如果你希望让正在仓库里工作的 agent 直接消费结构化状态，可以使用：

```bash
node dist/cli/index.js doctor --json
node dist/cli/index.js resume --json
```

这两个命令分别回答：

- 仓库契约是否完整
- 当前 agent 下一步应该做什么

如果你想用本地 Web UI 统一查看多个 WebForge 项目，可以直接启动：

```bash
node dist/cli/index.js ui --root ~/projects
```

如果你已经通过 npm 安装，则等价命令是：

```bash
webforge ui --root ~/projects
```

这个 UI 当前是只读监控台，会自动扫描根目录下带 `.webforge/` 的项目，并提供一套更接近“研究终端”的观察面：

- 首页 `Project Index + Workspace Ledger + Signal Rail`
- 单项目统一 `Summary / Evidence / Runtime` 骨架
- knowledge / deliverables / sessions 的资源浏览器
- runtime 事件流、双快照对照、checkpoint / drift / mailbox / superpowers 观察

## 怎么使用

如果你是人类开发者，先看这两份：

- [`docs/manuals/operations.md`](docs/manuals/operations.md)
- [`docs/manuals/command-reference.md`](docs/manuals/command-reference.md)
- [`docs/manuals/scenario-playbooks.md`](docs/manuals/scenario-playbooks.md)

如果你是正在仓库里工作的 `Codex` 或 `Claude Code`，先看这两份：

- [`AGENTS.md`](AGENTS.md)
- [`docs/agent-guide.md`](docs/agent-guide.md)

推荐最短使用路径：

```bash
node dist/cli/index.js init demo-app
cd demo-app
node /path/to/work-forge/dist/cli/index.js onboard --json
```

如果你已经通过 npm 安装，则等价命令是：

```bash
webforge init demo-app
cd demo-app
webforge onboard --json
```

`init` 会同时生成带 onboarding contract 的 `AGENTS.md`、`docs/agent-guide.md`、`docs/methodology/superpowers-integration.md`，以及可直接照着执行的 `docs/examples/agent-onboarding-protocol.md`。初始化结束时还会立即跑一次 post-init self-check，确认 `doctor` 和 `onboard` 与这些协议文件保持一致。

如果你想显式重跑这次自检，可以直接执行：

```bash
node /path/to/work-forge/dist/cli/index.js verify init demo-app --json
```

如果你是 npm 安装用户，则直接执行：

```bash
webforge verify init demo-app --json
```

然后：

1. 读取 `shouldRead`
2. 导入需求到 `.webforge/knowledge/`
3. 运行 `plan`
4. 运行 `run`
5. 用 `dashboard / logs runtime / deliverables / review` 观察和收口
   其中 `logs runtime --json` 会同时给出 runtime 事件流、这条日志对应的恢复快照，以及当前工作区恢复快照

如果你需要并行观察多个项目，则直接开 Web UI：

```bash
webforge ui --root ~/projects
```

推荐用法：

1. 在首页用 `Project Index` 快速切项目，用 `Workspace Ledger` 看当前快照，用 `Signal Rail` 盯住 blocked / pending review / drift
2. 进入单项目后，始终先看右侧 recovery rail，再决定沿 `Summary / Evidence / Runtime` 哪条视角继续
3. 在 `Evidence` 里把 knowledge / deliverable / session 当资源浏览器来读，而不是翻三列卡片
4. 在 `Runtime` 里优先看 `Recent events` 和 `Snapshots comparison`，再看 drift reasons 和 checkpoint

## 仓库结构

```text
.
├── AGENTS.md
├── README.md
├── ARCHITECTURE.md
├── docs/
│   ├── agent-guide.md
│   └── methodology/
├── src/
│   ├── core/
│   ├── agent/
│   ├── cli/
│   └── testing/
└── .webforge/              # 由 workspace 初始化后生成
```

## 五层分工

1. `workspace contract`
   `.webforge/` 的目录、文件、索引和字段约定。
2. `state services`
   `workspace / session / deliverable / mailbox / task` 等稳定持久化服务。
3. `execution core`
   `planning / context / runtime`，负责构建任务图和 ready-task 主循环。
4. `agent facade`
   `Agent` 只接收 `{ task, context }`，返回标准结果。
5. `workflow enhancement layer`
   `superpowers` 等方法增强层，负责“怎么做更稳”，不负责“项目真相是什么”。

## 与 superpowers 的关系

WebForge 和 `superpowers` 不是互相替代的关系：

- WebForge 负责项目状态、恢复和执行协议
- `superpowers` 负责设计、计划、评审、compact、线程化恢复等工作方法

一句话：

> WebForge 决定项目如何运作；superpowers 决定某类工作如何做得更稳。

## 当前实现重点

- `src/core/planning.ts`
  从 knowledge index 构建任务图与阶段图
- `src/core/context.ts`
  为任务构建统一执行上下文
- `src/core/runtime.ts`
  按 ready 队列执行 `claim -> context -> agent.execute -> persist`
- `src/agent/`
  只保留标准执行门面与 handler
- `src/cli/`
  只保留兼容层和观察入口
  包括 `init / plan / run / onboard / resume / dashboard / doctor / superpowers / knowledge / logs / deliverables / review / checkpoint / mailbox`

## 适配对象

这套设计优先兼容：

- Codex
- Claude Code

兼容方式不是强行统一交互体验，而是统一仓库内事实模型：

- 统一读 `.webforge/`
- 统一写 `.webforge/`
- 统一通过 runtime / session / thread linkage / deliverable / knowledge 恢复上下文

## Codex / Claude Code 接入范式

如果你是人类开发者在仓库里工作，推荐顺序是：

```bash
node dist/cli/index.js doctor
node dist/cli/index.js resume
node dist/cli/index.js dashboard
```

如果你是希望让 agent 直接消费仓库状态，推荐顺序是：

```bash
node dist/cli/index.js onboard --json
```

或者显式拆开：

```bash
node dist/cli/index.js doctor --json
node dist/cli/index.js resume --json
```

标准含义：

1. `onboard --json`
   一次性输出 `doctor + resume + runtime log + recoveryReadiness` 的统一握手结果。
2. `doctor --json`
   先判断仓库契约是否完整，再决定能否直接继续工作。
3. `resume --json`
   获取当前 `nextAction`、`shouldRead`、`readyCount`、`blockedCount`、`pendingReviewCount`。
4. 读取 `shouldRead` 里的文件。
5. 如问题还在发散，用 `brainstorming`；如 spec 已经稳定，用 `writing-plans`。
6. 如果使用了 `superpowers` workflow，把结果用 `webforge superpowers record ...` 回写到 `.webforge/superpowers-runs.json`。
7. 执行工作，并把结果回写到 `.webforge/`。

一句话：

> `doctor` 先回答“仓库能不能继续”，`resume` 再回答“现在应该做什么”。

`onboard --json` 里的 `recoveryReadiness` 会继续回答第三个问题：

> 当前 `workflow context / latest superpowers run / thread linkage` 指向的 `artifact / worktree / compact / thread` 线索还能不能直接恢复。

## 推荐阅读顺序

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `docs/manuals/operations.md`
4. `docs/manuals/scenario-playbooks.md`
5. `docs/manuals/command-reference.md`
6. `docs/agent-guide.md`

## 里程碑说明

如果你想看当前内部工程进展、已完成能力、验证状态和下一阶段建议，直接看：

- [`docs/milestones/2026-03-31-v0.1-internal-progress.md`](docs/milestones/2026-03-31-v0.1-internal-progress.md)
6. `docs/methodology/harness-principles.md`
7. `docs/methodology/superpowers-integration.md`
8. `docs/examples/minimal-agent-onboarding.md`

## 本地验证

常用验证命令：

```bash
npm run test:unit
npm run build
npm run smoke:onboarding
node dist/cli/index.js --help
node dist/cli/index.js doctor
```

常用结构化观察命令：

```bash
node dist/cli/index.js onboard --json
node dist/cli/index.js doctor --json
node dist/cli/index.js resume --json
node dist/cli/index.js logs runtime --json
```

常用 workflow 回写命令：

```bash
node dist/cli/index.js superpowers record writing-plans \
  --summary "approved spec converted into execution plan" \
  --artifact plan:docs/superpowers/plans/demo-plan.md \
  --task T001
```

## 项目状态

当前仓库正在向 WebForge v0.2 收敛：

- `runtime` 已成为唯一主循环
- CLI 已缩减为兼容层
- 文档正在统一到 harness-first 叙事
