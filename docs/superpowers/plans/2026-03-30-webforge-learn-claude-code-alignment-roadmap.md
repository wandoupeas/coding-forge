# WebForge 对齐 learn-claude-code 路线图

## 1. 目标

本路线图用于把 WebForge 从 `harness-first 参考实现` 继续推进到更接近
[`learn-claude-code`](https://github.com/shareAI-lab/learn-claude-code/blob/main/README-zh.md)
所倡导的 `harness engineering best practice`。

目标不是把 WebForge 做成新的“伪 Agent 编排器”，而是把它收敛成一套更完整的：

- `Tools`
- `Knowledge`
- `Observation`
- `Action Interfaces`
- `Permissions`

并让 `superpowers` 成为稳定的增强层，而不是主控制面。

## 2. 当前判断

### 已对齐部分

- `.webforge/` 已经是仓库内第一真相源
- `runtime` 已成为唯一主循环
- CLI 已基本缩减为兼容层和观察入口
- `session / deliverable / mailbox / checkpoint` 等状态服务已经形成基础闭环
- `superpowers` 已被定义为方法增强层，而不是状态数据库

### 未对齐部分

1. 默认执行层仍然是本地 `AgentHandler` stub，不是真正的模型 agent loop
2. `superpowers` 仍偏“文档级集成”，尚未进入 runtime 的按需 skill 路由
3. `observation` 与 `permissions` 机制还不完整
4. 还没有把 `superpowers` 已提供的 `subagent / worktree / compact / thread` 能力接进 WebForge 契约
5. 缺少围绕“外部 agent 适配层”的稳定协议

## 3. 对齐原则

路线图统一遵守以下原则：

1. 模型是 Agent，WebForge 只负责 Harness
2. 项目真相必须继续沉淀在 `.webforge/`
3. CLI 不重新长回 orchestration engine
4. `superpowers` 提供方法，不拥有状态
5. 所有新能力都要能跨会话恢复
6. 所有执行能力都必须有可观察面和边界控制

## 4. 目标架构

最终目标结构：

```text
用户意图
  -> 外部模型 Agent (Codex / Claude Code)
  -> WebForge Agent Adapter
  -> WebForge Harness Core
     -> tools
     -> knowledge
     -> observation
     -> action interfaces
     -> permissions
  -> .webforge/ persistent state
  -> superpowers workflow enhancement
```

关键边界：

- 外部模型负责决策
- WebForge 负责提供稳定执行环境
- `superpowers` 负责提升设计、规划、执行与恢复方法
- `.webforge/` 负责沉淀事实状态

## 5. 阶段路线图

### Phase 1: 真实 Agent Adapter 层

目标：把当前本地 `AgentHandler` stub 替换成可插拔的外部 agent 适配层。

主要工作：

- 定义 `AgentAdapter` 协议
- 支持 `codex` 和 `claude-code` 两类 adapter
- 将 `runtime` 调用从默认 handler 切到 adapter 接口
- 让 adapter 接收标准输入：
  - `task`
  - `context`
  - `workspace paths`
  - `tool/permission hints`
- 让 adapter 返回标准输出：
  - `success`
  - `summary`
  - `deliverables`
  - `needsReview`
  - `metadata`

验收标准：

- `runtime` 无需关心具体模型厂商
- 可在配置中切换 `codex` / `claude-code`
- 默认 handler 仅保留为测试 fallback，不再充当主执行路径
- 至少有一条真实 adapter smoke test

### Phase 2: Superpowers 契约化集成

目标：把 `superpowers` 从“兼容叙事”升级为“有明确输入输出契约的方法增强层”。

主要工作：

- 定义 `superpowers capability registry`
- 在 `planning` 阶段显式输出推荐 workflow / skills
- 在 `runtime/context` 中暴露当前任务对应的 workflow hints
- 为每种能力定义回写契约：
  - `brainstorming` -> knowledge / decisions / session notes
  - `writing-plans` -> tasks / phases / plan docs
  - `subagent-driven-development` -> wave / owner / review markers
  - `strategic-compact` -> compact handoff artifact
  - `continuous-learning-v2` -> 仅个人偏好，不进入 `.webforge/` 事实状态
  - `gsd-thread` / `gsd-resume-work` -> session thread references
- 增加 `thread / compact / workflow ownership` 的对接点

验收标准：

- `plan` 不只显示 superpowers 开关，而是生成可执行的 workflow hints
- `runtime` 能把当前任务的建议 workflow 传给 adapter
- `superpowers` 触发结果必须能回写 `.webforge/`
- 文档中明确“何时由 WebForge 决定状态、何时由 superpowers 决定方法”

### Phase 3: Observation 与 Permissions

目标：补齐指南最强调但当前实现最薄的一层。

主要工作：

- 增加统一 observation surface
  - workspace state
  - git diff
  - logs
  - mailbox unread counts
  - review pending items
- 定义 permission profile
  - read-only
  - workspace-write
  - require-approval
- 将破坏性动作和外部副作用动作显式分类
- 在 adapter 执行前后记录 observation snapshots

验收标准：

- `dashboard` 不只是状态面板，而是统一 observation 入口
- 外部 agent 能读到同一套 observation snapshot
- 高风险动作必须走审批边界
- 日志中可以回放“当时模型看到了什么、做了什么”

### Phase 4: 隔离执行集成

目标：不重复发明并行执行框架，而是把 `superpowers` 已有的隔离执行能力接进 WebForge。

主要工作：

- 定义 subagent execution contract
- 接入 `subagent-driven-development` 的波次执行元数据
- 接入 `using-git-worktrees` 的 worktree / branch / path 元数据
- 为 mailbox 增加更完整的协作事件模型
- 引入 worker-level checkpoints 或 phase-level snapshots
- 为 review / merge / cleanup 增加边界记录

验收标准：

- 能记录多个隔离工作区对应的 task / worker / branch
- 合并结果前有统一 review / checkpoint 边界
- mailbox 不再只是消息存储，而是实际协作协调面
- 并行执行不会污染主 workspace 状态
- WebForge 不需要重新实现 worktree 创建逻辑

### Phase 5: Compact / Thread Recovery 与 Diagnostics 强化

目标：把跨 session 连续性从“能恢复”升级到“可诊断、可解释、可修复”，并把 compact / thread 纳入正式恢复协议。

主要工作：

- 增加 recovery doctor / diagnostics
- 标准化 compact / handoff artifacts
- 增加 runtime interruption markers
- 增加 checkpoint diff / rollback preview
- 为迁移老仓库设计 onboarding flow
- 为 `strategic-compact` 增加 handoff artifact 规范
- 为 `gsd-thread` / `gsd-resume-work` 增加 thread linkage 规范

验收标准：

- 新会话可在最少聊天上下文下恢复
- 能解释“为什么当前推荐下一步是这个”
- 能在恢复失败时给出诊断结果
- 老仓库可逐步接入，不要求一次性完全改造
- compact 后仍可从 `.webforge/` + handoff artifact 恢复
- thread 相关恢复信息可被 `onboard / resume / doctor` 消费

## 6. 推荐实施顺序

推荐顺序必须严格保持：

1. `Agent Adapter`
2. `Superpowers Contract Integration`
3. `Observation + Permissions`
4. `Isolation Workflow Integration`
5. `Compact / Thread Recovery Diagnostics`

原因：

- 如果没有真实 adapter，当前 runtime 仍然只是参考实现
- 如果没有 superpowers 契约化集成，方法增强层仍停留在文档层
- 如果没有 observation 和 permissions，隔离执行只会放大混乱
- 如果没有 compact / thread diagnostics，后期复杂度会让恢复成本失控

## 7. 对当前仓库的具体建议

短期内最值得优先做的三件事：

1. 为 `.webforge/superpowers.json` 定义 capability registry
2. 在 `runtime / session / task` 中增加 workflow / worktree / thread / compact 元数据
3. 把 `plan` 生成的 workflow hints 和 task metadata 统一进 runtime context
4. 为 `doctor / onboard / resume` 增加 compact / thread / isolation readiness 检查

## 8. 完成态判断

当满足以下条件时，WebForge 才能更有底气地称为“符合 learn-claude-code + superpowers 的最佳实践”：

1. 外部模型是真正的决策者
2. WebForge 真正提供完整 harness 五件套
3. `.webforge/` 继续作为唯一项目事实源
4. `superpowers` 真实参与方法增强，而不是停留在口号层
5. 跨会话恢复、审核、回滚、隔离执行都形成闭环

## 9. 当前结论

当前 WebForge 可以被定义为：

> 一个方向正确、结构已经成型、但仍处于中期收敛阶段的 `agent-first harness skeleton`

它已经足够作为你的最佳实践起点，但还不应被视为最终完成版。

## 10. 基于当前 superpowers 能力重排后的待办

如果按“优先复用 superpowers，WebForge 只补契约层”来做，当前最值得推进的是：

1. `superpowers capability registry`
   让仓库知道当前打算接入哪些 workflow、它们各自负责什么、输出哪些 artifacts。
2. `workflow result persistence`
   把 brainstorming / writing-plans / subagent-driven-development / strategic-compact 的结果映射到 `.webforge/`。
3. `isolation metadata persistence`
   为 task / session / runtime 增加 `branch`, `worktreePath`, `waveId`, `threadId`, `compactFromSession`。
4. `compact handoff contract`
   定义 compact 前后必须生成哪些 handoff 文件，以及 `onboard / resume` 如何读取。
5. `doctor/onboard superpowers readiness`
   让 CLI 能检查这些 workflow 是否已配置、最近一次 artifacts 是否可恢复。
