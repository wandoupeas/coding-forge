# WebForge 操作手册

这份手册面向人类开发者。

如果你想知道：

- WebForge 到底怎么用
- 新项目怎么起盘
- 已有项目怎么继续
- 每个阶段该敲什么命令

就看这份文档。

如果你是按命令查参数、选项和子命令，直接看：

- [`docs/manuals/command-reference.md`](./command-reference.md)

如果你想按“场景”而不是按命令阅读，直接看：

- [`docs/manuals/scenario-playbooks.md`](./scenario-playbooks.md)

如果你想看当前内部工程进展，直接看：

- [`docs/milestones/2026-03-31-v0.1-internal-progress.md`](../milestones/2026-03-31-v0.1-internal-progress.md)

如果你是正在仓库里工作的 `Codex` 或 `Claude Code`，优先看：

- [`AGENTS.md`](../../AGENTS.md)
- [`docs/agent-guide.md`](../agent-guide.md)

## 1. 先理解这套框架

WebForge 不是新的编排器，也不是替代 `Codex` / `Claude Code` 的外层工具。

它的职责是：

- 在仓库里建立 `.webforge/` 这套持久化状态空间
- 用 `tasks / runtime / sessions / knowledge / deliverables` 保存项目真相
- 提供一组观察和校验命令，帮助人和 agent 在新会话里恢复工作

一句话：

`Codex / Claude Code` 是干活的 agent。  
WebForge 是它们工作的仓库内 harness。

## 2. 典型使用方式

你通常会有两种使用方式。

### 方式 A：把 WebForge 当成“框架仓库”

也就是当前这个仓库只负责提供 CLI 和契约，真正业务项目在别的目录。

先在 WebForge 仓库里构建 CLI：

```bash
cd <webforge-root>
npm install
npm run build
```

下文默认你已经能直接使用 `webforge`。

如果还没有把 CLI 放进 `PATH`，把文中的 `webforge` 替换成：

```bash
node <webforge-root>/dist/cli/index.js
```

然后你有两种调用方式：

1. 直接调用构建产物

```bash
node <webforge-root>/dist/cli/index.js --help
```

2. 如果你自己做了 shell alias 或 `npm link`

```bash
webforge --help
```

### 方式 B：在目标仓库里按 WebForge 契约工作

初始化目标仓库：

```bash
webforge init demo-app
cd demo-app
```

初始化后会生成：

- `.webforge/`
- `.webforge/superpowers-runs.json`
- `.webforge/threads.json`
- `AGENTS.md`
- `docs/agent-guide.md`
- `docs/methodology/superpowers-integration.md`

如果你已经有多个按 WebForge 契约工作的项目，希望统一观察它们的进度，也可以直接启动本地监控台：

```bash
webforge ui --root ~/projects
```

它会扫描这个根目录下所有包含 `.webforge/config.yaml` 或 `.webforge/runtime.json` 的项目，并提供只读的总览、详情、文档预览和 runtime 观察页。

## 3. 新项目起盘

新项目从 0 开始时，推荐顺序如下。

### 第一步：初始化

```bash
webforge init demo-app
cd demo-app
```

如果你后面改了模板、想确认初始化后自检还成立，可以显式重跑：

```bash
webforge verify init
webforge verify init --json
```

这一步会检查 onboarding protocol 文档、`doctor`、`onboard` 三者是否仍然一致。

### 第二步：做第一次 onboarding

```bash
webforge onboard --json
```

你会拿到：

- `doctor` 报告
- `resume` 简报
- `shouldRead`
- `runtimeLogCommand`
- `recoveryReadiness`
- `recommendedActions`

其中 `resume.runtimeLog` 现在会直接告诉你：

- 最近一次 runtime 日志对应的恢复上下文
- 当前工作区的恢复上下文
- 这两者是否已经 `contextDrift`

如果只是你自己先看文本版，也可以：

```bash
webforge doctor
webforge resume
webforge dashboard
```

### 第三步：导入需求材料

```bash
webforge knowledge add docs/prd.md -c requirements
webforge knowledge parse
webforge knowledge list
```

`knowledge add` 负责把文档拷进 `.webforge/knowledge/`。  
`knowledge parse` 负责生成可供规划使用的 parsed 结果。

### 第四步：生成规划

```bash
webforge plan
```

常见变体：

```bash
webforge plan --force
webforge plan --no-superpowers
webforge plan --execution inline
```

`plan` 会把阶段图、任务图、技术栈和 superpowers hints 写回 `.webforge/`。

如果这之后你实际跑了某个 `superpowers` workflow，再补一条回写：

```bash
webforge superpowers record writing-plans \
  --summary "approved spec converted into execution plan" \
  --artifact plan:docs/superpowers/plans/demo-plan.md \
  --task T001
```

### 第五步：执行 ready tasks

先预览：

```bash
webforge run --dry-run
```

再执行：

```bash
webforge run
```

执行后重点查看：

```bash
webforge deliverables
webforge dashboard
webforge logs runtime
```

### 第六步：审核交付物

按 task 审：

```bash
webforge review T001 --approve -m "looks good"
```

按 deliverable 审：

```bash
webforge review del-001 --reject -m "needs changes"
```

## 4. 已有项目继续开发

如果仓库已经有 `.webforge/`，最推荐的入口就是：

```bash
webforge onboard --json
```

解释顺序：

1. 先看 `canProceed`
2. 再看 `doctor.summary.fail`
3. 再看 `recoveryReadiness.overallStatus`
4. 然后看 `resume.nextAction`
5. 再只读 `shouldRead`
6. 如有需要，执行 `runtimeLogCommand`

`recoveryReadiness` 主要用来回答：

- 当前 `workflow context` 还能不能沿着原来的 `branch / worktree / thread` 继续恢复
- 最近一次 `superpowers run` 指向的 artifact 或 worktree 是否已经失效
- 如果做过 `strategic-compact`，当前 `compactFromSession` 对应的恢复线索是否还可用

如果你习惯显式拆开：

```bash
webforge doctor --json
webforge resume --json
webforge logs runtime --json
```

其中 `logs runtime --json` 不只是事件日志，还会同时给出“这条日志对应的恢复快照”和“当前工作区恢复快照”。

现在 `doctor --json` 也会补一个 `runtime-context-drift` 检查，直接告诉你最近 runtime 上下文是否已经和当前工作区脱节。

## 5. 日常工作流

### 看当前状态

```bash
webforge onboard --json
webforge dashboard
webforge logs runtime
```

### 看多个项目的整体运行情况

```bash
webforge ui --root ~/projects
```

推荐按这个顺序看：

1. 首页：先看项目数、blocked、pending review、drift
2. 单项目 `Overview`：看 recovery、任务分布、交付物摘要、runtime 状态
3. 单项目 `Artifacts`：看 knowledge、deliverables、sessions 的文本预览
4. 单项目 `Runtime`：看最近 runtime 事件、日志快照 vs 当前工作区快照、checkpoint 队列

这条 UI 路径是只读的，不会改写 `.webforge/`，适合拿来持续观察正在运行的项目。

### 看任务和交付物

```bash
webforge deliverables
webforge deliverables T001
```

### 看协作消息

```bash
webforge mailbox list
webforge mailbox read backend
webforge mailbox read reviewer --all
```

### 看检查点

```bash
webforge checkpoint list
webforge checkpoint rollback <checkpoint-id> --restore-deliverables
```

## 6. 与 superpowers 怎么配合

WebForge 管状态和恢复。  
`superpowers` 管方法。

推荐边界：

- 问题还在发散：`brainstorming`
- spec 已经稳定：`writing-plans`
- 计划已定，要分波次推进：`subagent-driven-development`
- 会话太长，需要压缩：`strategic-compact`

配合规则：

- `superpowers` 负责方法，不直接拥有项目状态
- workflow 结束后，用 `webforge superpowers record ...` 把产物回写到
  `.webforge/superpowers-runs.json`
- 让后续 session 通过 `resume / onboard / doctor` 读到这些 workflow 产物

不要把 `superpowers` 当成：

- `.webforge/` 的替代品
- 任务状态数据库
- runtime 调度器

## 7. 常见问题

### 1. `doctor` 有 fail，能不能直接继续开发？

不建议。  
先修仓库契约，再继续。

### 2. `resume` 说没有 ready task，怎么办？

按顺序看：

1. `deliverables/index.json` 是否有 `pending_review`
2. `tasks.json` 是否有 `blocked`
3. `logs runtime` 是否能解释上次为什么停下
4. 如确实需要，重新 `plan --force`

### 3. `run` 为什么把任务标成 `blocked`？

当前 runtime 已支持 permission profile 差异。

- `read-only`
  会直接阻止 ready task 自动执行
- `approval-required`
  允许执行，但会强制把交付物送审

### 4. 我应该优先看哪份文档？

推荐顺序：

1. [`README.md`](../../README.md)
2. [`docs/manuals/command-reference.md`](./command-reference.md)
3. [`docs/agent-guide.md`](../agent-guide.md)
4. [`docs/examples/minimal-agent-onboarding.md`](../examples/minimal-agent-onboarding.md)

## 10. 使用 Web UI 做项目监控

Web UI 适合这几种场景：

- 你同时跑着多个 WebForge 项目，想统一看健康状态
- 你不想每个项目都单独敲 `dashboard / logs runtime`
- 你想让人类开发者快速浏览 `.webforge/knowledge/`、deliverable 和 session 内容

启动方式：

```bash
webforge ui --root ~/projects
```

常用选项：

- `--root <path>`：扫描根目录
- `--host <host>`：默认 `127.0.0.1`
- `--port <port>`：默认 `4173`

进入后可以重点看：

- 首页项目卡片
  适合先看 ready / blocked / pending review 和 recovery health
- `Overview`
  适合判断现在是否能继续做、下一步应该看哪一类状态
- `Artifacts`
  适合查看 PRD、设计说明、交付物草稿、session 快照
- `Runtime`
  适合判断最近一次 runtime 和当前工作区是否已经 drift，以及 checkpoint 是否可回看

如果你主要是让 agent 恢复工作，仍然优先用：

```bash
webforge onboard --json
```

Web UI 是观察面，不替代 `onboard / doctor / resume / logs runtime` 这条恢复协议。
