# WebForge Skill

## 快速开始

当用户使用 WebForge 时，不要先发明新的外部编排流程。先按当前仓库契约进入：

```bash
# 1. 读取 Skill 规范
cat ./webforge.md

# 2. 如果仓库已有 .webforge，优先恢复
webforge onboard --json

# 3. 如果仓库还没有 .webforge，先初始化再继续
webforge init demo-app
```

## 核心文件

- **`webforge.md`** - 完整的 Skill 使用指南
- **`AGENTS.md`** - Agent 协作规范说明
- **`.webforge/`** - 项目工作空间

## 一句话理解

> WebForge 是仓库内的 harness，不是外层 orchestrator；你直接以 agent 身份读取和回写 `.webforge/` 来持续工作。
