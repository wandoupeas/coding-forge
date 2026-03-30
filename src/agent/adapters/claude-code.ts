import type { AgentConfig, AgentExecutionInput, AgentExecutionResult } from '../context.js';
import type { AgentAdapter } from './base.js';
import {
  type CommandRunner,
  enrichResultMetadata,
  mapClaudeArgs,
  parseAgentExecutionResult,
  runCommand
} from './command-bridge.js';

export function createClaudeCodeAgentAdapter(
  fallback: AgentAdapter,
  runner: CommandRunner = runCommand
): AgentAdapter {
  return {
    provider: 'claude-code',
    async execute(input: AgentExecutionInput, config: AgentConfig): Promise<AgentExecutionResult> {
      const command = config.runtimeProfile.command ?? 'claude';

      try {
        const execution = await runner(mapClaudeArgs(command, input, config));
        if (execution.exitCode !== 0) {
          throw new Error(execution.stderr.trim() || execution.stdout.trim() || 'claude failed');
        }

        const parsed = parseAgentExecutionResult(execution.stdout);
        return enrichResultMetadata(parsed, 'claude-code', 'external-command', config);
      } catch (error) {
        const fallbackResult = await fallback.execute(input, config);
        return enrichResultMetadata(
          fallbackResult,
          'claude-code',
          'bridge-fallback',
          config,
          {
            adapterFallbackProvider: fallback.provider,
            adapterError: error instanceof Error ? error.message : String(error)
          }
        );
      }
    }
  };
}
