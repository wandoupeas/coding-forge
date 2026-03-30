# WebForge 最小接入演示

这份文档展示一个正在仓库里工作的 `Codex` 或 `Claude Code`，如何按 WebForge 的 repo-side harness 进入工作状态。

重点不是“调用多少命令”，而是：

1. 先判断仓库契约是否完整
2. 再判断当前下一步是什么
3. 再去读真正需要的状态文件

## 场景

假设你进入了一个已经初始化过的 WebForge 仓库，并且希望继续上一次未完成的工作。

## 方案 A：给人读的文本模式

```bash
webforge doctor
webforge resume
webforge dashboard
```

适合人类开发者先看一遍整体状态，再决定怎么继续。

## 方案 B：给 agent 消费的结构化模式

```bash
webforge onboard --json
```

或者显式拆开：

```bash
webforge doctor --json
webforge resume --json
```

适合 agent、脚本或外部自动化。

如果你是人类开发者，想看更完整的日常操作说明，继续看：

- [`docs/manuals/operations.md`](../manuals/operations.md)
- [`docs/manuals/command-reference.md`](../manuals/command-reference.md)

---

## Step 1: 检查仓库契约

```bash
webforge onboard --json
```

示例输出会同时带：

- `doctor`
- `resume`
- `runtimeLogCommand`

如果你只想拆开看，也可以继续使用下面两步：

```bash
webforge doctor --json
```

示例输出：

```json
{
  "summary": {
    "ok": 12,
    "warn": 0,
    "fail": 0
  },
  "checks": [
    {
      "id": "agents",
      "label": "AGENTS.md",
      "status": "ok",
      "detail": "仓库规则入口已存在"
    }
  ],
  "guidance": [
    "仓库契约基本完整，可以直接让 Codex / Claude Code 按 AGENTS.md + .webforge/ 继续工作。",
    "开始工作前先读 AGENTS.md、runtime.json、tasks.json 和 sessions/index.json。"
  ]
}
```

解释方式：

1. 如果 `summary.fail > 0`
   先修仓库契约，不要直接继续开发。
2. 如果 `summary.fail === 0`
   再进入下一步恢复。
3. `guidance`
   是给 agent 的下一步补充说明，不只是给人看的提示文本。

---

## Step 2: 恢复当前工作

```bash
webforge resume --json
```

示例输出：

```json
{
  "sessionId": "resume-session",
  "runtimeStatus": "active",
  "runtimeSummary": "Running T001",
  "currentTaskId": "T001",
  "currentPhaseId": "P1",
  "readyCount": 2,
  "blockedCount": 1,
  "pendingReviewCount": 0,
  "guidance": "Resume phase P1 / task T001. resume later. Next: continue ready-task loop",
  "nextAction": "Resume phase P1 / task T001. resume later. Next: continue ready-task loop",
  "shouldRead": [
    "AGENTS.md",
    ".webforge/runtime.json",
    ".webforge/tasks.json",
    ".webforge/sessions/index.json",
    ".webforge/knowledge/index.json"
  ]
}
```

解释方式：

1. 先看 `nextAction`
   这是当前最推荐的下一步。
2. 再看 `shouldRead`
   这是进入工作前真正需要补读的文件列表。
3. `readyCount / blockedCount / pendingReviewCount`
   用来判断是继续开发、先排阻塞，还是先处理 review。

---

## Step 3: 按 shouldRead 补读状态

最小读取顺序通常就是：

1. `AGENTS.md`
2. `.webforge/runtime.json`
3. `.webforge/tasks.json`
4. `.webforge/sessions/index.json`
5. `.webforge/knowledge/index.json`

如果 `resume --json` 的 `shouldRead` 里包含：

- `.webforge/deliverables/index.json`
  说明当前待审核或交付物上下文很关键
- 具体 knowledge / deliverable 文件
  说明当前任务依赖这些材料

不要一上来把整个仓库扫一遍。先按 `shouldRead` 收敛上下文，再继续。

---

## Step 4: 决定使用哪一层能力

读取完状态后，按问题类型选择：

- 仓库契约缺失或状态损坏
  先修 WebForge contract
- 需求或方案仍然在发散
  用 `brainstorming`
- spec 已稳定，需要拆实施步骤
  用 `writing-plans`
- 可以直接落地实现
  直接工作并回写 `.webforge/`

---

## Step 5: 完成后回写

至少确认这些内容已经同步：

- `tasks.json`
- `runtime.json`
- `sessions/`
- `knowledge/index.json` 或 `deliverables/index.json`

如果只是改了代码、没回写 `.webforge/`，那就还不算符合 WebForge 工作流。

---

## 一句话范式

```text
onboard --json
  -> read shouldRead
  -> optionally inspect runtime logs
  -> choose method layer (brainstorming / writing-plans / direct execution)
  -> write back to .webforge/
```

显式拆开时则是：

```text
doctor --json
  -> resume --json
  -> read shouldRead
  -> choose method layer (brainstorming / writing-plans / direct execution)
  -> write back to .webforge/
```

这就是 WebForge 对 `Codex / Claude Code + superpowers` 的最小接入闭环。
