# WebForge 场景化使用手册

这份手册不是按命令组织，而是按“你现在处于什么场景”来组织。

适合三类读者：

- 人类开发者：想知道在业务仓库里怎么用 WebForge
- 仓库内工作的 agent：想知道进入仓库后先读什么、先做什么
- WebForge 框架维护者：想知道改框架本身时怎么验证不会把 contract 做裂

如果你只想查某个命令的参数，直接看 [`docs/manuals/command-reference.md`](./command-reference.md)。

## 怎么读这份文档

先判断你现在属于哪种场景：

1. 还没有仓库，要从 0 初始化一个项目
2. 仓库已经有 `.webforge/`，需要恢复并继续
3. 需求还没收敛，需要和 `superpowers` 协同做设计、规划和线程恢复
4. 已经进入执行阶段，需要观察 runtime、交付物和审核状态
5. 出现 drift、blocked、pending review 或恢复线索失效，需要排障
6. 你正在维护 WebForge 框架本身，而不是使用它来做业务开发

## 场景 A：从 0 初始化一个新项目

### 谁应该看

- 人类开发者
- 刚进新仓库的 agent
- 维护初始化模板的框架维护者

### 目标

把一个普通目录初始化成带 onboarding contract 的 WebForge 工作仓库，并确认初始化结果可恢复、可观察、可继续执行。

### 推荐步骤

1. 在 WebForge 框架仓库里先构建 CLI

```bash
cd <webforge-root>
npm install
npm run build
```

2. 初始化目标仓库

```bash
webforge init demo-app
cd demo-app
```

3. 查看 `init` 输出里的初始化后自检结果

你应该看到：

- `doctor: fail=0 | warn=0`
- `onboard: canProceed=yes`
- `验证入口: webforge verify init`

4. 如果你改过模板、或者想显式重跑自检

```bash
webforge verify init
webforge verify init --json
```

5. 做第一次 onboarding

```bash
webforge onboard --json
```

### 这个场景里应该生成什么

- `.webforge/`
- `AGENTS.md`
- `docs/agent-guide.md`
- `docs/methodology/superpowers-integration.md`
- `docs/examples/agent-onboarding-protocol.md`

### 人类开发者重点看什么

- `doctor.summary.fail`
- `resume.nextAction`
- `shouldRead`

### 仓库内 agent 重点看什么

- `canProceed`
- `recommendedActions`
- `runtimeLogCommand`
- `recoveryReadiness`

### 框架维护者重点看什么

- 新生成的协议文档是否和 `onboard` 输出一致
- `verify init` 是否仍然通过
- 模板字段是否和 `.webforge/` contract 同步

## 场景 B：继续一个已有 WebForge 项目

### 谁应该看

- 人类开发者
- 从上次会话恢复的 agent

### 目标

不要靠聊天记忆继续，而是靠仓库内状态恢复正确上下文，再决定是否继续执行。

### 最推荐入口

```bash
webforge onboard --json
```

### 建议解释顺序

1. 先看 `canProceed`
2. 再看 `doctor.summary.fail`
3. 再看 `recoveryReadiness.overallStatus`
4. 然后看 `resume.nextAction`
5. 最后按 `shouldRead` 精读必要文件

### 如果你想拆开排查

```bash
webforge doctor --json
webforge resume --json
webforge logs runtime --json
```

### 什么时候可以直接继续

- `doctor.summary.fail = 0`
- `onboard.canProceed = true`
- `resume.runtimeLog.contextDrift = aligned`
- `recoveryReadiness` 不是 `blocked`

### 什么时候应该先停下来核对

- `doctor` 出现 `runtime-context-drift`
- `resume.runtimeLog.contextDrift = drifted`
- `threadLinkage.status = blocked`
- `latestSuperpowersRun.status = blocked`
- `workflowContext` 指向的 `worktree / artifact / compact session` 缺失

### 仓库内 agent 的最小动作

1. 跑 `onboard --json`
2. 读 `shouldRead`
3. 必要时看 `runtimeLogCommand`
4. 再决定要不要执行、规划或恢复

## 场景 C：规划与 superpowers 协同

### 谁应该看

- 人类开发者
- 负责规划的 agent
- 想把 `superpowers` 结果接回 `.webforge/` 的维护者

### 目标

让设计、规划、线程恢复和 compact 成为仓库内可恢复的事实，而不是只存在于聊天里。

### 推荐工作顺序

1. 问题还在发散时，用 `brainstorming`
2. spec 稳定后，用 `writing-plans`
3. 进入按波次推进时，用 `subagent-driven-development`
4. 会话太长时，用 `strategic-compact`
5. workflow 结束后，把结果回写到 `.webforge/superpowers-runs.json`

### 回写方式

```bash
webforge superpowers record writing-plans \
  --summary "approved spec converted into execution plan" \
  --artifact plan:docs/superpowers/plans/demo-plan.md \
  --task T001
```

### 你需要确保哪些线索被回写

- `artifact`
- `threadId`
- `branch`
- `worktreePath`
- `waveId`
- `compactFromSession`

### 为什么这一步重要

因为后续的：

- `doctor`
- `onboard`
- `resume`
- `logs runtime`

都会拿这些线索来判断当前上下文还能不能恢复。

### 维护者需要特别检查什么

- `superpowers run` 和 task / session / runtime 上的 `workflowContext` 是否一致
- `thread linkage` 是否真的落到 `.webforge/threads.json`
- compact 来源 session 是否还能被读取

## 场景 D：执行、观察与收口

### 谁应该看

- 人类开发者
- 执行 ready task 的 agent
- 想观察 runtime 行为的维护者

### 目标

把 `plan -> run -> observe -> review -> close` 做成稳定闭环。

### 推荐顺序

1. 预览 ready task

```bash
webforge run --dry-run
```

2. 执行

```bash
webforge run
```

3. 观察结果

```bash
webforge dashboard
webforge logs runtime
webforge deliverables
```

4. 审核交付物

```bash
webforge review T001 --approve -m "looks good"
webforge review del-001 --reject -m "needs changes"
```

### 这个场景里各命令各管什么

- `dashboard`
  看当前摘要、最近 runtime 观察、thread linkage、workflow context
- `logs runtime`
  看完整 runtime 事件流，以及日志对应快照和当前工作区快照
- `deliverables`
  看任务和产物是否已经落盘
- `review`
  把审核结果写回 deliverable 状态和 mailbox 消息流

### 什么时候算真正收口

- 任务状态已更新
- deliverable 已落盘
- 如需审核，已经发出 `approval_request` 或回写 `approval_result`
- runtime 日志里能解释本轮发生了什么

## 场景 E：异常与恢复

### 谁应该看

- 业务项目团队
- 恢复失败的 agent
- 框架维护者

### 目标

不要把异常都理解成“重跑一次”。先确定是哪条恢复链断了，再对症处理。

### 常见异常 1：`runtime-context-drift`

表现：

- `doctor` 出现 `runtime-context-drift`
- `resume.runtimeLog.contextDrift = drifted`

处理顺序：

1. 先跑 `webforge logs runtime --json`
2. 对比日志快照和当前工作区快照
3. 判断是 branch / worktree / thread / compact 线索漂移，还是任务事实已经变化
4. 再决定沿当前上下文继续，还是回看历史 runtime 后再推进

### 常见异常 2：`blocked`

可能来源：

- 依赖未满足
- permission profile 阻止执行
- thread / worktree 线索缺失

处理顺序：

1. 看 `tasks.json`
2. 看 `dashboard`
3. 看 `logs runtime`
4. 如需恢复历史状态，再决定是否 `checkpoint rollback`

### 常见异常 3：`pending_review`

表现：

- 没有 ready task，但 deliverable 处于待审

处理顺序：

1. 跑 `webforge deliverables`
2. 跑 `webforge review ...`
3. 再看 mailbox 是否已有 `approval_result`

### 常见异常 4：`thread linkage blocked`

表现：

- `onboard.recoveryReadiness.threadLinkage.status = blocked`
- `resume.threadLinkage.status = blocked`

通常说明：

- `thread object` 缺失
- artifact 丢失
- worktree 路径失效

### 常见异常 5：`compact session missing`

表现：

- `compactFromSession` 存在，但对应 `.webforge/sessions/<id>.json` 不存在

处理顺序：

1. 不要盲目继续
2. 先确认最近一次 `superpowers run`
3. 再确认是否还有别的恢复线索能替代

### 常见异常 6：需要回滚

```bash
webforge checkpoint list
webforge checkpoint rollback <checkpoint-id> --restore-deliverables
```

什么时候考虑回滚：

- 当前 runtime 已经把任务或交付物写坏
- 你需要恢复到某个已知 checkpoint 的任务图和交付物快照

## 场景 F：维护 WebForge 框架本身

### 谁应该看

- WebForge 框架维护者

### 目标

改 CLI、contract、模板、恢复协议时，不把“新初始化仓库”和“已有仓库恢复入口”做裂开。

### 最重要的维护路径

1. 改模板或初始化输出
2. 跑 `webforge verify init`
3. 跑 `npm run smoke:onboarding`
4. 跑 `npm run test:coverage`

### 典型维护场景

#### 改初始化模板

重点检查：

- `AGENTS.md`
- `docs/agent-guide.md`
- `docs/methodology/superpowers-integration.md`
- `docs/examples/agent-onboarding-protocol.md`

不要只改模板文案，还要确认：

- `onboard` 输出仍然和模板契约一致
- `verify init` 仍然能用

#### 改恢复协议

重点检查：

- `doctor --json`
- `resume --json`
- `logs runtime --json`
- `onboard --json`

你要保证四者对 `workflowContext / threadLinkage / contextDrift` 的语义保持一致。

#### 改 superpowers 集成

重点检查：

- `.webforge/superpowers-runs.json`
- `.webforge/threads.json`
- task / session / runtime 上的 `workflowContext`

### 维护者的最低验证集

```bash
npm run build
npm run smoke:onboarding
npm run test:coverage
```

如果这三步里有任何一步不过，不要宣称 contract 已稳定。

## 最后怎么选入口

如果你还在犹豫先跑哪个命令，用这张简表：

- 新项目初始化后：`webforge onboard --json`
- 已有项目恢复：`webforge onboard --json`
- 只想看契约是否健康：`webforge doctor --json`
- 只想知道下一步：`webforge resume --json`
- 想看最近 runtime 发生了什么：`webforge logs runtime --json`
- 想显式重跑初始化后自检：`webforge verify init --json`
- 想按命令查细节：看 [`docs/manuals/command-reference.md`](./command-reference.md)
