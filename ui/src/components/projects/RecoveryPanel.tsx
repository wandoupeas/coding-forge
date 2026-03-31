import { Alert, Badge, Grid, Group, List, Paper, Stack, Text } from '@mantine/core';
import type { ApiProjectRecovery } from '../../lib/api';

interface RecoveryPanelProps {
  recovery: ApiProjectRecovery;
}

export default function RecoveryPanel({ recovery }: RecoveryPanelProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
              Summary
            </Text>
            <Text fw={700}>Recovery posture and current route summary.</Text>
            <Text size="sm" c="dimmed">
              A compact summary of resume pressure, drift, and what to read before continuing.
            </Text>
          </Stack>
          <Badge
            variant="light"
            color={recovery.status === 'ready' ? 'forgeLime' : 'forgeRust'}
            radius="xl"
          >
            {recovery.status}
          </Badge>
        </Group>

        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <SummaryFact
              label="Doctor"
              value={`${recovery.doctor.summary.fail} fail / ${recovery.doctor.summary.warn} warn`}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <SummaryFact label="Drift" value={recovery.contextDrift.status} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <SummaryFact label="Thread" value={recovery.threadLinkage.status} />
          </Grid.Col>
        </Grid>

        <Paper withBorder radius="md" p="md">
          <Text className="forge-mono" size="xs" tt="uppercase" c="rgba(248,243,232,0.6)">
            Next action
          </Text>
          <Text mt={8} size="sm" lh={1.6}>
            {recovery.resume.nextAction}
          </Text>
        </Paper>

        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder radius="md" p="md">
              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
                Read first
              </Text>
              {recovery.resume.shouldRead.length === 0 ? (
                <Text mt="sm" size="sm" c="dimmed">
                  No additional files were recommended for this snapshot.
                </Text>
              ) : (
                <List mt="sm" spacing="xs" size="sm">
                  {recovery.resume.shouldRead.slice(0, 4).map((entry) => (
                    <List.Item key={entry}>
                      <Text className="forge-mono" size="sm">
                        {entry}
                      </Text>
                    </List.Item>
                  ))}
                </List>
              )}
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Alert color={recovery.canProceed ? 'green' : 'orange'} radius="md" title="Can proceed">
              <Text size="sm">
                {recovery.canProceed
                  ? 'The current recovery snapshot can proceed without manual intervention.'
                  : 'This snapshot is blocked. Check the recovery rail before continuing.'}
              </Text>
            </Alert>
          </Grid.Col>
        </Grid>
      </Stack>
    </Paper>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
        {label}
      </Text>
      <Text className="forge-mono" size="sm" mt={6}>
        {value}
      </Text>
    </Paper>
  );
}
