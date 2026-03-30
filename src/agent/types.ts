/**
 * Agent 类型定义
 */

export interface AgentConfig {
  name: string;
  systemPrompt: string;
  tools: string[];
  model?: string;
}

export interface AgentTask {
  task: string;
  description?: string;
  context: string;
  phase: string;
}

export interface AgentResult {
  success: boolean;
  output?: string;
  error?: string;
}
