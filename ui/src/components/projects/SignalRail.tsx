import { Alert, Badge, Paper, Stack, Text } from '@mantine/core';
import type { ProjectsDashboardSnapshot } from '../../lib/api';
import { compareProjectHealth, getProjectHealth, type ProjectHealth } from './project-health';

interface SignalRailProps {
  projects: ProjectsDashboardSnapshot['projects'];
}

export default function SignalRail({ projects }: SignalRailProps) {
  const signals = buildSignals(projects);
  const visibleSignals = signals.slice(0, MAX_VISIBLE_SIGNALS);
  const hiddenSignalCount = signals.length - visibleSignals.length;

  return (
    <Paper component="aside" aria-label="信号栏" withBorder radius="md" p="md">
      <Stack gap="sm">
        <Stack gap={4}>
          <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
            信号栏
          </Text>
          <Text fw={700}>简明告警与快照变化。</Text>
          <Text size="sm" c="dimmed">
            阻塞、漂移或待审核的项目都压缩在此处。
          </Text>
        </Stack>

        {visibleSignals.length === 0 ? (
          <Alert color="green" radius="md" title="快照正常">
            当前仪表盘快照未产生紧急项目信号。
          </Alert>
        ) : (
          visibleSignals.map((signal) => (
            <Alert
              key={`${signal.projectId}-${signal.health.label}`}
              color={signal.health.color}
              radius="md"
              title={
                <Stack gap={4}>
                  <Text fw={700}>{signal.health.label}</Text>
                  <Badge variant="light" color={signal.health.color}>
                    {signal.projectName}
                  </Badge>
                </Stack>
              }
            >
              <Text size="sm" lh={1.55}>
                {signal.health.summary}
              </Text>
            </Alert>
          ))
        )}

        {hiddenSignalCount > 0 ? (
          <Alert color="gray" radius="md" title={`还有 ${hiddenSignalCount} 条信号`}>
            信号栏已设上限，以保持首页摘要简洁。
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}

function buildSignals(projects: ProjectsDashboardSnapshot['projects']) {
  return projects
    .map((entry) => {
      const health = getProjectHealth(entry);

      if (health.kind === 'healthy') {
        return null;
      }

      return {
        projectId: entry.project.id,
        projectName: entry.project.name,
        health
      };
    })
    .filter((signal): signal is { projectId: string; projectName: string; health: ProjectHealth } => signal !== null)
    .sort((a, b) => compareProjectHealth(a.health, b.health));
}

const MAX_VISIBLE_SIGNALS = 2;
