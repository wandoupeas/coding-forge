# WebForge: Web 开发 Agent 协作框架设计

**版本**: v0.1.0
**日期**: 2026-03-24
**状态**: 已确认

---

## 1. 核心理念

### 1.1 Agent vs Harness

```
Agent = 模型（Claude、GPT、Gemini 等）
Harness = 模型工作的环境
```

**关键认知**：
- 我们不是在"开发 Agent"，而是在构建 Agent 工作的 Harness
- Harness 提供工具、知识、观察、行动接口、权限边界
- 模型做决策，Harness 执行

### 1.2 设计原则

1. **Agent 无关性** — 支持任意 Coding Agent 接入，无缝切换
2. **状态持久化** — 所有状态存文件系统，支持跨会话恢复
3. **异步协作** — Worker 通过持久化邮箱通信，不依赖同步会话
4. **Human-in-the-Loop** — 关键节点人工审批，全程可干预

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│  CLI / Web Dashboard / VS Code Plugin                           │
│  (多入口，统一核心)                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Orchestrator                               │
│  (任务调度、阶段管理、依赖解析)                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │   PM    │     │ Backend │     │Frontend │  ...
        │ Worker  │     │ Worker  │     │ Worker  │
        └─────────┘     └─────────┘     └─────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Tool Layer                                  │
│  Bash | Read/Write/Edit | Browser | MCP Extensions              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   .webforge/ (持久化层)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 目录结构

```
.webforge/
├── config.yaml              # 项目配置
├── tasks.json               # 任务板 + 状态
├── phases.json              # 阶段定义
│
├── workers/                 # Worker 身份定义
│   ├── pm/
│   │   ├── worker.yaml
│   │   └── skills/
│   │       └── requirement-analysis.md
│   ├── frontend/
│   │   ├── worker.yaml
│   │   └── skills/
│   │       ├── react-component.md
│   │       └── tailwind-styling.md
│   └── backend/
│       ├── worker.yaml
│       └── skills/
│           └── api-design.md
│
├── mailboxes/               # 异步邮箱
│   ├── pm.jsonl
│   ├── frontend.jsonl
│   └── backend.jsonl
│
├── knowledge/               # 知识库
│   ├── index.json
│   ├── requirements/
│   │   └── prd.md
│   ├── design/
│   │   └── ui-spec.md
│   └── decisions/
│       └── adr-001-auth.md
│
├── sessions/                # 会话快照
│   ├── session-001.json
│   └── session-002.json
│
├── checkpoints/             # 检查点快照
│   └── cp-phase1-complete.json
│
├── worktrees/               # 并行开发隔离
│   ├── T101-auth/
│   └── T102-order/
│
└── logs/                    # 执行日志
    └── 2026-03-24.jsonl
```

---

## 4. 核心组件设计

### 4.1 Worker 组织（混合模式）

```
核心固定角色：
├── PM          # 需求分析、任务规划
├── Tech Lead   # 架构设计、技术决策
├── Frontend    # 前端开发
├── Backend     # 后端开发
├── QA          # 测试
└── DevOps      # 部署

动态扩展角色（按需创建）：
├── SEO Expert
├── Security Auditor
├── Performance Optimizer
└── ...
```

**Worker 定义结构：**

```yaml
# workers/frontend/worker.yaml
role: frontend
name: Frontend Developer
description: 负责前端界面开发
skills:
  - react-component
  - tailwind-styling
  - api-integration
tools:
  - read
  - write
  - edit
  - bash
  - browser
system_prompt: |
  你是前端开发专家，擅长 React + TypeScript + Tailwind CSS。
  遵循项目的设计规范和代码风格。
```

### 4.2 任务流转（混合模式）

**三维度状态：**

```typescript
interface Task {
  id: string                    // T101
  phase: string                 // P2 (后端开发)
  title: string
  status: TaskStatus
  assignee: string              // worker id
  depends_on: string[]          // ["T100"]
  blocked_by: string[]          // ["P2"] or ["T100"]
  priority: number
  created_at: string
  updated_at: string
}

type TaskStatus =
  | 'pending'      // 初始状态
  | 'ready'        // 依赖满足，可认领
  | 'in_progress'  // 执行中
  | 'blocked'      // 被阻塞
  | 'completed'    // 完成
  | 'failed'       // 失败
```

**阶段定义：**

```typescript
interface Phase {
  id: string                    // P1, P2, ...
  name: string                  // 设计、后端开发、前端开发...
  status: PhaseStatus
  progress: number              // 0-100
  depends_on: string[]          // 依赖的其他阶段
}

type PhaseStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
```

**自动流转逻辑：**

```
pending + depends_on 全满足 → ready
ready + Worker 认领 → in_progress
in_progress + 阻塞出现 → blocked
in_progress + 完成 → completed
blocked + 阻塞解除 → ready
```

### 4.3 Worker 协作（异步团队）

**邮箱协议：**

```json
// mailboxes/backend.jsonl
{"id": "msg-001", "from": "pm", "to": "backend", "type": "task_assign", "task_id": "T101", "content": "请开发用户认证 API", "timestamp": "2026-03-24T10:00:00Z"}
{"id": "msg-002", "from": "backend", "to": "pm", "type": "task_complete", "task_id": "T101", "content": "API 开发完成", "timestamp": "2026-03-24T12:00:00Z"}
{"id": "msg-003", "from": "frontend", "to": "backend", "type": "question", "content": "登录接口的返回格式是什么？", "timestamp": "2026-03-24T14:00:00Z"}
```

**消息类型：**

```typescript
type MessageType =
  | 'task_assign'     // 分配任务
  | 'task_complete'   // 任务完成
  | 'task_blocked'    // 任务阻塞
  | 'question'        // 提问
  | 'answer'          // 回答
  | 'notification'    // 通知
  | 'approval_request' // 审批请求
  | 'approval_result'  // 审批结果
```

### 4.4 Human-in-the-Loop（混合模式）

**三种介入方式：**

```
1. 审批型 — 关键节点
   ├── 阶段完成审批
   ├── 部署审批
   └── 高风险操作审批

2. 监督型 — 随时可干预
   ├── 暂停/恢复
   ├── 调整优先级
   └── 修改任务

3. 协作型 — 人作为特殊 Worker
   └── 分配需要人工决策的任务
```

**权限分级：**

```
observer   — 只读，查看进度
developer  — 执行任务，不能改规划
reviewer   — 审批检查点，暂停/恢复
owner      — 完全控制
```

### 4.5 知识摄入管道

```
任意格式文档 ──→ 解析器 ──→ 统一格式(.md) ──→ 人工校验 ──→ 知识库

支持格式：
├── docx/doc  → markdown (保留结构)
├── pdf       → markdown (OCR if needed)
├── xlsx/xls  → markdown tables
├── png/jpg   → 描述文本 (Vision API)
├── txt       → 直接用
└── md        → 直接用
```

**知识结构：**

```
knowledge/
├── index.json              # 知识索引
├── requirements/           # 需求
├── design/                 # 设计
├── data/                   # 数据字典等
├── decisions/              # 架构决策记录
└── raw/                    # 原始文档备份
```

### 4.6 Git 集成（混合模式）

```
阶段完成 → 自动 commit
任务完成 → 可选 commit
高风险操作 → 人工确认后 push

并行开发 → Worktree 隔离
├── worktrees/T101-auth/    → branch: feature/auth
└── worktrees/T102-order/   → branch: feature/order
```

**提交策略：**

```
Phase 完成 → commit "feat(phase): 完成设计阶段"
Task 完成  → commit "feat(auth): 用户认证 API"
部署前     → 人工确认 → push
```

### 4.7 测试集成（混合模式）

```
┌─────────────────────────────────────────────────────────┐
│                    测试层级                              │
└─────────────────────────────────────────────────────────┘

L1: Agent 自测
    Worker 完成任务 → 自己跑单元测试 → 通过 → 标记完成

L2: QA Worker 复核
    Phase 完成 → QA Worker 全面测试 → 报告问题

L3: 可选 TDD
    先写测试任务 → 再写实现任务
```

### 4.8 错误处理（混合模式）

```
┌─────────────────────────────────────────────────────────┐
│                    错误处理层级                          │
└─────────────────────────────────────────────────────────┘

L1: Agent 自愈
    错误 → 分析 → 尝试修复（最多 N 次）

L2: 升级机制
    自愈失败 → 通知 Manager Worker
    Manager 无法解决 → 通知 Human

L3: 检查点回滚
    关键节点 → 保存检查点
    出错 → 回滚到上个检查点 → 重试或换方案
```

---

## 5. 用户工作流

### 5.1 初始化项目

```bash
$ webforge init my-saas
$ cd my-saas

# 生成结构
├── .webforge/
├── src/
└── README.md
```

### 5.2 喂入知识

```bash
$ webforge knowledge add prd.docx design-spec.pdf api-dict.xlsx

# 自动解析转换
→ .webforge/knowledge/requirements/prd.md
→ .webforge/knowledge/design/design-spec.md
→ .webforge/knowledge/data/api-dict.md

# 提示人工校验
→ "已转换 3 个文档，请确认内容是否正确"
```

### 5.3 规划

在 v0.2 中，规划由 `planning core` 负责：

- 读取 knowledge index
- 生成 phase / task 图
- 回写 `.webforge/tasks.json` 与 `.webforge/phases.json`
- CLI 只保留兼容触发入口

### 5.4 开发

在 v0.2 中，开发由 `runtime` 主循环负责：

- 从 ready 队列取任务
- 生成执行上下文
- 调用 agent 门面
- 持久化 deliverables / session / runtime

### 5.5 监控干预

```bash
$ webforge dashboard

# 可视化进度
# 随时暂停/调整/介入
```

### 5.6 会话恢复

```bash
# 下班、换电脑、新会话
$ webforge resume

# 完整恢复状态，继续工作
```

---

## 6. 核心技术选型

| 模块 | 选型 | 理由 |
|------|------|------|
| 运行时 | Node.js / TypeScript | 生态丰富，Web 开发友好 |
| CLI 框架 | Commander / Clack | 现代 CLI 体验 |
| 文件监听 | Chokidar | 跨平台稳定 |
| 进程管理 | Node child_process | 原生支持 |
| 文档解析 | Mammoth (docx), pdf-parse, xlsx | 成熟可靠 |
| 向量检索 | 可选：LanceDB / Chroma | 轻量嵌入式 |

---

## 7. 版本规划

### v0.1.0 — MVP

- [ ] compatibility CLI（init, knowledge, dashboard, resume）
- [ ] 基础 Worker 定义
- [ ] 任务板 + 状态流转
- [ ] 邮箱协作
- [ ] 知识摄入（docx, pdf, xlsx, txt, md）

### v0.2.0

- [ ] Web Dashboard
- [ ] Worktree 隔离
- [ ] 检查点回滚

### v0.3.0

- [ ] 动态 Worker 扩展
- [ ] MCP 工具扩展
- [ ] 向量检索

---

## 8. 关键约束

1. **不依赖特定 Agent** — 所有状态持久化，任何 Agent 可接管
2. **不阻塞等待同步** — 异步邮箱，Worker 独立运行
3. **不隐藏关键决策** — Human 审批节点可配置
4. **不过度抽象** — 文件系统为主，简单直接

---

## 附录 A: 消息协议详细定义

```typescript
interface Message {
  id: string                    // msg-001
  from: string                  // sender worker id
  to: string                    // receiver worker id or "broadcast"
  type: MessageType
  task_id?: string              // 关联任务
  content: string               // 消息内容
  timestamp: string             // ISO 8601
  metadata?: Record<string, any>
}
```

## 附录 B: 检查点结构

```typescript
interface Checkpoint {
  id: string
  phase: string
  timestamp: string
  tasks_snapshot: Task[]
  git_commit: string
  files_snapshot: string[]      // 文件列表
}
```

## 附录 C: 会话结构

```typescript
interface Session {
  id: string
  created_at: string
  last_active: string
  agent_type: string            // claude, gpt, gemini...
  agent_model: string           // claude-sonnet-4.6...
  active_worker: string
  context_summary: string       // 压缩后的上下文摘要
}
```
