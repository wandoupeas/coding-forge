# Harness Principles

## 核心判断

一个好的 harness 不是替 agent 思考，而是让 agent 在中断、切换模型、切换会话后仍能继续工作。

## 原则

1. 真相持久化
   项目状态必须落在仓库里，而不是聊天上下文里。
2. 状态与方法分离
   `.webforge/` 保存事实，`superpowers` 提供方法。
3. 主循环唯一
   runtime 应拥有唯一执行主循环，避免 CLI、Agent、脚本各自维护一套流程。
4. 观察与执行分离
   dashboard / resume / mailbox 属于观察入口，不应该偷偷承担编排职责。
5. 恢复优先
   任何一次暂停后，新会话都应能仅靠仓库文件恢复。
6. 索引优先
   先读 index，再读具体文件，避免靠目录猜测状态。
7. 交付物可追踪
   每个任务的输出都应进入 deliverable index。
8. 兼容而不混乱
   可以同时支持 Codex 和 Claude Code，但要共享同一套仓库契约。
