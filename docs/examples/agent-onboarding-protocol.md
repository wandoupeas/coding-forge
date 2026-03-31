# work-forge Agent Onboarding Protocol

这份文档给进入本仓库工作的 Codex / Claude Code 使用。

目标只有一个：先恢复正确上下文，再决定要不要继续实现。

## 标准入口

优先使用统一入口：

```bash
webforge onboard --json
```

你需要从输出里依次处理：

1. `doctor.summary`
   如果 `fail > 0`，先修仓库契约，不要直接开发。
2. `resume.shouldRead`
   只读取这些必要文件，不要一上来扫描整个仓库。
3. `resume.nextAction`
   这是当前最推荐的下一步。
4. `recommendedActions`
   如果这里提示 drift / blocked / pending_review，先处理这些信号。

## 拆开排查时的顺序

如果你不想走统一入口，按这个顺序：

```bash
webforge doctor --json
webforge resume --json
webforge logs runtime --json
```

含义分别是：

- `doctor --json`
  看仓库契约是否完整，以及最近 runtime 上下文有没有和当前 workspace 脱节
- `resume --json`
  看下一步该做什么，以及应该读哪些文件
- `logs runtime --json`
  看最近 runtime 事件流、日志恢复快照、当前工作区恢复快照

## 遇到 drift 时怎么做

如果出现下面任一信号：

- `doctor.checks.runtime-context-drift.status = warn`
- `resume.runtimeLog.contextDrift.status = drifted`
- `recommendedActions` 明确要求先回看 runtime

那么先执行：

```bash
webforge logs runtime
```

先确认：

1. 最近 runtime 对应的 `workflowContext / threadLinkage`
2. 当前工作区最新的 `workflowContext / threadLinkage`
3. 两者为什么不同

没有核对 drift 之前，不要默认沿当前上下文直接继续。

## 开始实现前至少要读

- `AGENTS.md`
- `.webforge/runtime.json`
- `.webforge/tasks.json`
- `.webforge/sessions/index.json`
- `.webforge/knowledge/index.json`

如果 `shouldRead` 还带了其他文件，以 `shouldRead` 为准。

## 完成后必须回写

- 任务变化回写到 `.webforge/tasks.json`
- 执行状态回写到 `.webforge/runtime.json`
- 新知识回写到 `.webforge/knowledge/`
- 新交付物回写到 `.webforge/deliverables/`

一句话：

```text
onboard --json -> read shouldRead -> inspect drift if needed -> execute -> write back to .webforge/
```
