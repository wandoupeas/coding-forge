# WebForge 命令参考

这份文档按"什么时候用什么命令"来组织，而不是按源码文件组织。

如果你想按"场景"阅读，而不是按命令查找，直接看 [`docs/manuals/scenario-playbooks.md`](./scenario-playbooks.md)。

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

默认还会补齐一套本地仓库门禁：

- `.githooks/pre-commit`
- `.githooks/commit-msg`
- `scripts/webforge-guard.mjs`

默认提交规范也会一并落地为 GitHub 风格单行主题：

- 格式：`<type>(<scope>): <task-id> <summary>`
- 示例：`feat(webforge): T024 unify commit convention`
- `commit-msg` hook 会校验主题格式和任务编号是否存在于 `.webforge/tasks.json`

如果项目根目录已经存在 `package.json`，`init` 还会补充：

- `scripts.webforge:doctor`
- `scripts.webforge:guard`
- `scripts.prepare`

当当前目录本身就是 git 仓库根目录时，`init` 会尝试直接设置：

- `git config core.hooksPath .githooks`

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

`recommendedActions` 现在还会结合 `resume.runtimeLog.contextDrift`，直接告诉你是"沿当前上下文继续"，还是"先回看历史 runtime 再决定"。

常用示例：

```bash
webforge onboard
webforge onboard --json
```

### `webforge ui [--root <path>] [--host <host>] [--port <port>]`

启动本地只读 Web UI，用来观察一个根目录下的多个 WebForge 项目。

当前 UI 会自动扫描根目录里带 `.webforge/config.yaml` 或 `.webforge/runtime.json` 的项目，并提供：

- 首页 `Project Index + Workspace Ledger + Signal Rail`
- 单项目统一 `Summary / Evidence / Runtime` 骨架
- `Evidence` 资源浏览器
- `Runtime` 事件流 + 双快照对照

适合这些场景：

- 你同时跑多个项目，想统一看 blocked / pending review / drift
- 你想让人类开发者快速浏览 knowledge、deliverables、sessions
- 你想通过页面持续观察 runtime pulse，而不是来回切终端

阅读方式建议：

1. 先在首页看 `Signal Rail`
2. 再用 `Workspace Ledger` 锁定具体项目
3. 进入详情页后先看右侧 `recovery rail`
4. 最后按 `Summary / Evidence / Runtime` 切换视角

常用示例：

```bash
webforge ui --root ~/projects
webforge ui --root ~/projects --port 4317
webforge ui --root ~/projects --host 0.0.0.0 --port 4317
```

注意：

- 当前是只读监控台，不执行 `run / review / rollback`
- 项目真相仍然在 `.webforge/`
- 对 agent 来说，恢复工作仍然优先使用 `onboard --json`

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

显式重跑"初始化后自检"。

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

补充说明：

- 纯文本输出会在存在学习记录时附带当前任务相关的智能提醒
- 如需显式获取提醒，可使用 `webforge learn remind --task <task-id>`

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

- 文本模式会区分"日志恢复快照"和"当前工作区恢复快照"，再显示事件流
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

### `webforge knowledge reindex`

重建 `.webforge/knowledge/index.json`。

适合这些场景：

- 有人手工改坏了 knowledge index
- 你想把散落在标准知识目录里的文档重新扫描进索引
- `doctor` 提示 `knowledge index integrity` 失败

常用示例：

```bash
webforge knowledge reindex
```

### `webforge knowledge list [-c category]`

列出当前知识库中的文档。

常用示例：

```bash
webforge knowledge list
webforge knowledge list -c requirements
```

### `webforge knowledge link <knowledge-id> <task-id>`

将知识文档与任务关联。

允许 agent 根据任务内容主动选择关联的知识文档，而不是让 plan 命令自动推断。

常用示例：

```bash
webforge knowledge link ADR-005 T010
webforge knowledge link frontend-guidelines T011
```

### `webforge knowledge infer <task-id>`

根据任务标题和模块自动推断并推荐关联的知识文档。

这是 plan 命令使用的自动推断逻辑的独立入口，供 agent 在需要时调用。

常用示例：

```bash
webforge knowledge infer T010
```

## 4. 任务管理

### `webforge task create <task-id>`

创建新任务。

常用选项：

- `-t, --title <title>` - 任务标题（必填）
- `-p, --phase <phase>` - 所属阶段，默认 P1
- `-d, --description <text>` - 任务描述
- `--priority <n>` - 优先级 1-5，默认 2
- `--depends-on <ids...>` - 依赖的任务 ID
- `--assignee <role>` - 负责人角色，默认 agent
- `--execution-mode <mode>` - 执行模式: `auto|manual`，默认 `auto`
- `-k, --knowledge <paths...>` - 关联的知识文档路径（支持简写如 ADR-005）
- `-m, --modules <modules...>` - 任务涉及的模块: frontend|backend|database|auth|testing|architecture|devops|pm
- `--no-auto-knowledge` - 禁用自动推断知识文档

**执行模式说明：**

- `auto` - 由 `webforge run` 通过 worker adapter 自动执行
- `manual` - 由 agent 直接执行，然后使用 `webforge record notify` 更新状态

常用示例：

```bash
# 创建自动执行的任务
webforge task create T010 \
  --title "实现用户登录接口" \
  --phase P2 \
  --depends-on T001 T002 \
  --execution-mode auto

# 创建手动执行的任务，指定知识文档和模块
webforge task create T011 \
  --title "前端性能优化" \
  --phase P2 \
  --knowledge ADR-005 frontend-guidelines \
  --modules frontend \
  --execution-mode manual
```

### `webforge task update <task-id>`

更新任务。

常用选项：

- `-t, --title <title>` - 任务标题
- `-d, --description <text>` - 任务描述
- `-s, --status <status>` - 任务状态: pending/ready/in_progress/blocked/completed/failed
- `--priority <n>` - 优先级 1-5
- `--add-knowledge <paths...>` - 添加关联的知识文档
- `--remove-knowledge <paths...>` - 移除关联的知识文档
- `-m, --modules <modules...>` - 任务涉及的模块
- `--no-auto-knowledge` - 禁用自动根据任务标题补全知识文档

常用示例：

```bash
# 更新任务状态
webforge task update T010 --status in_progress

# 添加知识文档关联
webforge task update T011 --add-knowledge security-guidelines
```

### `webforge task list`

列出任务。

常用选项：

- `-p, --phase <phase>` - 按阶段过滤
- `-s, --status <status>` - 按状态过滤

常用示例：

```bash
webforge task list
webforge task list --phase P2
webforge task list --status ready
```

### `webforge task show <task-id>`

查看任务详情。

常用示例：

```bash
webforge task show T010
```

## 5. 规划与执行

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
- 遇到 `executionMode=manual` 的任务会暂停并退出，等待 agent 手动完成

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

### `webforge record notify`

快速通知任务进度，无需运行完整的 runtime 循环。

适合 agent 直接工作在仓库中时，手动完成任务后立即更新状态。

常用选项：

- `--task <task-id>` - 指定任务 ID
- `--status <status>` - 设置任务状态: ready/in_progress/completed/failed
- `--auto` - 自动推断当前任务（基于 runtime 状态）
- `--propagate` - 传播依赖：当任务完成时，自动将依赖它的任务设为 ready
- `-m, --message <text>` - 进度消息

常用示例：

```bash
# 快速更新任务状态
webforge record notify --task T001 --status completed

# 自动推断当前任务并标记完成
webforge record notify --auto --status completed --message "完成了用户认证模块"

# 完成任务并传播依赖
webforge record notify --task T004 --status completed --propagate
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

- 当前实现里，如果不传 `--reject`，默认会按"通过审核"处理
- 实际使用时建议显式写 `--approve` 或 `--reject`
- 按 task 审核时，默认只处理 `pending_review`
- 加 `--all` 才会包含该 task 下的其他交付物

常用示例：

```bash
webforge review T001 --approve -m "looks good"
webforge review del-001 --reject -m "needs changes"
webforge review T001 --approve --all
```

## 6. 学习与提醒

### `webforge learn record <title>`

记录一个已纠正的错误，并把根因、修复方式和预防措施写入 `.webforge/learning/errors.json`。

适合这些场景：

- 用户刚纠正了 agent 的工作流错误
- 你刚修复了一个重复出现的问题
- 你想把本次纠正沉淀成可复习的记录

常用示例：

```bash
webforge learn record "忘记更新任务状态" \
  --category workflow \
  --severity medium \
  --cause "结束时未执行状态回写" \
  --prevention "完成任务后先执行 webforge task update"
```

### `webforge learn lesson <title>`

添加一条经验教训，供后续提醒和复习使用。

常用示例：

```bash
webforge learn lesson "优先使用 webforge CLI 回写状态" \
  --content "不要直接修改 .webforge/ 文件" \
  --priority high
```

### `webforge learn list`

列出最近记录的错误，支持按类别、严重级别和时间过滤。

常用示例：

```bash
webforge learn list
webforge learn list --category workflow --limit 10
```

### `webforge learn show <error-id>`

查看单条错误记录的详情。

### `webforge learn lessons`

查看所有经验教训，支持按类别和优先级过滤。

### `webforge learn review`

进入复习模式，集中查看最近错误与经验教训。

### `webforge learn report`

生成学习统计报告。

### `webforge learn remind [--task <task-id>]`

获取当前任务相关的学习提醒。

适合这些场景：

- 新会话刚恢复，希望先看高风险重复错误
- 某个任务之前已经被多次纠正
- 你想在动手前快速读一遍注意事项

常用示例：

```bash
webforge learn remind
webforge learn remind --task T001
```

## 7. 协作与通信

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

## 8. 检查点与恢复

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

## 9. 最常用的三条路径

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

### Agent 直接工作模式（手动任务）

```bash
# 1. 查看当前任务
webforge task list --status ready

# 2. 创建手动执行任务（executionMode=manual）
webforge task create T010 \
  --title "优化前端性能" \
  --execution-mode manual \
  --modules frontend

# 3. Agent 直接工作在仓库中完成任务...

# 4. 完成后通知进度
webforge record notify --task T010 --status completed --propagate
```

### 交付物审核与恢复

```bash
webforge deliverables
webforge review T001 --approve -m "looks good"
webforge checkpoint list
```
