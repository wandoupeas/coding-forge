# WebForge

面向正在仓库里工作的 `Codex` / `Claude Code` 的执行指南。

这份文档遵循 `learn-claude-code` 的主旨，并结合当前仓库的实际实现来写：

- Agent 是模型，不是外层编排代码
- WebForge 是 `repo-side harness`
- `.webforge/` 是项目状态真相源
- `superpowers` 是工作方法增强层，不是任务数据库或 runtime

## 1. 先建立正确心智

当你在一个 WebForge 仓库里工作时，不要把自己理解成“等外部 orchestrator 调度的 worker”。

正确理解是：

- 你就是正在工作的 agent
- WebForge 为你提供工作环境
- `.webforge/` 保存任务、恢复、交付物、知识和协作状态
- CLI 主要负责初始化、观察、校验和兼容入口

一句话：

> 模型做决策；Harness 提供工具、知识、观察面、行动接口和权限边界。

## 2. 进入仓库后先做什么

如果仓库里已经有 `.webforge/`，按这个顺序恢复：

1. 读取 `AGENTS.md`
2. 读取 `.webforge/runtime.json`
3. 读取 `.webforge/tasks.json`
4. 读取 `.webforge/phases.json`
5. 读取 `.webforge/sessions/index.json`
6. 读取 `.webforge/knowledge/index.json`
7. 读取 `.webforge/learning/index.json`（如果已经产生学习记录）
8. 必要时再读取具体 knowledge、deliverable、mailbox 内容

如果你想先拿一个结构化简报，而不是手动逐个读文件，直接运行：

```bash
webforge onboard --json
```

然后按返回值中的：

- `doctor`
- `resume`
- `shouldRead`
- `runtimeLogCommand`
- `recoveryReadiness`

继续恢复工作。

## 3. 如果仓库还没有 `.webforge/`

说明这个仓库还没接入 WebForge contract。

新项目使用：

```bash
webforge init demo-app
cd demo-app
webforge verify init
webforge onboard --json
```

已有项目要接入时，也应该先补齐 `.webforge/` skeleton 和 onboarding contract，再开始规划与执行。

## 4. 你实际依赖的核心状态

当前仓库里，最重要的文件不是聊天记录，而是这些持久化状态：

- `.webforge/runtime.json`
  当前执行面板，回答“系统现在在做什么”
- `.webforge/tasks.json`
  任务图，回答“下一步做什么”
- `.webforge/phases.json`
  阶段图，回答“整体推进到哪里”
- `.webforge/knowledge/index.json`
  知识入口，回答“需求和设计材料在哪里”
- `.webforge/deliverables/index.json`
  交付物索引，回答“已经产出了什么”
- `.webforge/sessions/index.json`
  跨会话恢复入口
- `.webforge/superpowers-runs.json`
  `superpowers` workflow 结果索引
- `.webforge/threads.json`
  线程化恢复和 worktree / branch / artifact linkage
- `.webforge/learning/`
  纠错记录、经验教训和学习索引

## 5. 标准工作循环

在已有 workspace 中，推荐按这个循环工作：

```text
read state
  -> choose next ready task
  -> gather knowledge and prior evidence
  -> execute work
  -> persist deliverables
  -> update task / phase / runtime / session
  -> verify
```

对应常用命令通常是：

```bash
webforge doctor
webforge resume
webforge dashboard
webforge logs runtime
```

如果要机器可读版本，用：

```bash
webforge doctor --json
webforge resume --json
webforge logs runtime --json
```

## 6. 如何判断下一步

优先级顺序：

1. `runtime.json` 当前指向的 `taskId / phaseId`
2. 最近 session 的恢复线索
3. `tasks.json` 里高优先级 `ready` 任务
4. `blocked` 原因
5. `pending_review` 交付物
6. 最近一次 runtime log 的 `contextDrift / workflowContext / threadLinkage`
7. 当前任务相关的学习提醒与高优先级 lesson

不要只根据聊天上下文猜下一步。

## 7. 何时使用 superpowers

`superpowers` 在 WebForge 里是 `workflow enhancement layer`。

推荐边界：

- 需求或方案还不稳定：`brainstorming`
- spec 已稳定，需要拆解：`writing-plans`
- 计划已定，需要并行波次执行：`subagent-driven-development`
- 会话太长，需要压缩：`strategic-compact`
- 长期偏好学习：`continuous-learning-v2`
- 线程化恢复：`gsd-thread` / `gsd-resume-work`

不要把 `superpowers` 当成：

- 项目真相源
- runtime 调度器
- 任务图数据库
- `.webforge/` 的替代品

如果你用了某个 workflow，记得把结果回写：

```bash
webforge superpowers record writing-plans \
  --summary "approved spec converted into execution plan" \
  --artifact plan:docs/superpowers/plans/demo-plan.md \
  --task T001
```

## 8. 状态回写要求

工作不是“做完代码”就结束；还要把状态落回 `.webforge/`。

- 任务图变化：更新 `tasks.json` / `phases.json`
- 执行推进：更新 `runtime.json`
- 新交付物：写入 `deliverables/` 并更新 `deliverables/index.json`
- 新知识：写入 `knowledge/` 并更新 `knowledge/index.json`
- 新的 workflow 结果：更新 `superpowers-runs.json`
- 暂停或恢复：更新 `sessions/`
- 协作消息：写入 `mailboxes/*.jsonl`
- 纠错与经验教训：通过 `webforge learn record / lesson` 更新 `.webforge/learning/`

## 9. 完成前检查

在声称某项工作完成前，至少确认：

1. 代码或文档已经落盘
2. 相关 `.webforge/` 状态已经更新
3. 验证命令已经运行
4. 如发生了错误纠正，已经使用 `webforge learn record` 记录
5. 新会话仅依靠仓库文件就能恢复下一步

## 10. 反模式

这些做法都不符合当前项目：

- 再发明一套外部 WebForge orchestrator
- 把 CLI 当成项目真相源
- 在仓库外维护第二套状态
- 把 `superpowers` 当成唯一记忆源
- 用硬编码 if/else 决策树替模型做本该由模型完成的判断

## 11. 当前项目里你最该读的文档

- [`AGENTS.md`](./AGENTS.md)
- [`README.md`](./README.md)
- [`docs/agent-guide.md`](./docs/agent-guide.md)
- [`docs/manuals/operations.md`](./docs/manuals/operations.md)
- [`docs/methodology/superpowers-integration.md`](./docs/methodology/superpowers-integration.md)

如果你要看最小接入示例，再看：

- [`docs/examples/minimal-agent-onboarding.md`](./docs/examples/minimal-agent-onboarding.md)
- [`docs/examples/agent-onboarding-protocol.md`](./docs/examples/agent-onboarding-protocol.md)

## 12. 一句话总结

> 在 WebForge 仓库里，Agent 直接工作；WebForge 提供 harness；`.webforge/` 保存真相；`superpowers` 让工作方法更稳。
