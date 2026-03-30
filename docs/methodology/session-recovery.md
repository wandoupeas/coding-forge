# Session Recovery

## 目标

无论是窗口关闭、模型切换还是上下文压缩，新会话都应该能恢复到“可继续工作”的状态。

## 恢复顺序

1. 读取 `.webforge/runtime.json`
2. 读取 `.webforge/tasks.json` / `.webforge/phases.json`
3. 读取 `.webforge/sessions/index.json`
4. 读取当前任务相关的 knowledge / deliverables

## 恢复输出

每次恢复至少要得到三件事：

- 当前状态摘要
- 最近会话的 next action
- 下一条最合理的执行路径

## 暂停前必须做什么

1. 回写 runtime
2. 回写 session
3. 把中间产物写成 deliverable 或 knowledge
4. 保证下一会话不用依赖聊天记录也能继续
