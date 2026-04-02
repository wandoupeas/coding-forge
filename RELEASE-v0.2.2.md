# 🚀 Release v0.2.2

**@wandoupeas/coding-forge** 补丁版本发布

---

## 📦 版本信息

| 属性 | 值 |
|------|-----|
| 版本号 | `0.2.2` |
| 发布日期 | 2026-04-02 |
| 包大小 | 2.2 MB |
| 文件数 | 280 |
| npm 地址 | https://www.npmjs.com/package/@wandoupeas/coding-forge |

---

## 🆕 更新内容

### 改进与优化
- **增强 knowledge 命令** - 支持批量解析和文档索引管理
- **优化 doctor 诊断** - 改进项目健康检查逻辑
- **提升 Web UI 稳定性** - 优化 React Router 兼容性和性能

### 修复
- 修复 knowledge 解析时的路径处理问题
- 修复 doctor 命令在某些边界情况下的异常
- 优化 CLI 命令输出格式

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

| 功能 | 描述 |
|------|------|
| `webforge init` | 初始化 workspace，支持 `--in-place` 就地初始化 |
| `webforge plan` | 从知识文档提取真实任务图 |
| `webforge record` | 旁路回写机制，记录工作上下文 |
| `webforge run` | 运行任务，支持 Codex/Claude Code |
| `webforge resume` | 恢复会话，显示下一步行动 |
| `webforge doctor` | 诊断 workspace 健康状态 |
| `webforge onboard` | 引导式初始化 |
| `webforge ui` | 启动研究终端式 Web UI |
| `webforge status` | 查看当前 workspace 状态 |
| `webforge knowledge` | 知识文档管理和批量解析 |

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
- [v0.2.1 Release](./RELEASE-v0.2.1.md)

---

## 🙏 致谢

感谢所有使用 Coding Forge 的开发者！

如有问题或建议，请在 [GitHub Issues](https://github.com/wandoupeas/coding-forge/issues) 中反馈。

---

**Happy Coding! 🔨**
