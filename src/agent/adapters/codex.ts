import type { AgentConfig, AgentExecutionInput, AgentExecutionResult } from '../context.js';
import type { AgentAdapter } from './base.js';
import {
  type CommandRunner,
  enrichResultMetadata,
  mapCodexArgs,
  readStructuredOutput,
  runCommand,
  withTemporarySchemaFiles
} from './command-bridge.js';

export function createCodexAgentAdapter(
  fallback: AgentAdapter,
  runner: CommandRunner = runCommand
): AgentAdapter {
  return {
    provider: 'codex',
    async execute(input: AgentExecutionInput, config: AgentConfig): Promise<AgentExecutionResult> {
      const command = config.runtimeProfile.command ?? 'codex';

      try {
        return await withTemporarySchemaFiles(async ({ schemaPath, outputPath }) => {
          const execution = await runner(
            mapCodexArgs(command, input, config, schemaPath, outputPath)
          );

          if (execution.exitCode !== 0) {
            throw new Error(execution.stderr.trim() || execution.stdout.trim() || 'codex failed');
          }

          const parsed = await readStructuredOutput(outputPath, execution.stdout);
          return enrichResultMetadata(parsed, 'codex', 'external-command', config);
        });
      } catch (error) {
        const fallbackResult = await fallback.execute(input, config);
        return enrichResultMetadata(fallbackResult, 'codex', 'bridge-fallback', config, {
          adapterFallbackProvider: fallback.provider,
          adapterError: error instanceof Error ? error.message : String(error)
        });
      }
    }
  };
}
