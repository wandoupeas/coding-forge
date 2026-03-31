import { Box, Group, List, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { ApiProjectRecovery } from '../../lib/api';

interface RecoveryPanelProps {
  recovery: ApiProjectRecovery;
}

export default function RecoveryPanel({ recovery }: RecoveryPanelProps) {
  return (
    <Box
      style={{
        padding: '1.15rem',
        borderRadius: 24,
        background: 'rgba(22, 32, 40, 0.94)',
        color: '#f8f3e8'
      }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="forge-mono" size="xs" tt="uppercase" c="rgba(248,243,232,0.68)">
              Recovery
            </Text>
            <Title order={3} style={{ color: '#fff7eb', fontSize: '1.45rem' }}>
              Resume, drift, and recovery posture in one panel.
            </Title>
          </Stack>
          <StatusChip label={recovery.status} />
        </Group>

        <Group gap="sm" wrap="wrap">
          <Fact label="Doctor" value={`${recovery.doctor.summary.fail} fail / ${recovery.doctor.summary.warn} warn`} />
          <Fact label="Drift" value={recovery.contextDrift.status} />
          <Fact label="Thread" value={recovery.threadLinkage.status} />
        </Group>

        <Box
          style={{
            padding: '0.95rem 1rem',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          <Text className="forge-mono" size="xs" tt="uppercase" c="rgba(248,243,232,0.6)">
            Next action
          </Text>
          <Text mt={8} lh={1.6}>
            {recovery.resume.nextAction}
          </Text>
        </Box>

        <Group align="stretch" grow>
          <MetaColumn
            title="Workflow context"
            rows={[
              ['workflow', recovery.workflowContext?.workflow ?? 'none'],
              ['branch', recovery.workflowContext?.branch ?? 'none'],
              ['worktree', recovery.workflowContext?.worktreePath ?? 'none'],
              ['thread', recovery.workflowContext?.threadId ?? 'none'],
              ['compact', recovery.workflowContext?.compactFromSession ?? 'none']
            ]}
          />
          <MetaColumn
            title="Thread linkage"
            rows={[
              ['status', recovery.threadLinkage.status],
              ['workflow', recovery.threadLinkage.workflow ?? 'none'],
              ['branch', recovery.threadLinkage.branch ?? 'none'],
              ['worktree', recovery.threadLinkage.worktreePath ?? 'none'],
              [
                'missing',
                recovery.threadLinkage.missingArtifacts[0] ??
                  recovery.threadLinkage.missingWorktreePath ??
                  recovery.threadLinkage.missingThreadId ??
                  'none'
              ]
            ]}
          />
        </Group>

        <Box>
          <Text className="forge-mono" size="xs" tt="uppercase" c="rgba(248,243,232,0.6)">
            Recommended actions
          </Text>
          <List mt="sm" spacing="xs" icon={<ThemeIcon radius="xl" size={18} color="forgeLime">•</ThemeIcon>}>
            {recovery.recommendedActions.slice(0, 4).map((action) => (
              <List.Item key={action}>
                <Text size="sm" lh={1.55}>
                  {action}
                </Text>
              </List.Item>
            ))}
          </List>
        </Box>
      </Stack>
    </Box>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box
      style={{
        padding: '0.45rem 0.75rem',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.05)'
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase" c="rgba(248,243,232,0.78)">
        {label}: {value}
      </Text>
    </Box>
  );
}

function StatusChip({ label }: { label: string }) {
  const color = label === 'ready' ? 'rgba(151,199,31,0.18)' : 'rgba(212,78,33,0.16)';

  return (
    <Box
      style={{
        padding: '0.45rem 0.75rem',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.08)',
        background: color
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase">
        {label}
      </Text>
    </Box>
  );
}

function MetaColumn({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <Box
      style={{
        flex: 1,
        padding: '0.95rem 1rem',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase" c="rgba(248,243,232,0.6)">
        {title}
      </Text>
      <Stack gap={8} mt="sm">
        {rows.map(([label, value]) => (
          <Group key={label} justify="space-between" gap="md">
            <Text size="sm" c="rgba(248,243,232,0.72)">
              {label}
            </Text>
            <Text className="forge-mono" size="xs">
              {value}
            </Text>
          </Group>
        ))}
      </Stack>
    </Box>
  );
}
