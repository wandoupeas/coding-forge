/**
 * init 命令 - 初始化项目
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';
import { createWorkspace } from '../../core/workspace.js';
import { buildDoctorReport } from './doctor.js';
import { buildOnboardingSummary } from './onboard.js';
import { writeText } from '../../utils/file.js';

export interface InitVerificationSummary {
  protocolDocPath: string;
  protocolDocExists: boolean;
  doctorFailCount: number;
  doctorWarnCount: number;
  onboardCanProceed: boolean;
  shouldReadHasAgents: boolean;
  ok: boolean;
}

export function createInitCommand(): Command {
  const command = new Command('init')
    .description('初始化 WebForge 项目')
    .argument('<project-name>', '项目名称')
    .option('-t, --template <template>', '项目模板', 'default')
    .option('--in-place', '在当前目录就地初始化（不创建子目录）')
    .action(async (projectName: string, options: { template?: string; inPlace?: boolean }) => {
      try {
        await initProject(projectName, options);
      } catch (error) {
        logger.error(`初始化失败: ${error}`);
        process.exit(1);
      }
    });

  return command;
}

export async function initProject(
  projectName: string,
  options: { template?: string; inPlace?: boolean },
  basePath: string = process.cwd()
): Promise<void> {
  logger.info(`初始化项目: ${projectName}\n`);

  const projectRoot = options.inPlace ? basePath : join(basePath, projectName);
  const state = await createWorkspace(projectRoot, {
    projectName,
    template: options.template
  });
  await scaffoldRepoContract(projectRoot, projectName);
  const verification = await buildInitVerificationSummary(projectRoot);

  if (!verification.ok) {
    throw new Error(
      `初始化后自检失败: doctor.fail=${verification.doctorFailCount}, doctor.warn=${verification.doctorWarnCount}, onboard.canProceed=${verification.onboardCanProceed}, protocolDocExists=${verification.protocolDocExists}, shouldReadHasAgents=${verification.shouldReadHasAgents}`
    );
  }

  logger.h1('项目初始化完成!');
  logger.h2('初始化后自检');
  logger.info(`doctor: fail=${verification.doctorFailCount} | warn=${verification.doctorWarnCount}`);
  logger.info(`onboard: canProceed=${verification.onboardCanProceed ? 'yes' : 'no'}`);
  logger.info(`protocol doc: ${verification.protocolDocPath}`);
  logger.info('验证入口: webforge verify init');
  console.log();
  logger.info('下一步:');
  const nextSteps = options.inPlace
    ? [
        `workspace: ${state.paths.workspace}`,
        `runtime: ${state.paths.runtime}`,
        'webforge onboard --json',
        '如需重跑初始化后自检，执行 webforge verify init',
        '必要时再拆开执行 webforge doctor / webforge resume / webforge logs runtime',
        '把需求文档放进 .webforge/knowledge/requirements/'
      ]
    : [
        `cd ${projectName}`,
        `workspace: ${state.paths.workspace}`,
        `runtime: ${state.paths.runtime}`,
        'webforge onboard --json',
        '如需重跑初始化后自检，执行 webforge verify init',
        '必要时再拆开执行 webforge doctor / webforge resume / webforge logs runtime',
        '把需求文档放进 .webforge/knowledge/requirements/'
      ];
  logger.list(nextSteps);
  console.log();
}

async function scaffoldRepoContract(projectRoot: string, projectName: string): Promise<void> {
  await writeIfMissing(join(projectRoot, 'AGENTS.md'), renderAgentsTemplate(projectName));
  await writeIfMissing(join(projectRoot, 'docs', 'agent-guide.md'), renderAgentGuideTemplate(projectName));
  await writeIfMissing(
    join(projectRoot, 'docs', 'methodology', 'superpowers-integration.md'),
    renderSuperpowersTemplate(projectName)
  );
  await writeIfMissing(
    join(projectRoot, 'docs', 'examples', 'agent-onboarding-protocol.md'),
    renderOnboardingProtocolTemplate(projectName)
  );
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  if (existsSync(path)) {
    return;
  }

  await writeText(path, content);
}

export async function buildInitVerificationSummary(
  projectRoot: string
): Promise<InitVerificationSummary> {
  const protocolDocPath = join(projectRoot, 'docs', 'examples', 'agent-onboarding-protocol.md');
  const [doctor, onboarding] = await Promise.all([
    buildDoctorReport(projectRoot),
    buildOnboardingSummary(projectRoot)
  ]);
  const protocolDocExists = existsSync(protocolDocPath);
  const shouldReadHasAgents = onboarding.shouldRead.includes('AGENTS.md');
  const ok =
    protocolDocExists &&
    doctor.summary.fail === 0 &&
    doctor.summary.warn === 0 &&
    onboarding.canProceed === true &&
    shouldReadHasAgents;

  return {
    protocolDocPath,
    protocolDocExists,
    doctorFailCount: doctor.summary.fail,
    doctorWarnCount: doctor.summary.warn,
    onboardCanProceed: onboarding.canProceed,
    shouldReadHasAgents,
    ok
  };
}

function renderAgentsTemplate(projectName: string): string {
  return `# ${projectName} WebForge 契约

这个仓库使用 WebForge 作为 repo-side harness。
你应直接以 Codex / Claude Code 身份在仓库里工作，并把 \`.webforge/\` 作为状态真相源。

---

## ⚠️ 强制规范（MANDATORY）

### 所有工作必须通过 WebForge CLI

**严禁绕过 webforge 直接操作以下事项：**

1. ✅ **Plan 创建** - 必须使用 \`webforge plan\` 生成规划
2. ✅ **任务管理** - 必须使用 \`webforge task\` 创建/更新任务状态
3. ✅ **阶段管理** - 必须使用 webforge 命令更新 phases 状态
4. ✅ **Runtime 更新** - 不得直接修改 \`.webforge/runtime.json\`
5. ✅ **Bug 修复** - 必须为每个 bug 创建任务，通过 webforge 跟踪
6. ✅ **新功能开发** - 必须先创建任务，再开始编码
7. ✅ **文档添加** - 知识文档需通过 \`webforge knowledge\` 管理
8. ✅ **初始化项目** - 必须使用 \`webforge init\`，不得手动创建目录结构
9. ✅ **框架/组件引用** - 涉及架构变更必须通过 webforge 任务跟踪

### 链式更新要求

每完成一个任务，必须按顺序执行：

\`\`\`bash
# 1. 更新任务状态
webforge task update <task-id> --status completed

# 2. 检查 runtime 状态
webforge resume --json

# 3. 提交代码（详细提交信息）
git add .
git commit -m "<task-id>: <task-title>

- <change-1>
- <change-2>
- <change-3>"
\`\`\`

### 禁止直接操作的文件

| 文件/目录 | 正确操作方式 |
|----------|-------------|
| \`.webforge/runtime.json\` | \`webforge run\`, \`webforge task update\` |
| \`.webforge/tasks.json\` | \`webforge task\` 命令 |
| \`.webforge/phases.json\` | \`webforge plan\`, \`webforge task\` |
| \`.webforge/sessions/\` | \`webforge session\` 命令 |
| \`.webforge/knowledge/\` | \`webforge knowledge\` 命令 |
| \`.webforge/deliverables/\` | \`webforge deliverables\` 命令 |

### 代码提交规范

每个任务完成后必须提交，提交信息格式：

\`\`\`
<task-id>: <task-title>

- <具体变更1>
- <具体变更2>
- <具体变更3>
\`\`\`

**示例：**
\`\`\`
T015: 修复前端TypeScript错误

- 修复 React 19 useRef 需要初始值的问题
- 替换 useRequest 为 useEffect + useState
- 修复 ProTable render 函数参数类型
\`\`\`

---

## 标准 Onboarding Protocol

进入仓库后，默认先按这条协议工作：

1. 运行 \`webforge onboard --json\`
2. 读取返回的 \`shouldRead\`
3. 检查 \`recommendedActions\`
4. 如果 \`runtimeLogCommand\` 存在且出现 drift / blocked 信号，再运行对应的 \`webforge logs runtime <session>\`
5. 如需示例，直接看 \`docs/examples/agent-onboarding-protocol.md\`

如果你不走统一入口，至少也要按这个顺序拆开执行：

1. \`webforge doctor --json\`
2. \`webforge resume --json\`
3. 必要时 \`webforge logs runtime --json\`

## 进入仓库后的读取顺序

1. 读取 \`.webforge/runtime.json\`
2. 读取 \`.webforge/tasks.json\`
3. 读取 \`.webforge/phases.json\`
4. 读取 \`.webforge/sessions/index.json\`
5. 读取 \`.webforge/knowledge/index.json\`
6. 必要时再读取具体 knowledge、deliverable、mailbox 内容

## 工作原则

1. 不要发明第二套仓库外编排。
2. 所有状态变化都回写到 \`.webforge/\`。
3. CLI 是观察面和校验面，不是事实来源。
4. 如需方法增强，可使用 \`superpowers\`，但它不是状态数据库。
5. **所有任务必须通过 webforge CLI 创建和跟踪，禁止直接操作任务文件。**
6. **每完成一个任务必须立即提交代码，提交信息必须包含 task-id 和详细变更说明。**

## 开始工作前

1. 先读本文件和 \`.webforge/\`
2. 优先运行 \`webforge onboard --json\`
3. 如果出现 \`runtime-context-drift\` 或 \`contextDrift=drifted\`，先回看 runtime 日志
4. 再决定下一步工作
5. **检查当前任务状态，确认是否有进行中的任务**
6. **如需新任务，必须先通过 \`webforge task create\` 创建**

---

*规范版本: 2.0*
*更新日期: 2026-04-02*
*生效范围: 所有 Agent 操作*
`;
}

function renderAgentGuideTemplate(projectName: string): string {
  return `# ${projectName} Agent Guide

## 目标

本仓库通过 WebForge 约束 Codex / Claude Code 的工作方式，而不是再包一层外部 orchestrator。

## 建议工作顺序

1. 读取 \`AGENTS.md\`
2. 运行 \`webforge onboard --json\`
3. 按 \`shouldRead\` 读取 \`.webforge/runtime.json\`、\`tasks.json\`、\`sessions/index.json\` 等文件
4. 如果 \`recommendedActions\` 提示 drift，先运行 \`webforge logs runtime <session>\`
5. 如需照着执行的示例，先看 \`docs/examples/agent-onboarding-protocol.md\`
6. 需要设计时使用 \`brainstorming\`
7. 需要计划时使用 \`writing-plans\`
8. 完成工作后把结果回写到 \`.webforge/\`

## 恢复协议

\`onboard --json\` 是统一入口，会合并：

- \`doctor --json\`
- \`resume --json\`
- 最近一次 runtime 日志跳转
- 当前 \`workflow context / thread linkage\` 的恢复健康度

如果你需要拆开排查，按这个顺序：

1. \`webforge doctor --json\`
2. \`webforge resume --json\`
3. \`webforge logs runtime --json\`

当 \`doctor\` 出现 \`runtime-context-drift\`，或 \`resume.runtimeLog.contextDrift=drifted\` 时，不要直接沿当前上下文继续，先核对最近 runtime 与当前 workspace 的差异。

## 最低回写要求

- 任务推进: 更新 \`.webforge/tasks.json\`
- 执行状态: 更新 \`.webforge/runtime.json\`
- 新知识: 更新 \`.webforge/knowledge/\`
- 新交付物: 更新 \`.webforge/deliverables/\`
`;
}

function renderSuperpowersTemplate(projectName: string): string {
  return `# ${projectName} Superpowers Integration

## 边界

- WebForge 负责仓库状态、恢复入口和执行协议
- superpowers 负责设计、计划、评审、compact、线程化恢复等方法增强

## 推荐映射

- 设计收敛: \`brainstorming\`
- 计划拆解: \`writing-plans\`
- 实施执行: \`subagent-driven-development\`
- 会话压缩: \`strategic-compact\`
- 长程偏好学习: \`continuous-learning-v2\`

## 与恢复协议的连接点

- superpowers 产物必须回写到 \`.webforge/superpowers-runs.json\`
- thread / compact / worktree 线索必须能被 \`doctor / onboard / resume / logs\` 读到
- 如果最新 workflow 结果和当前 workspace 已经漂移，优先让 agent 回看 runtime 日志，而不是盲目继续

## 禁止事项

1. 不要把 superpowers 当作 \`.webforge/\` 的替代品
2. 不要把 superpowers 当作唯一记忆源
3. 不要让方法层覆盖仓库内状态契约
`;
}

function renderOnboardingProtocolTemplate(projectName: string): string {
  return `# ${projectName} Agent Onboarding Protocol

这份文档给进入本仓库工作的 Codex / Claude Code 使用。

目标只有一个：先恢复正确上下文，再决定要不要继续实现。

## 标准入口

优先使用统一入口：

\`\`\`bash
webforge onboard --json
\`\`\`

你需要从输出里依次处理：

1. \`doctor.summary\`
   如果 \`fail > 0\`，先修仓库契约，不要直接开发。
2. \`resume.shouldRead\`
   只读取这些必要文件，不要一上来扫描整个仓库。
3. \`resume.nextAction\`
   这是当前最推荐的下一步。
4. \`recommendedActions\`
   如果这里提示 drift / blocked / pending_review，先处理这些信号。

## 拆开排查时的顺序

如果你不想走统一入口，按这个顺序：

\`\`\`bash
webforge doctor --json
webforge resume --json
webforge logs runtime --json
\`\`\`

含义分别是：

- \`doctor --json\`
  看仓库契约是否完整，以及最近 runtime 上下文有没有和当前 workspace 脱节
- \`resume --json\`
  看下一步该做什么，以及应该读哪些文件
- \`logs runtime --json\`
  看最近 runtime 事件流、日志恢复快照、当前工作区恢复快照

## 遇到 drift 时怎么做

如果出现下面任一信号：

- \`doctor.checks.runtime-context-drift.status = warn\`
- \`resume.runtimeLog.contextDrift.status = drifted\`
- \`recommendedActions\` 明确要求先回看 runtime

那么先执行：

\`\`\`bash
webforge logs runtime
\`\`\`

先确认：

1. 最近 runtime 对应的 \`workflowContext / threadLinkage\`
2. 当前工作区最新的 \`workflowContext / threadLinkage\`
3. 两者为什么不同

没有核对 drift 之前，不要默认沿当前上下文直接继续。

## 开始实现前至少要读

- \`AGENTS.md\`
- \`.webforge/runtime.json\`
- \`.webforge/tasks.json\`
- \`.webforge/sessions/index.json\`
- \`.webforge/knowledge/index.json\`

如果 \`shouldRead\` 还带了其他文件，以 \`shouldRead\` 为准。

## 完成后必须回写

- 任务变化回写到 \`.webforge/tasks.json\`
- 执行状态回写到 \`.webforge/runtime.json\`
- 新知识回写到 \`.webforge/knowledge/\`
- 新交付物回写到 \`.webforge/deliverables/\`

一句话：

\`\`\`text
onboard --json -> read shouldRead -> inspect drift if needed -> execute -> write back to .webforge/
\`\`\`
`;
}
