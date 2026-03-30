# Codex + Claude Code Compatibility

## 共同点

Codex 和 Claude Code 都可以：

- 读取 `.webforge/`
- 解释任务图和阶段图
- 通过 session / runtime 恢复上下文
- 生成并回写 deliverables

## 兼容层的真正对象

兼容的不是交互细节，而是仓库内的事实模型：

- 同一份 `runtime.json`
- 同一份 `tasks.json`
- 同一份 `sessions/index.json`
- 同一份 `knowledge/index.json`

## 差异如何处理

- 模型的推理风格不同：由 agent 自己处理
- 可用工具不同：由各自的 tool surface 处理
- 技能生态不同：通过方法增强层适配

WebForge 不要求它们“表现一样”，只要求它们“读写同一套真相”。
