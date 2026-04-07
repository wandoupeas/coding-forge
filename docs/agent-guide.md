# WebForge Agent Guide

这份文档面向正在仓库里工作的 Coding Agent。  
目标不是教你“调用哪些命令”，而是告诉你“如何根据 workspace contract 继续工作”。

这里的前提是：

- 你直接以 `Codex` 或 `Claude Code` 身份在仓库里工作
- WebForge 为你提供 repo-side harness
- `superpowers` 为你提供方法增强

如果你是人类开发者，而不是仓库内执行中的 agent，优先看：

- [`docs/manuals/operations.md`](./manuals/operations.md)
- [`docs/manuals/command-reference.md`](./manuals/command-reference.md)

## 1. 开始工作前

按固定顺序读取：

1. `AGENTS.md`
2. `.webforge/runtime.json`
3. `.webforge/tasks.json`
4. `.webforge/phases.json`
5. `.webforge/sessions/index.json`
6. `.webforge/knowledge/index.json`
7. `.webforge/learning/index.json`（如果已存在）

如果当前任务需要上下文，再读取对应的 knowledge 文件和 deliverable。
如果你怀疑当前任务会触发历史上重复出现的问题，可以再执行：

```bash
webforge learn remind --task <task-id>
```

如果你怀疑仓库契约不完整，先运行：

```bash
webforge doctor
```

## 2. 你应该如何判断下一步

优先级顺序：

1. `runtime.json` 指向的当前 task / phase
2. 最近 session 的 `nextAction`
3. `tasks.json` 中按优先级排序的 `ready` 任务
4. 阻塞原因和缺失知识

不要只根据聊天上下文猜下一步。

## 3. 处理已有 workspace

已有 `.webforge/` 时：

1. 从 runtime 判断是否有未完成循环
2. 从 task graph 找到 `ready` / `blocked` / `in_progress`
3. 从 sessions 判断恢复点
4. 执行工作
5. 把状态写回 `.webforge/`

## 4. 处理新项目

没有 `.webforge/` 时：

1. 初始化 workspace
2. 摄入需求与设计材料
3. 构建 knowledge index
4. 生成阶段与任务图
5. 创建初始 runtime / session
6. 进入 ready-task 执行循环

## 5. 任务执行循环

标准循环如下：

```text
read state
  -> choose ready task
  -> build context
  -> execute
  -> persist deliverables
  -> update task / phase / runtime / session
```

如果执行失败：

- 在任务 metadata 中记录错误
- 更新任务状态
- 保持 runtime 和 session 可恢复
- 如已完成纠正，使用 `webforge learn record` 记录错误与预防措施

## 6. 何时使用 superpowers

推荐边界：

- 需求和架构分歧较大：`brainstorming`
- 已有 spec，需要拆成实施步骤：`writing-plans`
- 计划已定，需要波次执行：`subagent-driven-development`
- 会话过长，需要主动整理：`strategic-compact`
- 有稳定偏好或反复纠正点：`continuous-learning-v2`

不要把 `superpowers` 当成：

- `.webforge/` 的替代品
- runtime 调度器
- 任务图数据库

如果你实际用了某个 workflow，记得把结果回写：

```bash
webforge superpowers record writing-plans \
  --summary "approved spec converted into execution plan" \
  --artifact plan:docs/superpowers/plans/demo-plan.md \
  --task T001
```

## 7. 何时更新哪些文件

- 任务完成/失败：`tasks.json`
- 阶段推进：`phases.json`
- 新交付物：`deliverables/` + `deliverables/index.json`
- 新知识：`knowledge/` + `knowledge/index.json`
- 新的 superpowers workflow 结果：`superpowers-runs.json`
- 暂停或恢复：`sessions/`
- 执行中状态：`runtime.json`
- 学习记录：通过 `webforge learn` 更新 `.webforge/learning/`

## 8. 面向 Codex 与 Claude Code 的共同约定

无论当前 agent 是哪一个：

- 都以 `.webforge/` 作为第一真相源
- 都通过同一套索引和状态文件恢复上下文
- 都把 CLI 视为兼容入口、观察面和校验面，而不是主控制面

## 9. 完成工作前

至少确认：

1. 代码或文档已经落盘
2. 状态已经写回 `.webforge/`
3. 验证命令已经运行
4. 如发生纠正，已经记录到 `webforge learn`
5. 新会话仅靠仓库文件也能继续

## 10. 标准接入范式

如果你是直接在仓库里工作的 `Codex` 或 `Claude Code`，推荐按这个顺序进入：

### 文本模式

```bash
webforge doctor
webforge resume
webforge dashboard
```

适合人类先读一遍当前状态，再决定是否继续执行。

当仓库中存在历史学习记录时，文本版 `webforge resume` 还会附带当前任务相关的智能提醒。

### 结构化模式

优先入口：

```bash
webforge onboard --json
```

它会一次性返回 `doctor + resume + runtime log command`。

如需拆开看，再使用下面两条：

```bash
webforge doctor --json
webforge resume --json
```

适合 agent 或脚本直接消费。

推荐解释顺序：

1. `doctor --json`
   先看 `summary.fail` 是否大于 `0`，再看 `guidance`。
2. `resume --json`
   再看 `nextAction` 和 `shouldRead`。
3. 读取 `shouldRead` 中列出的仓库文件。
4. 如果问题还在发散，用 `brainstorming` 收敛。
5. 如果 spec 已稳定，用 `writing-plans` 进入实施。
6. 执行工作后，把状态回写到 `.webforge/`。

推荐心智模型：

- `doctor` 判断仓库契约是否健康
- `resume` 判断当前工作流下一步是什么
- `.webforge/` 仍然是最终事实来源

如果你想看一份从命令到解释顺序都更完整的例子，继续看：

- [`docs/examples/minimal-agent-onboarding.md`](./examples/minimal-agent-onboarding.md)
- [`docs/manuals/operations.md`](./manuals/operations.md)
