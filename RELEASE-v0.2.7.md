# 🚀 Release v0.2.7

**@wandoupeas/coding-forge** 补丁版本发布

---

## 📦 版本信息

| 属性 | 值 |
|------|-----|
| 版本号 | `0.2.7` |
| 发布日期 | 2026-04-02 |
| 包大小 | 2.2 MB |
| 文件数 | 284 |
| npm 地址 | https://www.npmjs.com/package/@wandoupeas/coding-forge |

---

## 🆕 更新内容

### 改进与优化
- **优化 task 命令** - 改进任务管理功能和交互体验
- **增强 CLI 稳定性** - 提升命令执行可靠性

### 修复
- 修复 task 命令的边界情况处理
- 优化任务状态查询性能

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
| `webforge init` | 初始化 workspace |
| `webforge plan` | 从知识文档提取任务图 |
| `webforge run` | 执行 ready 队列中的任务 |
| `webforge onboard` | 引导式初始化 |
| `webforge doctor` | 诊断 workspace 健康状态 |
| `webforge resume` | 恢复会话 |
| `webforge dashboard` | 查看 workspace 总览 |
| `webforge ui` | 启动 Web UI |

### 任务管理

| 功能 | 描述 |
|------|------|
| `webforge task create` | 创建任务（支持 executionMode auto/manual）|
| `webforge task update` | 更新任务状态 |
| `webforge task list` | 列出任务 |
| `webforge task show` | 查看任务详情 |

### 进度通知

| 功能 | 描述 |
|------|------|
| `webforge record notify` | 快速通知任务进度 |

### 知识管理

| 功能 | 描述 |
|------|------|
| `webforge knowledge add` | 添加知识文档 |
| `webforge knowledge parse` | 解析知识文档 |
| `webforge knowledge list` | 列出知识文档 |
| `webforge knowledge link` | 关联知识与任务 |
| `webforge knowledge infer` | 推断任务相关知识 |

---

## 📋 系统要求

- **Node.js**: >= 18.0.0
- **操作系统**: Linux, macOS, Windows (WSL 推荐)

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/wandoupeas/coding-forge)
- [npm 包页面](https://www.npmjs.com/package/@wandoupeas/coding-forge)
- [命令参考](./docs/manuals/command-reference.md)
- [v0.2.6 Release](./RELEASE-v0.2.6.md)

---

## 🙏 致谢

感谢所有使用 Coding Forge 的开发者！

如有问题或建议，请在 [GitHub Issues](https://github.com/wandoupeas/coding-forge/issues) 中反馈。

---

**Happy Coding! 🔨**
