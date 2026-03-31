import { Alert, Badge, Grid, Group, Paper, ScrollArea, SimpleGrid, Stack, Text } from '@mantine/core';
import type { ApiProjectRecovery, ApiProjectRuntime } from '../../lib/api';
import RuntimeSnapshotComparison from './RuntimeSnapshotComparison';

interface RuntimeEventsPanelProps {
  runtime: ApiProjectRuntime;
  recovery: ApiProjectRecovery;
}

export default function RuntimeEventsPanel({ runtime, recovery }: RuntimeEventsPanelProps) {
  const events = recovery.runtimeLogs?.events ?? [];

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
                Runtime
              </Text>
              <Text fw={700}>Event pulse, checkpoints, and recovery evidence.</Text>
            </Stack>
            <Badge
              variant="light"
              color={runtime.runtime.status === 'ready' ? 'forgeLime' : 'forgeRust'}
              radius="xl"
            >
              {runtime.runtime.status}
            </Badge>
          </Group>

          <Group gap="xs">
            <Badge variant="light" color="forgeInk" radius="xl">
              mailbox {runtime.mailboxes.unreadMessages}
            </Badge>
            <Badge variant="light" color="forgeInk" radius="xl">
              checkpoints {runtime.checkpoints.total}
            </Badge>
            <Badge variant="light" color="forgeInk" radius="xl">
              superpowers {runtime.superpowers.totalRuns}
            </Badge>
            <Badge
              variant="light"
              color={recovery.contextDrift.status === 'drifted' ? 'forgeRust' : 'forgeInk'}
              radius="xl"
            >
              drift {recovery.contextDrift.status}
            </Badge>
          </Group>
        </Stack>
      </Paper>

      <Grid gutter="md" align="start">
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
                Recent events
              </Text>
              <ScrollArea h={300} type="auto" offsetScrollbars>
                <Stack gap="sm">
                  {events.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      No runtime events have been recorded yet.
                    </Text>
                  ) : (
                    events.slice(0, 8).map((event) => (
                      <Paper key={`${event.timestamp}-${event.message}`} withBorder radius="md" p="sm">
                        <Stack gap={6}>
                          <Text className="forge-mono" size="xs" c="dimmed">
                            {event.timestamp}
                          </Text>
                          <Text size="sm">{event.message}</Text>
                          <Text className="forge-mono" size="xs" c="dimmed">
                            task={event.taskId ?? 'none'} / permission={event.permissionProfile ?? 'unknown'}
                          </Text>
                        </Stack>
                      </Paper>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
                Checkpoint + signals
              </Text>
              <KeyValueRow
                label="Latest checkpoint"
                value={runtime.checkpoints.latest?.name ?? 'none'}
              />
              <KeyValueRow
                label="Latest runtime session"
                value={runtime.latestObservation?.sessionId ?? 'none'}
              />
              <KeyValueRow
                label="Last runtime event"
                value={runtime.latestObservation?.lastEvent ?? 'none'}
              />
              <KeyValueRow
                label="Latest superpowers run"
                value={runtime.superpowers.latestRun?.workflow ?? 'none'}
              />

              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed" mt="sm">
                Queue
              </Text>
              <Stack gap="xs">
                {runtime.checkpoints.items.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No checkpoints recorded.
                  </Text>
                ) : (
                  runtime.checkpoints.items.map((checkpoint) => (
                    <Paper key={checkpoint.id} withBorder radius="md" p="sm">
                      <Text fw={600}>{checkpoint.name}</Text>
                      <Text mt={4} className="forge-mono" size="xs" c="dimmed">
                        {checkpoint.id} · {checkpoint.createdAt}
                      </Text>
                    </Paper>
                  ))
                )}
              </Stack>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      <Stack gap="lg">
        <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
          Snapshots comparison
        </Text>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <RuntimeSnapshotComparison
            title="Runtime log snapshot"
            workflowContext={recovery.runtimeLogs?.workflowContext ?? null}
            threadLinkage={recovery.runtimeLogs?.threadLinkage ?? null}
          />
          <RuntimeSnapshotComparison
            title="Current workspace snapshot"
            workflowContext={recovery.runtimeLogs?.currentWorkflowContext ?? null}
            threadLinkage={recovery.runtimeLogs?.currentThreadLinkage ?? null}
          />
        </SimpleGrid>

        {recovery.contextDrift.reasons.length > 0 ? (
          <Alert color="orange" radius="md" title="Drift reasons">
            <Stack gap="xs">
              {recovery.contextDrift.reasons.map((reason) => (
                <Text key={reason} size="sm">
                  {reason}
                </Text>
              ))}
            </Stack>
          </Alert>
        ) : null}
      </Stack>
    </Stack>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text className="forge-mono" size="sm">
        {value}
      </Text>
    </Stack>
  );
}
