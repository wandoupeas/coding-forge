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
    <Paper component="aside" aria-label="Signal rail" withBorder radius="md" p="md">
      <Stack gap="sm">
        <Stack gap={4}>
          <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
            Signal Rail
          </Text>
          <Text fw={700}>Concise alerts and snapshot deltas.</Text>
          <Text size="sm" c="dimmed">
            Anything blocked, drifting, or waiting on review is compressed here.
          </Text>
        </Stack>

        {visibleSignals.length === 0 ? (
          <Alert color="green" radius="md" title="Snapshot clear">
            No urgent project signals were produced by the current dashboard snapshot.
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
          <Alert color="gray" radius="md" title={`+${hiddenSignalCount} more signals`}>
            The rail is capped to keep the homepage summary concise.
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
