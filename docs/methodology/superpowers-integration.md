# Superpowers Integration

## 定位

`superpowers` 在 WebForge v0.2 里是 `workflow enhancement layer`。

这意味着：

- 你依然直接使用 `Codex` / `Claude Code` 在仓库里工作
- WebForge 依然是 repo-side harness 契约
- `superpowers` 只决定“这类工作怎么做更稳”

它负责：

- 设计收敛
- 计划拆解
- 子任务执行策略
- compact 与线程化恢复
- 长程偏好学习

它不负责：

- runtime 调度
- 任务图真相
- 会话状态数据库
- 交付物索引

## 推荐映射

- 需求和方案还不稳定：`brainstorming`
- spec 已经稳定：`writing-plans`
- 大任务分波次执行：`subagent-driven-development`
- 长会话收口：`strategic-compact`
- 长期偏好学习：`continuous-learning-v2`
- 线程化恢复：`gsd-thread` / `gsd-resume-work`

## 能力归属

WebForge 不应该把 `superpowers` 已经擅长的能力再重写一遍。

更合理的拆分是：

- 设计收敛
  由 `brainstorming` 提供方法。
  WebForge 负责把结论落到 `.webforge/knowledge/`、`tasks.json`、`sessions/`。
- 计划拆解
  由 `writing-plans` 提供方法。
  WebForge 负责把计划结果转成任务图、阶段图和 skill hints。
- 子任务并行与上下文隔离
  由 `subagent-driven-development` 提供执行工作流。
  WebForge 负责记录 task ownership、review 边界、mailbox 协作和恢复状态。
- worktree 隔离
  由 `using-git-worktrees` 提供隔离工作区。
  WebForge 负责记录当前 task 对应的 branch、worktree、session 和 checkpoint。
- 上下文压缩
  由 `strategic-compact` 提供时机判断和 compact 建议。
  WebForge 负责在 compact 前后保存 handoff artifact、session snapshot 和 next action。
- 长期偏好学习
  由 `continuous-learning-v2` 提供观察和偏好沉淀。
  WebForge 只负责项目事实，不负责个人 instincts。
- 线程化恢复
  由 `gsd-thread` / `gsd-resume-work` 提供跨会话线程机制。
  WebForge 负责把 thread reference 接进 `.webforge/sessions/` 和 onboarding 简报。

## 集成原则

1. 先让 WebForge 定义项目状态
2. 再让 `superpowers` 决定工作方法
3. 最终结果仍然必须回写 `.webforge/`
4. 不要把 `superpowers` 误当成外部 orchestrator

## 当前还需要 WebForge 自己补的东西

即便已经复用 `superpowers`，WebForge 仍然需要补齐这些集成层能力：

1. capability registry
   把“当前仓库可用哪些 superpowers 工作流、各自负责什么”写进 `.webforge/superpowers.json` 或等价索引。
2. workflow-to-state contract
   定义每种 workflow 执行后必须回写哪些 `.webforge/` 状态。
3. isolation metadata
   让 task、session、runtime 能记录 subagent wave、worktree path、branch 和 owner。
4. compact artifacts
   在 strategic compact 前后生成标准化 handoff，而不是只依赖模型内部记忆。
5. doctor / onboard checks
   让 onboarding 能判断相关 superpowers 能力是否存在、是否配置、最近一次 compact / thread / worktree 是否可恢复。
6. 操作手册
   明确告诉人类开发者何时调用 WebForge，何时调用 superpowers，对应产物要写回哪里。
