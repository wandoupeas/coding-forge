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
              摘要
            </Text>
            <Text fw={700}>恢复态势与当前路由摘要。</Text>
            <Text size="sm" c="dimmed">
              恢复压力、漂移和继续工作前需阅读内容的紧凑摘要。
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
              label="Doctor 诊断"
              value={`${recovery.doctor.summary.fail} 失败 / ${recovery.doctor.summary.warn} 警告`}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <SummaryFact label="漂移" value={recovery.contextDrift.status} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <SummaryFact label="线程" value={recovery.threadLinkage.status} />
          </Grid.Col>
        </Grid>

        <Paper withBorder radius="md" p="md">
          <Text className="forge-mono" size="xs" tt="uppercase" c="rgba(248,243,232,0.6)">
            下一步操作
          </Text>
          <Text mt={8} size="sm" lh={1.6}>
            {recovery.resume.nextAction}
          </Text>
        </Paper>

        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder radius="md" p="md">
              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
                优先阅读
              </Text>
              {recovery.resume.shouldRead.length === 0 ? (
                <Text mt="sm" size="sm" c="dimmed">
                  当前快照未推荐额外文件。
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
            <Alert color={recovery.canProceed ? 'green' : 'orange'} radius="md" title="可继续">
              <Text size="sm">
                {recovery.canProceed
                  ? '当前恢复快照可以直接继续，无需人工干预。'
                  : '此快照处于阻塞状态，请先检查恢复侧栏再继续。'}
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
