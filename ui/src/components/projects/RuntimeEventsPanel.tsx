import { Box, Group, Stack, Text, Title } from '@mantine/core';
import type { ApiProjectRecovery, ApiProjectRuntime } from '../../lib/api';

interface RuntimeEventsPanelProps {
  runtime: ApiProjectRuntime;
  recovery: ApiProjectRecovery;
}

export default function RuntimeEventsPanel({ runtime, recovery }: RuntimeEventsPanelProps) {
  const events = recovery.runtimeLogs?.events ?? [];

  return (
    <Box
      style={{
        padding: '1.15rem',
        borderRadius: 24,
        border: '1px solid rgba(22,32,40,0.1)',
        background: 'rgba(255,255,255,0.72)'
      }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
              Runtime
            </Text>
            <Title order={3} style={{ fontSize: '1.45rem' }}>
              Event pulse, checkpoint history, and mailbox pressure.
            </Title>
          </Stack>
          <FactPill label="Drift" value={recovery.contextDrift.status} />
        </Group>

        <Group grow align="stretch">
          <StatCard label="Runtime status" value={runtime.runtime.status} />
          <StatCard label="Unread mailbox" value={String(runtime.mailboxes.unreadMessages)} />
          <StatCard label="Checkpoints" value={String(runtime.checkpoints.total)} />
          <StatCard label="Superpowers runs" value={String(runtime.superpowers.totalRuns)} />
        </Group>

        <Group grow align="stretch">
          <Box
            style={{
              flex: 1.3,
              padding: '0.95rem 1rem',
              borderRadius: 18,
              background: 'rgba(22,32,40,0.94)',
              color: '#f8f3e8'
            }}
          >
            <Text className="forge-mono" size="xs" tt="uppercase" c="rgba(248,243,232,0.68)">
              Recent runtime events
            </Text>
            <Stack mt="sm" gap="sm">
              {events.length === 0 ? (
                <Text size="sm" c="rgba(248,243,232,0.78)">
                  No runtime events have been recorded yet.
                </Text>
              ) : (
                events.slice(0, 6).map((event) => (
                  <Box
                    key={`${event.timestamp}-${event.message}`}
                    style={{
                      padding: '0.75rem 0.9rem',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    <Text className="forge-mono" size="xs" c="rgba(248,243,232,0.66)">
                      {event.timestamp}
                    </Text>
                    <Text mt={6} size="sm">
                      {event.message}
                    </Text>
                    <Text mt={6} className="forge-mono" size="xs" c="rgba(248,243,232,0.66)">
                      task={event.taskId ?? 'none'} / permission={event.permissionProfile ?? 'unknown'}
                    </Text>
                  </Box>
                ))
              )}
            </Stack>
          </Box>

          <Box
            style={{
              flex: 0.9,
              padding: '0.95rem 1rem',
              borderRadius: 18,
              border: '1px solid rgba(22,32,40,0.08)',
              background: 'rgba(255,255,255,0.62)'
            }}
          >
            <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
              Checkpoint + signals
            </Text>
            <Stack mt="sm" gap="sm">
              <FactRow
                label="Latest checkpoint"
                value={runtime.checkpoints.latest?.name ?? 'none'}
              />
              <FactRow
                label="Latest runtime session"
                value={runtime.latestObservation?.sessionId ?? 'none'}
              />
              <FactRow
                label="Last runtime event"
                value={runtime.latestObservation?.lastEvent ?? 'none'}
              />
              <FactRow
                label="Latest superpowers run"
                value={runtime.superpowers.latestRun?.workflow ?? 'none'}
              />
            </Stack>

            <Text
              mt="lg"
              className="forge-mono"
              size="xs"
              tt="uppercase"
              c="dimmed"
            >
              Checkpoint queue
            </Text>
            <Stack mt="sm" gap="xs">
              {runtime.checkpoints.items.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No checkpoints recorded.
                </Text>
              ) : (
                runtime.checkpoints.items.map((checkpoint) => (
                  <Box
                    key={checkpoint.id}
                    style={{
                      padding: '0.7rem 0.8rem',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.68)',
                      border: '1px solid rgba(22,32,40,0.08)'
                    }}
                  >
                    <Text fw={600}>{checkpoint.name}</Text>
                    <Text mt={4} className="forge-mono" size="xs" c="dimmed">
                      {checkpoint.id} · {checkpoint.createdAt}
                    </Text>
                  </Box>
                ))
              )}
            </Stack>
          </Box>
        </Group>

        <Group grow align="stretch">
          <SnapshotColumn
            title="Log snapshot"
            workflowContext={recovery.runtimeLogs?.workflowContext ?? null}
            threadLinkage={recovery.runtimeLogs?.threadLinkage ?? null}
          />
          <SnapshotColumn
            title="Current workspace"
            workflowContext={recovery.runtimeLogs?.currentWorkflowContext ?? null}
            threadLinkage={recovery.runtimeLogs?.currentThreadLinkage ?? null}
          />
        </Group>

        {recovery.contextDrift.reasons.length > 0 ? (
          <Box
            style={{
              padding: '0.95rem 1rem',
              borderRadius: 18,
              border: '1px solid rgba(22,32,40,0.08)',
              background: 'rgba(255,255,255,0.58)'
            }}
          >
            <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
              Drift reasons
            </Text>
            <Stack mt="sm" gap="xs">
              {recovery.contextDrift.reasons.map((reason) => (
                <Text key={reason} size="sm">
                  {reason}
                </Text>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Box
      style={{
        padding: '0.9rem 1rem',
        borderRadius: 18,
        border: '1px solid rgba(22,32,40,0.08)',
        background: 'rgba(255,255,255,0.58)'
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
        {label}
      </Text>
      <Title order={4} mt={8}>
        {value}
      </Title>
    </Box>
  );
}

function FactPill({ label, value }: { label: string; value: string }) {
  return (
    <Box
      style={{
        padding: '0.45rem 0.75rem',
        borderRadius: 999,
        border: '1px solid rgba(22,32,40,0.1)',
        background: 'rgba(255,255,255,0.62)'
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase">
        {label}: {value}
      </Text>
    </Box>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text className="forge-mono" size="xs">
        {value}
      </Text>
    </Group>
  );
}

function SnapshotColumn({
  title,
  workflowContext,
  threadLinkage
}: {
  title: string;
  workflowContext:
    | NonNullable<ApiProjectRecovery['runtimeLogs']>['workflowContext']
    | NonNullable<ApiProjectRecovery['runtimeLogs']>['currentWorkflowContext'];
  threadLinkage:
    | NonNullable<ApiProjectRecovery['runtimeLogs']>['currentThreadLinkage']
    | ApiProjectRecovery['threadLinkage']
    | null;
}) {
  return (
    <Box
      style={{
        flex: 1,
        padding: '0.95rem 1rem',
        borderRadius: 18,
        border: '1px solid rgba(22,32,40,0.08)',
        background: 'rgba(255,255,255,0.62)'
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
        {title}
      </Text>
      <Stack mt="sm" gap="sm">
        <FactRow label="workflow" value={workflowContext?.workflow ?? 'none'} />
        <FactRow label="branch" value={workflowContext?.branch ?? 'none'} />
        <FactRow label="worktree" value={workflowContext?.worktreePath ?? 'none'} />
        <FactRow label="thread" value={threadLinkage?.threadId ?? 'none'} />
        <FactRow label="thread status" value={threadLinkage?.status ?? 'none'} />
      </Stack>
    </Box>
  );
}
