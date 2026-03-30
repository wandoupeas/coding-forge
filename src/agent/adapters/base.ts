import type {
  AgentConfig,
  AgentExecutionInput,
  AgentExecutionResult
} from '../context.js';
import type { AgentProvider } from '../../types/index.js';

export interface AgentExecutionEngine {
  execute(
    input: AgentExecutionInput,
    config: AgentConfig
  ): Promise<AgentExecutionResult>;
}

export interface AgentAdapter extends AgentExecutionEngine {
  provider: AgentProvider;
}
