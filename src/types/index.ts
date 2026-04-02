/**
 * WebForge 核心类型定义
 */

// ==================== Task 类型 ====================

export type TaskStatus = 
  | 'pending'      // 初始状态
  | 'ready'        // 依赖满足，可认领
  | 'in_progress'  // 执行中
  | 'blocked'      // 被阻塞
  | 'completed'    // 完成
  | 'failed';      // 失败

export type TaskExecutionMode =
  | 'auto'         // 由 runtime 主循环执行 (webforge run)
  | 'manual';      // 由 Agent 直接执行后手动通知 (webforge record notify)

export type TaskModule = 
  | 'frontend'     // 前端开发
  | 'backend'      // 后端开发
  | 'database'     // 数据库
  | 'auth'         // 认证授权
  | 'testing'      // 测试
  | 'architecture' // 架构设计
  | 'devops'       // 运维部署
  | 'pm';          // 项目管理

export interface Task {
  id: string;                    // T101
  phase: string;                 // P2 (后端开发)
  title: string;
  description?: string;
  status: TaskStatus;
  assignee: string;              // worker id
  depends_on: string[];          // ["T100"]
  blocked_by?: string[];         // ["P2"] or ["T100"]
  priority: number;              // 1-5
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
  completed_at?: string;         // ISO 8601
  executionMode?: TaskExecutionMode;  // 执行模式，默认 'auto'
  workflowContext?: WorkspaceWorkflowContext;
  metadata?: Record<string, any>;
  /**
   * 任务涉及的模块/领域列表
   * 用于自动推断关联的知识文档
   * 示例: ["frontend", "auth"]
   */
  modules?: TaskModule[];
  /**
   * 关联的知识文档路径列表
   * 用于 onboard 时推荐 Agent 先阅读相关文档
   * 示例: [".webforge/knowledge/decisions/ADR-001-clean-architecture.md"]
   */
  knowledgeRefs?: string[];
}

// ==================== Phase 类型 ====================

export type PhaseStatus = 
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed';

export interface Phase {
  id: string;                    // P1, P2, ...
  name: string;                  // 设计、后端开发...
  description?: string;
  status: PhaseStatus;
  progress: number;              // 0-100
  depends_on: string[];          // 依赖的其他阶段
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// ==================== Worker 类型 ====================

export type WorkerState = 
  | 'idle'
  | 'busy'
  | 'paused'
  | 'error';

export interface Worker {
  id: string;
  role: string;                  // pm, frontend, backend, qa, devops
  name: string;
  description: string;
  skills: string[];
  tools: string[];
  state: WorkerState;
  current_task?: string;
  system_prompt?: string;
}

export interface WorkerConfig {
  role: string;
  name: string;
  description: string;
  skills: string[];
  tools: string[];
  system_prompt: string;
}

// ==================== Message 类型 ====================

export type MessageType =
  | 'task_assign'        // 分配任务
  | 'task_complete'      // 任务完成
  | 'task_blocked'       // 任务阻塞
  | 'question'           // 提问
  | 'answer'             // 回答
  | 'notification'       // 通知
  | 'approval_request'   // 审批请求
  | 'approval_result';   // 审批结果

export interface Message {
  id: string;                    // msg-001
  from: string;                  // sender worker id
  to: string;                    // receiver worker id or "broadcast"
  type: MessageType;
  task_id?: string;              // 关联任务
  content: string;               // 消息内容
  timestamp: string;             // ISO 8601
  read?: boolean;                // 是否已读
  metadata?: Record<string, any>;
}

// ==================== 配置类型 ====================

export interface ProjectConfig {
  name: string;
  version: string;
  description: string;
}

export interface OrchestratorConfig {
  max_parallel_workers: number;
  checkpoint_interval: number;
}

export type AgentProvider = 'stub' | 'codex' | 'claude-code';

export type AgentPermissionProfile =
  | 'read-only'
  | 'workspace-write'
  | 'approval-required';

export interface AgentProfileConfig {
  provider: AgentProvider;
  fallback_provider?: AgentProvider;
  permission_profile: AgentPermissionProfile;
  model?: string;
  command?: string;
}

export interface WebForgeConfig {
  project: ProjectConfig;
  orchestrator: OrchestratorConfig;
  agent?: AgentProfileConfig;
  workers: string[];
  phases: Phase[];
}

// ==================== Workspace 类型 ====================

export type WorkspaceVersion = '0.2';

export type WorkspaceRuntimeStatus =
  | 'idle'
  | 'active'
  | 'blocked'
  | 'error';

export interface WorkspaceRuntime {
  version: WorkspaceVersion;
  status: WorkspaceRuntimeStatus;
  updatedAt: string;
  sessionId: string | null;
  phaseId: string | null;
  taskId: string | null;
  summary: string;
  workflowContext: WorkspaceWorkflowContext | null;
}

export interface WorkspacePaths {
  root: string;
  workspace: string;
  config: string;
  tasks: string;
  phases: string;
  runtime: string;
  superpowers: string;
  superpowersRuns: string;
  knowledge: string;
  knowledgeIndex: string;
  knowledgeRequirements: string;
  knowledgeDesign: string;
  knowledgeDecisions: string;
  knowledgeParsed: string;
  deliverables: string;
  deliverablesIndex: string;
  sessions: string;
  sessionsIndex: string;
  threadsIndex: string;
  mailboxes: string;
  logs: string;
}

export type WorkspaceKnowledgeEntryType =
  | 'requirement'
  | 'design'
  | 'decision'
  | 'parsed'
  | 'note';

export interface WorkspaceKnowledgeIndexEntry {
  id: string;
  type: WorkspaceKnowledgeEntryType;
  title: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export type WorkspaceDeliverableStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export type WorkspaceDeliverableType =
  | 'document'
  | 'code'
  | 'test'
  | 'config'
  | 'design'
  | 'review';

export interface WorkspaceDeliverableIndexEntry {
  id: string;
  taskId: string;
  type: WorkspaceDeliverableType;
  title: string;
  path: string;
  createdBy: string;
  createdAt: string;
  status: WorkspaceDeliverableStatus;
  reviewComment?: string;
}

export type WorkspaceSessionStatus = 'active' | 'paused' | 'completed';

export interface WorkspaceSessionIndexEntry {
  id: string;
  name: string;
  createdAt: string;
  lastActive: string;
  status: WorkspaceSessionStatus;
  currentPhase?: string;
  currentTask?: string;
  context?: string;
  workflowContext?: WorkspaceWorkflowContext;
  stats: {
    tasksCompleted: number;
    totalTasks: number;
  };
}

export interface WorkspaceIndexes {
  knowledge: WorkspaceKnowledgeIndexEntry[];
  deliverables: WorkspaceDeliverableIndexEntry[];
  sessions: WorkspaceSessionIndexEntry[];
  threads: WorkspaceThreadLink[];
  superpowersRuns: WorkspaceSuperpowersRun[];
}

export interface WorkspaceState {
  basePath: string;
  paths: WorkspacePaths;
  runtime: WorkspaceRuntime;
  tasks: { tasks: Task[] };
  phases: { phases: Phase[] };
  indexes: WorkspaceIndexes;
}

export interface WorkspaceInitOptions {
  projectName: string;
  template?: string;
}

export type WorkspaceSuperpowersExecutionMode = 'subagent' | 'inline';

export type WorkspaceSuperpowersCapabilityKind = 'workflow';

export type WorkspaceSuperpowersCapabilityOwner = 'superpowers';

export interface WorkspaceSuperpowersCapability {
  id: string;
  kind: WorkspaceSuperpowersCapabilityKind;
  owner: WorkspaceSuperpowersCapabilityOwner;
  purpose: string;
  writes: string[];
  artifacts: string[];
  recommended: boolean;
}

export interface WorkspaceSuperpowersRegistry {
  version: '1';
  required: string[];
  optional: string[];
  execution: WorkspaceSuperpowersExecutionMode | null;
  generatedAt: string;
  capabilities: WorkspaceSuperpowersCapability[];
  techStack?: Record<string, unknown>;
}

export interface WorkspaceWorkflowContext {
  workflow: string;
  runId?: string;
  recordedAt?: string;
  summary?: string;
  owner?: string;
  waveId?: string;
  threadId?: string;
  branch?: string;
  worktreePath?: string;
  compactFromSession?: string;
  artifacts?: string[];
}

export type WorkspaceSuperpowersArtifactKind =
  | 'note'
  | 'knowledge'
  | 'decision'
  | 'plan'
  | 'compact-handoff'
  | 'thread'
  | 'worktree-metadata';

export interface WorkspaceSuperpowersArtifact {
  kind: WorkspaceSuperpowersArtifactKind;
  path: string;
  label?: string;
}

export interface WorkspaceSuperpowersRunMetadata {
  owner?: string;
  waveId?: string;
  threadId?: string;
  branch?: string;
  worktreePath?: string;
  compactFromSession?: string;
}

export interface WorkspaceSuperpowersRun {
  id: string;
  workflow: string;
  recordedAt: string;
  summary: string;
  taskId?: string;
  sessionId?: string;
  artifacts: WorkspaceSuperpowersArtifact[];
  metadata?: WorkspaceSuperpowersRunMetadata;
}

export interface WorkspaceThreadLink {
  id: string;
  recordedAt: string;
  workflow: string;
  summary: string;
  runId?: string;
  taskId?: string;
  sessionId?: string;
  owner?: string;
  branch?: string;
  worktreePath?: string;
  artifacts: string[];
}

// ==================== 检查点类型 ====================

export interface CheckpointDeliverableSnapshot {
  id: string;
  taskId: string;
  type: WorkspaceDeliverableType;
  title: string;
  path: string;
  content: string;
  createdBy: string;
  createdAt: string;
  status: WorkspaceDeliverableStatus;
  reviewComment?: string;
  snapshotPath: string;
}

export interface Checkpoint {
  id: string;
  name: string;
  createdAt: string;
  description?: string;
  tasks: Task[];
  phases: Phase[];
  gitCommit?: string;
  deliverables: CheckpointDeliverableSnapshot[];
}

// ==================== 会话类型 ====================

export interface Session {
  id: string;
  created_at: string;
  last_active: string;
  agent_type: string;            // claude, gpt, gemini...
  agent_model: string;
  active_worker?: string;
  context_summary?: string;
}

// ==================== CLI 类型 ====================

export interface RunOptions {
  dryRun?: boolean;
  phase?: string;
  worker?: string;
}

export interface InitOptions {
  template?: string;
}
