# WebForge Skill

## 快速开始

当用户使用 WebForge 时，遵循以下流程：

```bash
# 1. 检查/初始化项目
if [ ! -d ".webforge" ]; then
  # 创建目录结构
  mkdir -p .webforge/{knowledge/{requirements,design,parsed,decisions},deliverables,workers/{pm,backend,frontend,qa,devops}}
  
  # 创建初始配置
  echo "project:\n  name: 项目名称\n  version: 0.1.0" > .webforge/config.yaml
  echo '{"tasks":[]}' > .webforge/tasks.json
  echo '{"phases":[]}' > .webforge/phases.json
fi

# 2. 读取详细 Skill 规范
cat .kimi/skills/webforge.md
```

## 核心文件

- **`.kimi/skills/webforge.md`** - 完整的 Skill 使用指南
- **`AGENTS.md`** - Agent 协作规范说明
- **`.webforge/`** - 项目工作空间

## 一句话理解

> WebForge 是 Agent 的项目管理办公室，你直接读写 `.webforge/` 文件来协作开发。
