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
                运行时
              </Text>
              <Text fw={700}>事件脉搏、检查点与恢复证据。</Text>
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
              邮箱 {runtime.mailboxes.unreadMessages}
            </Badge>
            <Badge variant="light" color="forgeInk" radius="xl">
              检查点 {runtime.checkpoints.total}
            </Badge>
            <Badge variant="light" color="forgeInk" radius="xl">
              增强层 {runtime.superpowers.totalRuns}
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
                最近事件
              </Text>
              <ScrollArea h={300} type="auto" offsetScrollbars>
                <Stack gap="sm">
                  {events.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      尚未记录任何运行时事件。
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
                            task={event.taskId ?? 'none'} / 权限={event.permissionProfile ?? '未知'}
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
                检查点 + 信号
              </Text>
              <KeyValueRow
                label="最新检查点"
                value={runtime.checkpoints.latest?.name ?? 'none'}
              />
              <KeyValueRow
                label="最新运行时会话"
                value={runtime.latestObservation?.sessionId ?? 'none'}
              />
              <KeyValueRow
                label="最后运行时事件"
                value={runtime.latestObservation?.lastEvent ?? 'none'}
              />
              <KeyValueRow
                label="最新增强层运行"
                value={runtime.superpowers.latestRun?.workflow ?? 'none'}
              />

              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed" mt="sm">
                队列
              </Text>
              <Stack gap="xs">
                {runtime.checkpoints.items.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    暂无检查点记录。
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
          快照对照
        </Text>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <RuntimeSnapshotComparison
            title="运行时日志快照"
            workflowContext={recovery.runtimeLogs?.workflowContext ?? null}
            threadLinkage={recovery.runtimeLogs?.threadLinkage ?? null}
          />
          <RuntimeSnapshotComparison
            title="当前工作区快照"
            workflowContext={recovery.runtimeLogs?.currentWorkflowContext ?? null}
            threadLinkage={recovery.runtimeLogs?.currentThreadLinkage ?? null}
          />
        </SimpleGrid>

        {recovery.contextDrift.reasons.length > 0 ? (
          <Alert color="orange" radius="md" title="漂移原因">
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
