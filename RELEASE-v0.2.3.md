# 🚀 Release v0.2.3

**@wandoupeas/coding-forge** 补丁版本发布

---

## 📦 版本信息

| 属性 | 值 |
|------|-----|
| 版本号 | `0.2.3` |
| 发布日期 | 2026-04-02 |
| 包大小 | 2.2 MB |
| 文件数 | 280 |
| npm 地址 | https://www.npmjs.com/package/@wandoupeas/coding-forge |

---

## 🆕 更新内容

### 改进与优化
- **优化 knowledge 命令** - 改进文档解析性能和索引管理
- **增强运行时稳定性** - 修复异步任务处理的边界情况
- **改进错误处理** - 更友好的错误提示和日志输出

### 修复
- 修复某些情况下路径解析的问题
- 修复 CLI 输出中的格式化问题
- 优化 Web UI 的资源加载

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
- [v0.2.2 Release](./RELEASE-v0.2.2.md)

---

## 🙏 致谢

感谢所有使用 Coding Forge 的开发者！

如有问题或建议，请在 [GitHub Issues](https://github.com/wandoupeas/coding-forge/issues) 中反馈。

---

**Happy Coding! 🔨**
