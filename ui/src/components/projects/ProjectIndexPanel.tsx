import { Badge, NavLink, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { ProjectsDashboardSnapshot } from '../../lib/api';
import { getProjectHealth, summarizeProjectHealth } from './project-health';

interface ProjectIndexPanelProps {
  projects: ProjectsDashboardSnapshot['projects'];
}

export default function ProjectIndexPanel({ projects }: ProjectIndexPanelProps) {
  const counts = summarizeProjectHealth(projects);

  return (
    <Paper component="nav" aria-label="Project index" withBorder radius="md" p="md">
      <Stack gap="sm">
        <Stack gap={4}>
          <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
            Project Index
          </Text>
          <Text fw={700}>Workspace navigation and state summary.</Text>
          <Text size="sm" c="dimmed">
            Compact entry points for every indexed workspace.
          </Text>
        </Stack>

        <Stack gap={6}>
          <Badge variant="light" color="forgeLime" radius="xl">
            {counts.healthy} healthy
          </Badge>
          <Badge variant="light" color="forgeRust" radius="xl">
            {counts.blocked} blocked
          </Badge>
          <Badge variant="light" color="forgeInk" radius="xl">
            {counts.watch} watch
          </Badge>
        </Stack>

        <ScrollArea h={420} type="auto" offsetScrollbars>
          <Stack gap={8}>
            {projects.length === 0 ? (
              <Text c="dimmed">No WebForge projects found.</Text>
            ) : (
              projects.map((entry) => {
                const status = getProjectHealth(entry);

                return (
                  <NavLink
                    key={entry.project.id}
                    component={Link}
                    to={`/projects/${entry.project.id}`}
                    label={entry.project.name}
                    description={entry.project.rootPath}
                    leftSection={
                      <Badge
                        radius="xl"
                        variant="light"
                        color={status.color}
                        style={{ textTransform: 'uppercase' }}
                      >
                        {status.label}
                      </Badge>
                    }
                    rightSection={<Text className="forge-mono">{entry.project.id}</Text>}
                    styles={{
                      root: {
                        borderRadius: '0.9rem',
                        border: '1px solid var(--mantine-color-default-border)',
                        background: 'var(--mantine-color-body)'
                      },
                      label: {
                        fontWeight: 700
                      },
                      description: {
                        fontFamily: 'var(--mantine-font-family-monospace)'
                      }
                    }}
                  />
                );
              })
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}
