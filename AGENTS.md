# WebForge v0.2 仓库契约

WebForge 是一个 `agent-first harness`。  
这个仓库里的真相不在聊天记录里，也不在某个 CLI 命令里，而在 `.webforge/` 这组持久化状态文件里。

---

## ⚠️ 强制规范（MANDATORY）

### 所有工作必须通过 WebForge CLI

**严禁绕过 webforge 直接操作以下事项：**

1. ✅ **Plan 创建** - 必须使用 `webforge plan` 生成规划
2. ✅ **任务管理** - 必须使用 `webforge task` 创建/更新任务状态
3. ✅ **阶段管理** - 必须使用 `webforge` 命令更新 phases 状态
4. ✅ **Runtime 更新** - 不得直接修改 `.webforge/runtime.json`
5. ✅ **Bug 修复** - 必须为每个 bug 创建任务，通过 webforge 跟踪
6. ✅ **新功能开发** - 必须先创建任务，再开始编码
7. ✅ **文档添加** - 知识文档需通过 `webforge knowledge` 管理
8. ✅ **初始化项目** - 必须使用 `webforge init`，不得手动创建目录结构
9. ✅ **框架/组件引用** - 涉及架构变更必须通过 webforge 任务跟踪

### 链式更新要求

每完成一个任务，必须按顺序执行：

```bash
# 1. 更新任务状态
webforge task update <task-id> --status completed

# 2. 检查 runtime 状态
webforge resume --json

# 3. 提交代码（详细提交信息）
git add .
git commit -m "<task-id>: <task-title>

- <change-1>
- <change-2>
- <change-3>"
```

### 禁止直接操作的文件

| 文件/目录 | 正确操作方式 |
|----------|-------------|
| `.webforge/runtime.json` | `webforge run`, `webforge task update` |
| `.webforge/tasks.json` | `webforge task` 命令 |
| `.webforge/phases.json` | `webforge plan`, `webforge task` |
| `.webforge/sessions/` | `webforge session` 命令 |
| `.webforge/knowledge/` | `webforge knowledge` 命令 |
| `.webforge/deliverables/` | `webforge deliverables` 命令 |

### 代码提交规范

每个任务完成后必须提交，提交信息格式：

```
<task-id>: <task-title>

- <具体变更1>
- <具体变更2>
- <具体变更3>
```

**示例：**
```
T015: 修复前端TypeScript错误

- 修复 React 19 useRef 需要初始值的问题
- 替换 useRequest 为 useEffect + useState
- 修复 ProTable render 函数参数类型
```

---

## 进入仓库后的读取顺序

1. 读取 `.webforge/runtime.json`
2. 读取 `.webforge/tasks.json`
3. 读取 `.webforge/phases.json`
4. 读取 `.webforge/sessions/index.json`
5. 读取 `.webforge/knowledge/index.json`
6. 必要时再读取具体 knowledge、deliverable、mailbox 内容

## 你要如何理解这些文件

- `.webforge/runtime.json`
  当前执行面板。它回答“系统现在在做什么、最后一次循环处理到哪里”。
- `.webforge/tasks.json` 和 `.webforge/phases.json`
  工作图谱。它们回答“下一步做什么、依赖是否满足、哪些任务已完成或阻塞”。
- `.webforge/knowledge/index.json`
  知识入口。它回答“需求、设计、决策材料在哪里”。
- `.webforge/deliverables/index.json`
  已产出的证据。它回答“已经交付了什么、由谁生成、状态如何”。
- `.webforge/sessions/index.json`
  跨会话恢复入口。它回答“最近一次工作停在什么位置、建议下一步是什么”。
- `.webforge/mailboxes/`
  异步协作接口。它不是任务真相源，只负责消息传递。

## 工作原则

1. WebForge 决定项目如何运作；Agent 决定如何完成具体工作。
2. 进入仓库后，应直接以 `Codex` / `Claude Code` 身份按本契约工作，而不是再发明第二套外部编排。
3. CLI 是兼容层、观察面和校验面，不是项目真相源。
4. 所有项目状态变化必须回写到 `.webforge/`。
5. 不要在仓库外维护第二套状态。
6. 不要把 `superpowers` 当作 runtime 调度器或唯一记忆源。

## 进入仓库后的首个动作

如果你刚进入一个 WebForge 仓库，先做两件事：

1. 按本文前面的顺序读取 `AGENTS.md` 与 `.webforge/`
2. 如需快速确认仓库契约是否完整，运行 `webforge doctor`

## 新工作流

### 已有 `.webforge/`

按以下顺序恢复：

1. 读取 `runtime.json` 判断是否存在未完成的执行上下文
2. 从 `tasks.json` 找出 `ready`、`in_progress`、`blocked` 任务
3. 从 `sessions/index.json` 获取最近会话和 next action
4. 补读当前任务相关的 knowledge 与 deliverable
5. 执行工作并回写状态

### 没有 `.webforge/`

按以下顺序初始化：

1. 创建 workspace skeleton
2. 摄入初始 knowledge
3. 生成任务图与阶段图
4. 创建首个 session / runtime 状态
5. 开始 ready-task 执行循环

## 状态回写要求

- 任务图变化：更新 `.webforge/tasks.json` / `.webforge/phases.json`
- 执行推进：更新 `.webforge/runtime.json`
- 新交付物：写入 `.webforge/deliverables/` 并更新 `index.json`
- 新知识：**必须使用 `webforge knowledge` 命令，禁止直接写入**
  - 添加文档：`webforge knowledge add <file> --category <requirements|design|decisions|data>`
  - 创建规范：`webforge knowledge create <name> --category <design|decisions>`
  - 解析文档：`webforge knowledge parse [file]`
- 暂停或恢复：更新 `.webforge/sessions/`
- 协作消息：写入 `.webforge/mailboxes/*.jsonl`

### ⚠️ 重要：Knowledge 目录写入限制

**禁止直接写入 `.webforge/knowledge/` 根目录！**

知识文档必须通过命令写入子目录：
- `requirements/` - 需求文档 (PRD, 用户故事)
- `design/` - 设计文档 (架构、规范、接口设计)
- `decisions/` - 架构决策记录 (ADR)
- `data/` - 数据字典、模型定义
- `raw/` - 原始文档备份
- `parsed/` - 解析后的结构化数据 (自动生成)

**违规写入将被 `webforge doctor` 检测并警告。**

## superpowers 的位置

`superpowers` 是工作方法增强层，不是主控制面。

推荐的使用边界：

- 设计收敛：`brainstorming`
- 计划拆解：`writing-plans`
- 子任务执行：`subagent-driven-development` 或等价方案
- 会话压缩：`strategic-compact`
- 长程偏好学习：`continuous-learning-v2`
- 线程化恢复：`gsd-thread` / `gsd-resume-work`

不要把这些能力当成：

- 项目状态数据库
- 任务图唯一来源
- runtime 主循环

## 完成前检查

在声称某项工作完成前，至少确认：

1. 代码或文档已经落盘
2. `.webforge/` 中相关状态已经更新
3. 验证命令已经运行
4. 新会话仅通过 `.webforge/` 就能恢复下一步

## 对 Codex / Claude Code 的直接要求

当你就是正在工作的 Coding Agent 时：

1. 不要等待一个“外部 WebForge orchestrator”来调度你
2. 直接把当前仓库视为你的 harness
3. 先读规则和状态，再决定下一步
4. 必要时使用 `superpowers` 做方法增强
5. 最终仍然以 `.webforge/` 为事实回写点

## 术语约定

- `harness`
  让 agent 可持续工作的工程环境
- `workspace contract`
  `.webforge/` 的目录、文件和字段约定
- `runtime`
  ready-task 主循环及其状态
- `compatibility CLI`
  便于初始化、观察和恢复的命令入口
- `workflow enhancement layer`
  像 `superpowers` 这样的技能和方法体系

## 延伸阅读

- `README.md`
- `ARCHITECTURE.md`
- `docs/agent-guide.md`
- `docs/methodology/`

---

## 规范版本

- **版本**: v2.1
- **更新日期**: 2026-04-02
- **生效范围**: 所有 WebForge 仓库及 Agent 操作
- **主要变更**: 添加强制 CLI 操作规范、链式更新流程、代码提交规范
