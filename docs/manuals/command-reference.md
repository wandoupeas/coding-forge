# WebForge 命令参考

这份文档按“什么时候用什么命令”来组织，而不是按源码文件组织。

下文默认你已经可以直接使用：

```bash
webforge
```

如果你还没有把 CLI 放进 `PATH`，请把文中的 `webforge` 替换成：

```bash
node <webforge-root>/dist/cli/index.js
```

## 1. 初始化与进入工作

### `webforge init <project-name>`

初始化一个新的 WebForge 工作仓库。

会创建：

- `.webforge/`
- `.webforge/superpowers-runs.json`
- `.webforge/threads.json`
- `AGENTS.md`
- `docs/agent-guide.md`
- `docs/methodology/superpowers-integration.md`
- `docs/examples/agent-onboarding-protocol.md`

并且会立即执行一次初始化后自检，确认：

- `doctor.fail = 0`
- `onboard.canProceed = true`
- onboarding protocol 文档和实际 `onboard` 输出没有脱节

常用示例：

```bash
webforge init demo-app
webforge init demo-app --template default
```

### `webforge onboard [--json]`

统一的 onboarding 入口。

适合你刚进入一个仓库，不确定当前是否能继续工作时使用。

输出包含：

- `doctor`
- `resume`
- `shouldRead`
- `runtimeLogCommand`
- `recoveryReadiness`
- `recommendedActions`

其中 `recoveryReadiness` 会额外告诉你：

- 当前 `workflowContext` 是 `ready / blocked / none`
- 最近一次 `superpowers run` 是 `ready / blocked / none`
- 当前 `threadLinkage` 是 `ready / blocked / none`
- 缺失的是 `artifact`、`worktree`、`compact session`、`thread object`，还是其中多个

如果当前上下文带 `threadId`，`shouldRead` 还会把 `.webforge/threads.json` 和该 thread 对应的 artifacts 一起带出来。

`recommendedActions` 现在还会结合 `resume.runtimeLog.contextDrift`，直接告诉你是“沿当前上下文继续”，还是“先回看历史 runtime 再决定”。

常用示例：

```bash
webforge onboard
webforge onboard --json
```

## 2. 契约校验与恢复

### `webforge doctor [--json]`

检查仓库契约和观察入口是否完整。

重点看：

- `summary.fail`
- `guidance`
- `runtime-observability`
- `runtime-context-drift`
- `mailbox-observability`
- `review-observability`
- `checkpoint-observability`

常用示例：

```bash
webforge doctor
webforge doctor --json
```

### `webforge verify init [project-path] [--json]`

显式重跑“初始化后自检”。

它会复用 `init` 结束时那套校验逻辑，确认：

- `docs/examples/agent-onboarding-protocol.md` 存在
- `doctor.fail = 0`
- `doctor.warn = 0`
- `onboard.canProceed = true`
- `onboard.shouldRead` 里仍然包含 `AGENTS.md`

适合在这些时候使用：

- 你刚手工调整过初始化模板
- 你想确认 onboarding 协议文档和实际 CLI 输出没有漂移
- 你想验证某个新初始化出来的项目目录是否仍然满足最小接入合同

常用示例：

```bash
webforge verify init
webforge verify init demo-app
webforge verify init demo-app --json
```

### `webforge resume [--json]`

生成恢复简报，告诉你下一步应该做什么。

重点字段：

- `nextAction`
- `shouldRead`
- `readyCount`
- `blockedCount`
- `pendingReviewCount`
- `runtimeLog`
- `threadLinkage`

其中 `threadLinkage` 会告诉你：

- 当前 `threadId` 是否有正式的 thread linkage 对象
- 该 thread 对应的 `artifact / worktree` 是否仍然可恢复
- 当前状态是 `none / ready / blocked`

其中 `runtimeLog` 现在会额外带上：

- 日志对应的 `workflowContext / threadLinkage`
- 当前工作区的 `currentWorkflowContext / currentThreadLinkage`
- `contextDrift`
  用来告诉你这条 runtime 日志对应的恢复上下文是否已经和当前工作区漂移

常用示例：

```bash
webforge resume
webforge resume --json
```

### `webforge dashboard [--watch]`

查看当前 workspace 的总观察面。

会展示：

- agent 简报
- runtime 状态
- 当前 workflow context
- 当前 thread linkage
- 最近一次 runtime observation
- 任务统计
- 阶段状态
- ready task
- pending review
- blocked task
- 最近会话

常用示例：

```bash
webforge dashboard
webforge dashboard --watch
```

### `webforge logs runtime [session-id] [--json]`

查看最近一次或指定 session 的 runtime 观察日志。

- 文本模式会区分“日志恢复快照”和“当前工作区恢复快照”，再显示事件流
- `--json` 模式会保留日志对应的 `workflowContext / threadLinkage`，并额外带上 `currentWorkflowContext / currentThreadLinkage`

常用示例：

```bash
webforge logs runtime
webforge logs runtime runtime-session-001
webforge logs runtime --json
```

### `webforge superpowers record <workflow>`

把外部 `superpowers` workflow 的结果回写到 `.webforge/superpowers-runs.json`。

常用选项：

- `--summary <text>`
- `--artifact <path>` 或 `--artifact <kind:path>`
- `--task <task-id>`
- `--session <session-id>`
- `--owner <worker-id>`
- `--wave <wave-id>`
- `--thread <thread-id>`
- `--branch <branch>`
- `--worktree <path>`
- `--compact-from <session-id>`
- `--json`

常用示例：

```bash
webforge superpowers record writing-plans \
  --summary "approved spec converted into execution plan" \
  --artifact plan:docs/superpowers/plans/demo-plan.md \
  --task T001

webforge superpowers record strategic-compact \
  --summary "session compacted with a handoff note" \
  --artifact compact-handoff:.webforge/knowledge/decisions/compact-note.md \
  --session sess-001 \
  --compact-from sess-000
```

## 3. 知识摄入

### `webforge knowledge add <files...> [-c category]`

把需求、设计、数据文档复制到 `.webforge/knowledge/`。

支持格式：

- `.md`
- `.txt`
- `.docx`
- `.pdf`
- `.xlsx`
- `.xls`

分类建议：

- `requirements`
- `design`
- `data`
- `decisions`
- `raw`

常用示例：

```bash
webforge knowledge add docs/prd.md -c requirements
webforge knowledge add docs/architecture.pdf docs/ui.docx -c design
```

### `webforge knowledge parse [file] [-c category] [-o output]`

把知识文档解析成 Markdown。

规则：

- 不传 `file` 时，解析全部知识文档
- `-c` 可以只解析某个分类
- `-o` 指定自定义输出目录

常用示例：

```bash
webforge knowledge parse
webforge knowledge parse -c requirements
webforge knowledge parse docs/spec.docx
```

### `webforge knowledge list [-c category]`

列出当前知识库中的文档。

常用示例：

```bash
webforge knowledge list
webforge knowledge list -c requirements
```

## 4. 规划与执行

### `webforge plan`

从 knowledge index 生成阶段图、任务图、技术栈和 superpowers hints。

如果后续实际执行了某个 `superpowers` workflow，记得再用
`webforge superpowers record ...` 把结果继续回写到 `.webforge/`。

常用选项：

- `--force`
- `--no-superpowers`
- `--execution inline`
- `--template auto|web|backend|mobile`
- `--interactive false`

常用示例：

```bash
webforge plan
webforge plan --force
webforge plan --execution inline
webforge plan --no-superpowers
```

### `webforge run`

执行 ready 队列中的任务。

注意：

- 这是 runtime 的兼容入口
- 当前主逻辑在 `runtime core`
- `--phase`、`--worker`、`--execution`、`--no-superpowers` 主要是兼容保留项

常用选项：

- `--dry-run`
- `--limit <count>`
- `--session <id>`

常用示例：

```bash
webforge run --dry-run
webforge run
webforge run --limit 2
webforge run --session manual-run-001
```

### `webforge deliverables [task-id]`

查看全部交付物，或查看某个任务的交付物。

常用示例：

```bash
webforge deliverables
webforge deliverables T001
```

### `webforge review <target>`

审核交付物。`target` 可以是 deliverable ID，也可以是 task ID。

常用选项：

- `--approve`
- `--reject`
- `-m, --comment <comment>`
- `--all`

注意：

- 当前实现里，如果不传 `--reject`，默认会按“通过审核”处理
- 实际使用时建议显式写 `--approve` 或 `--reject`
- 按 task 审核时，默认只处理 `pending_review`
- 加 `--all` 才会包含该 task 下的其他交付物

常用示例：

```bash
webforge review T001 --approve -m "looks good"
webforge review del-001 --reject -m "needs changes"
webforge review T001 --approve --all
```

## 5. 协作与通信

### `webforge mailbox list`

列出已发现的 worker mailbox，并显示未读数。

### `webforge mailbox read <worker>`

读取指定 worker 的 mailbox。

常用选项：

- `--all`
- `--mark-read`

常用示例：

```bash
webforge mailbox list
webforge mailbox read backend
webforge mailbox read reviewer --all
webforge mailbox read backend --mark-read
```

### `webforge mailbox clear <worker>`

清空指定 worker 的 mailbox。

常用示例：

```bash
webforge mailbox clear reviewer
```

## 6. 检查点与恢复

### `webforge checkpoint list`

列出当前 workspace 的所有检查点。

### `webforge checkpoint rollback <checkpoint-id>`

回滚到指定检查点。

常用选项：

- `--restore-deliverables`

常用示例：

```bash
webforge checkpoint list
webforge checkpoint rollback cp-001
webforge checkpoint rollback cp-001 --restore-deliverables
```

## 7. 最常用的三条路径

### 新项目起盘

```bash
webforge init demo-app
cd demo-app
webforge onboard --json
webforge knowledge add docs/prd.md -c requirements
webforge knowledge parse
webforge plan
webforge run
```

### 已有项目继续开发

```bash
webforge onboard --json
webforge logs runtime
webforge dashboard
```

### 交付物审核与恢复

```bash
webforge deliverables
webforge review T001 --approve -m "looks good"
webforge checkpoint list
```
