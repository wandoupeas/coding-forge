# 🚀 Release v0.2.6

**@wandoupeas/coding-forge** 补丁版本发布

---

## 📦 版本信息

| 属性 | 值 |
|------|-----|
| 版本号 | `0.2.6` |
| 发布日期 | 2026-04-02 |
| 包大小 | 2.2 MB |
| 文件数 | 284 |
| npm 地址 | https://www.npmjs.com/package/@wandoupeas/coding-forge |

---

## 🆕 更新内容

### 新增功能

#### 1. Task 命令 - 完整的任务管理

新增 `webforge task` 命令，支持任务的完整生命周期管理：

```bash
# 创建任务
webforge task create T010 \
  --title "实现用户登录接口" \
  --phase P2 \
  --execution-mode auto

# 更新任务
webforge task update T010 --status in_progress

# 列出任务
webforge task list --status ready

# 查看任务详情
webforge task show T010
```

#### 2. 任务执行模式 (Execution Mode)

任务现在支持两种执行模式：

- **`auto`**（默认）- 由 `webforge run` 通过 worker adapter 自动执行
- **`manual`** - 由 agent 直接执行，适合需要人工判断或复杂交互的任务

创建任务时指定：
```bash
webforge task create T011 \
  --title "前端性能优化" \
  --execution-mode manual \
  --modules frontend
```

#### 3. 任务知识关联 (KnowledgeRefs)

任务可以关联知识文档，支持：

- 手动指定知识文档：`--knowledge ADR-005 frontend-guidelines`
- 自动推断：根据任务标题和模块自动匹配相关文档
- 模块标记：`--modules frontend backend database`

```bash
webforge task create T012 \
  --title "优化数据库查询" \
  --knowledge ADR-005 \
  --modules database backend
```

#### 4. Record Notify - 快速任务进度更新

新增 `webforge record notify` 命令，允许 agent 快速更新任务状态，无需运行完整的 runtime 循环：

```bash
# 快速更新任务状态
webforge record notify --task T010 --status completed

# 自动推断当前任务
webforge record notify --auto --status completed

# 完成任务并传播依赖（自动解锁下游任务）
webforge record notify --task T004 --status completed --propagate
```

#### 5. 知识管理增强

- **`webforge knowledge link`** - 手动关联知识文档与任务
- **`webforge knowledge infer`** - 根据任务内容推断相关文档
- 知识目录结构约束和验证

### 改进与优化

- 增强 task 命令的稳定性和错误处理
- 优化知识文档的自动推断算法
- 改进 CLI 输出格式和提示信息

### 修复

- 修复 task 命令的边界情况处理
- 优化任务状态查询性能
- 修复知识文档路径解析问题

---

## 📥 安装与升级

```bash
# 全新安装
npm install -g @wandoupeas/coding-forge

# 升级现有版本
npm update -g @wandoupeas/coding-forge

# 验证版本
webforge --version
```

---

## 🎯 核心功能速览

### 基础命令

| 功能 | 描述 |
|------|------|
| `webforge init` | 初始化 workspace，支持 `--in-place` 就地初始化 |
| `webforge plan` | 从知识文档提取真实任务图 |
| `webforge run` | 执行 ready 队列中的任务 |
| `webforge onboard` | 引导式初始化 |
| `webforge doctor` | 诊断 workspace 健康状态 |
| `webforge resume` | 恢复会话，显示下一步行动 |
| `webforge dashboard` | 查看 workspace 总览 |
| `webforge ui` | 启动研究终端式 Web UI |

### 任务管理（新增）

| 功能 | 描述 |
|------|------|
| `webforge task create` | 创建新任务，支持 executionMode 和知识关联 |
| `webforge task update` | 更新任务状态和属性 |
| `webforge task list` | 列出任务，支持过滤 |
| `webforge task show` | 查看任务详情 |

### 进度通知（新增）

| 功能 | 描述 |
|------|------|
| `webforge record notify` | 快速通知任务进度，无需运行 runtime |

### 知识管理

| 功能 | 描述 |
|------|------|
| `webforge knowledge add` | 添加知识文档 |
| `webforge knowledge parse` | 解析知识文档 |
| `webforge knowledge list` | 列出知识文档 |
| `webforge knowledge link` | 关联知识与任务 |
| `webforge knowledge infer` | 推断任务相关知识 |

### 交付与审核

| 功能 | 描述 |
|------|------|
| `webforge deliverables` | 查看交付物 |
| `webforge review` | 审核交付物 |
| `webforge checkpoint` | 检查点管理 |

---

## 🏗️ Web UI 特性

- 研究终端式监控台界面
- 项目索引 + Workspace Ledger + Signal Rail 三栏布局
- 统一项目详情页骨架（Summary / Evidence / Runtime）
- 基于 Mantine UI 的简洁设计

---

## 📋 系统要求

- **Node.js**: >= 18.0.0
- **操作系统**: Linux, macOS, Windows (WSL 推荐)

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/wandoupeas/coding-forge)
- [npm 包页面](https://www.npmjs.com/package/@wandoupeas/coding-forge)
- [命令参考](./docs/manuals/command-reference.md)
- [v0.2.5 Release](./RELEASE-v0.2.5.md)

---

## 🙏 致谢

感谢所有使用 Coding Forge 的开发者！

如有问题或建议，请在 [GitHub Issues](https://github.com/wandoupeas/coding-forge/issues) 中反馈。

---

**Happy Coding! 🔨**
