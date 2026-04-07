# WebForge v0.2 Architecture

## 1. 设计目标

WebForge v0.2 的目标是把仓库重构成一个稳定的 `agent-first harness`：

- agent 读取同一套持久化状态
- runtime 拥有唯一主循环
- CLI 不再承担重型编排
- `superpowers` 作为增强层接入，而不是主控制面

## 2. 顶层结构

```text
用户意图
  -> Agent
  -> WebForge workspace contract (.webforge/)
  -> planning/context/runtime core
  -> deliverables / code / sessions / mailboxes / learning
```

## 3. 分层模型

### 3.1 Workspace Contract

`.webforge/` 是第一真相源。

核心文件：

```text
.webforge/
├── config.yaml
├── runtime.json
├── tasks.json
├── phases.json
├── knowledge/
│   └── index.json
├── deliverables/
│   └── index.json
├── sessions/
│   └── index.json
├── learning/
│   ├── errors.json
│   ├── lessons.json
│   ├── patterns.json
│   └── index.json
└── mailboxes/
```

### 3.2 State Services

`src/core/` 中的基础服务负责持久化与规范化：

- `workspace.ts`
- `task.ts`
- `session.ts`
- `deliverable.ts`
- `mailbox.ts`
- `learning.ts`

这些模块回答的是“当前事实状态是什么”，而不是“下一步策略是什么”。

### 3.3 Execution Core

执行核心由三块组成：

- `planning.ts`
  从 knowledge index、tech stack 和现有 workspace 状态生成任务图。
- `context.ts`
  为具体任务拼装可执行上下文。
- `runtime.ts`
  按 ready 队列执行主循环。

### 3.4 Agent Facade

`Agent` 不再假装自己就是整个系统。  
它只接收标准输入：

```ts
{
  task,
  context
}
```

并返回标准结果：

```ts
{
  success,
  summary,
  deliverables?,
  needsReview,
  error?
}
```

### 3.5 Compatibility CLI

`src/cli/` 只负责：

- 参数解析
- 调用 core
- 渲染结果
- 提供观察与恢复入口

CLI 不是状态真相源，也不是 orchestration engine。

### 3.6 Workflow Enhancement Layer

`superpowers` 位于方法增强层：

- `brainstorming`
- `writing-plans`
- `subagent-driven-development`
- `strategic-compact`
- `continuous-learning-v2`

它们可以提升工作质量，但不拥有 `.webforge/`。

## 4. Runtime 主循环

`src/core/runtime.ts` 是 v0.2 的核心。

主循环语义：

```text
load workspace
  -> pick next ready task
  -> claim task
  -> build execution context
  -> invoke agent facade
  -> persist deliverables
  -> update task / session / runtime
  -> unlock dependent tasks
  -> continue or exit
```

这意味着：

- 任务流转不再散落在 CLI 命令里
- Agent 不需要自己维护第二套执行状态
- 新会话可以通过 `.webforge/` 恢复 ready 队列和 next action

## 5. 恢复模型

恢复依赖两类信息：

1. `runtime.json`
   当前执行面板，告诉 agent 最近一次循环在做什么。
2. `sessions/index.json`
   最近会话及 next action，告诉 agent 如何从对话中断点继续。

恢复顺序：

```text
runtime -> tasks/phases -> sessions -> knowledge -> learning -> deliverables
```

当仓库中已经积累过纠错历史时，恢复流程还可以结合 `learning` 数据生成提醒，用于在继续当前任务前提示高风险的重复问题和经验教训。

## 6. Codex / Claude Code / superpowers

### WebForge 负责

- 工作区状态
- 任务图
- 恢复入口
- runtime 协议

### Coding Agent 负责

- 需求理解
- 设计和实现
- 测试和验证
- 状态回写

### superpowers 负责

- 工作方法
- 设计收敛
- 计划拆解
- 子任务组织
- 长程工作记忆增强

## 7. 非目标

当前版本明确不做：

- 多机分布式 runtime
- 强绑定单一 agent 厂商
- 把 CLI 做成主控制面
- 把 `superpowers` 做成状态数据库

## 8. 演进方向

后续可以扩展：

- worktree/workspace 隔离
- 更强的 recovery diagnostics
- 更细粒度的 permissions / observation hooks
- 更标准化的 project template / migration flow
