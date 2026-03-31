# WebForge Harness 工作流

本仓库使用 WebForge 作为 repo-side harness。你（Claude Code / Codex）在仓库里工作时，必须遵循以下工作流。

## 进入仓库

每次新会话开始时：

```bash
node dist/cli/index.js onboard --json
```

从返回值中读取 `shouldRead`、`nextAction`、`recommendedActions`，据此决定下一步。

## 工作中

### 开始任务前

```bash
node dist/cli/index.js record session --task <TASK_ID> --phase <PHASE_ID> --summary "开始: <任务描述>"
```

### 完成一个任务后

**必须**立即运行：

```bash
node dist/cli/index.js record task <TASK_ID> --status completed --summary "<完成摘要>" -d <改动文件1> -d <改动文件2>
```

### 工作进行中（可选，推荐长任务使用）

```bash
node dist/cli/index.js record log "<进展描述>" --task <TASK_ID>
```

## 会话结束

Stop hook 会自动调用 `webforge record snapshot --reason session_end`，你不需要手动处理。

但如果你主动暂停工作，推荐先运行：

```bash
node dist/cli/index.js record auto --summary "<当前进展摘要>"
```

## 上下文压缩

### 手动压缩前（/compact）

**必须**先保存当前状态：

```bash
node dist/cli/index.js record auto --summary "compact 前保存: <当前正在做什么>"
```

### 被动压缩后

如果你发现对话历史被系统压缩了（上下文中出现压缩摘要），**第一件事**是恢复 WebForge 状态：

```bash
node dist/cli/index.js onboard --json
```

然后根据 `shouldRead`、`nextAction` 恢复工作。不要凭压缩后的模糊记忆继续，以 `.webforge/` 为准。

## 状态检查

```bash
node dist/cli/index.js dashboard          # 总览
node dist/cli/index.js resume --json       # 下一步建议
node dist/cli/index.js logs runtime        # 事件流
node dist/cli/index.js deliverables        # 交付物
```

## 关键原则

1. **每完成一个任务必须回写** — `record task` 是强制的
2. **不要在仓库外维护状态** — 所有状态都在 `.webforge/`
3. **先读 onboard，再开始工作** — 不要跳过恢复步骤
4. `.webforge/` 是真相源 — CLI 是观察面，不是事实来源
