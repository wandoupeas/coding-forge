import { Badge, Grid, Group, Paper, Stack, Tabs, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiProjectRecovery } from '../../lib/api';
import ProjectRecoveryRail from './ProjectRecoveryRail';

export type ProjectDetailTab = 'summary' | 'evidence' | 'runtime';

interface ProjectDetailShellProps {
  projectId: string;
  title: string;
  rootPath: string;
  activeTab: ProjectDetailTab;
  recovery: ApiProjectRecovery;
  children: ReactNode;
}

export default function ProjectDetailShell({
  projectId,
  title,
  rootPath,
  activeTab,
  recovery,
  children
}: ProjectDetailShellProps) {
  const navigate = useNavigate();

  return (
    <Stack gap="lg">
      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
                项目详情
              </Text>
              <Title order={2} style={{ fontSize: 'clamp(1.6rem, 2.2vw, 2.5rem)' }}>
                {title}
              </Title>
              <Text className="forge-mono" size="xs" c="dimmed">
                {rootPath}
              </Text>
            </Stack>

            <Group gap="xs">
              <Badge
                variant="light"
                color={recovery.status === 'ready' ? 'forgeLime' : 'forgeRust'}
                radius="xl"
              >
                {recovery.status}
              </Badge>
              <Badge
                variant="light"
                color={recovery.contextDrift.status === 'drifted' ? 'forgeRust' : 'forgeInk'}
                radius="xl"
              >
                drift {recovery.contextDrift.status}
              </Badge>
              <Badge
                variant="light"
                color={recovery.threadLinkage.status === 'ready' ? 'forgeLime' : 'forgeRust'}
                radius="xl"
              >
                thread {recovery.threadLinkage.status}
              </Badge>
            </Group>
          </Group>

          <Tabs
            value={activeTab}
            onChange={(value) => {
              if (!value) {
                return;
              }

              navigate(tabPath(projectId, value as ProjectDetailTab));
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="summary">摘要</Tabs.Tab>
              <Tabs.Tab value="evidence">证据</Tabs.Tab>
              <Tabs.Tab value="runtime">运行时</Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Stack>
      </Paper>

      <Grid gutter="md" align="start">
        <Grid.Col span={{ base: 12, xl: 8 }}>
          <Stack gap="lg">{children}</Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 4 }}>
          <ProjectRecoveryRail recovery={recovery} />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function tabPath(projectId: string, tab: ProjectDetailTab) {
  if (tab === 'evidence') {
    return `/projects/${projectId}/artifacts`;
  }

  if (tab === 'runtime') {
    return `/projects/${projectId}/runtime`;
  }

  return `/projects/${projectId}`;
}
