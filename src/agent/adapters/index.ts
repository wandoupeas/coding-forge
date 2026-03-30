import type { AgentProfileConfig } from '../../types/index.js';
import type { AgentRuntimeProfile } from '../context.js';
import type { AgentAdapter } from './base.js';
import { createClaudeCodeAgentAdapter } from './claude-code.js';
import { createCodexAgentAdapter } from './codex.js';
import { createStubAgentAdapter } from './stub.js';

export function normalizeRuntimeProfile(
  profile?: AgentProfileConfig
): AgentRuntimeProfile {
  return {
    provider: profile?.provider ?? 'stub',
    fallbackProvider: profile?.fallback_provider ?? 'stub',
    permissionProfile: profile?.permission_profile ?? 'workspace-write',
    model: profile?.model,
    command: profile?.command
  };
}

export function createAgentAdapter(profile: AgentRuntimeProfile): AgentAdapter {
  const fallback = createStubAgentAdapter();

  switch (profile.provider) {
    case 'codex':
      return createCodexAgentAdapter(fallback);
    case 'claude-code':
      return createClaudeCodeAgentAdapter(fallback);
    case 'stub':
    default:
      return fallback;
  }
}

export type { AgentAdapter } from './base.js';
