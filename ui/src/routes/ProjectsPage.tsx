import {
  Alert,
  Badge,
  Grid,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { startTransition, useEffect, useState, type ReactNode } from 'react';
import ProjectIndexPanel from '../components/projects/ProjectIndexPanel';
import { summarizeProjectHealth } from '../components/projects/project-health';
import SignalRail from '../components/projects/SignalRail';
import WorkspaceLedgerTable from '../components/projects/WorkspaceLedgerTable';
import { fetchProjectsDashboard, type ProjectsDashboardSnapshot } from '../lib/api';

interface ProjectsPageState {
  status: 'loading' | 'ready' | 'error';
  snapshot: ProjectsDashboardSnapshot | null;
  error: string | null;
}

export default function ProjectsPage() {
  const [state, setState] = useState<ProjectsPageState>({
    status: 'loading',
    snapshot: null,
    error: null
  });

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        const snapshot = await fetchProjectsDashboard();
        if (disposed) {
          return;
        }

        startTransition(() => {
          setState({
            status: 'ready',
            snapshot,
            error: null
          });
        });
      } catch (error) {
        if (disposed) {
          return;
        }

        startTransition(() => {
          setState((current) => ({
            status: current.snapshot ? 'ready' : 'error',
            snapshot: current.snapshot,
            error: error instanceof Error ? error.message : String(error)
          }));
        });
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (state.status === 'loading' && !state.snapshot) {
    return (
      <Stack gap="xl">
        <Group align="stretch" gap="lg" grow>
          <TopMetric
            label="扫描根目录"
            value="加载中..."
            caption="正在等待首次工作区快照"
          />
          <TopMetric label="项目" value="0" caption="尚未加载任何项目记录" />
          <TopMetric
            label="信号"
            value="0"
            caption="待审核和漂移信号将显示在此处"
          />
        </Group>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, lg: 3 }}>
            <SectionShell title="项目索引">
              <Loader color="forgeRust" />
              <Text mt="sm" c="dimmed">
                正在扫描工作区并组装项目索引...
              </Text>
            </SectionShell>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <SectionShell title="工作区台账">
              <Text c="dimmed">
                快照准备就绪后，紧凑的项目表格将显示在此处。
              </Text>
            </SectionShell>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 3 }}>
            <SectionShell title="信号栏">
              <Text c="dimmed">
                此栏将收集阻塞、漂移和待审核信号。
              </Text>
            </SectionShell>
          </Grid.Col>
        </Grid>
      </Stack>
    );
  }

  if (state.status === 'error' || !state.snapshot) {
    return (
      <Alert color="red" radius="xl" title="UI 数据源不可用">
        {state.error ?? '无法加载项目监控数据。'}
      </Alert>
    );
  }

  const health = summarizeProjectHealth(state.snapshot.projects);

  return (
    <Stack gap="xl">
      {state.error ? (
        <Alert color="orange" radius="xl" title="正在使用上次成功的扫描结果">
          {state.error}
        </Alert>
      ) : null}

      <Group align="stretch" gap="lg" grow>
        <TopMetric
          label="扫描根目录"
          value={state.snapshot.rootPath}
          caption={`上次刷新 ${formatTimestamp(state.snapshot.fetchedAt)}`}
        />
        <TopMetric
          label="项目"
          value={String(state.snapshot.projects.length)}
          caption={`${health.healthy} 正常 / ${health.watch} 关注 / ${health.blocked} 阻塞`}
        />
        <TopMetric
          label="信号"
          value={String(health.pendingReview)}
          caption={`${health.pendingReview} 个项目有待审核产物`}
        />
      </Group>

      <Stack gap={4}>
        <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
          多项目总览
        </Text>
        <Title order={2} style={{ fontSize: 'clamp(1.6rem, 2vw, 2.5rem)' }}>
          漂移、阻塞、恢复和运行时脉搏，一目了然。
        </Title>
        <Text c="dimmed" style={{ maxWidth: 840 }}>
          首页作为紧凑控制面：项目索引是入口导航，工作区台账展示当前快照，信号栏压缩所有需要关注的信息。
        </Text>
      </Stack>

      <Grid gutter="md" align="stretch">
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <ProjectIndexPanel projects={state.snapshot.projects} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <WorkspaceLedgerTable projects={state.snapshot.projects} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <SignalRail projects={state.snapshot.projects} />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function TopMetric({
  label,
  value,
  caption
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
          {label}
        </Text>
        <Title order={4} style={{ lineHeight: 1.15, wordBreak: 'break-word' }}>
          {value}
        </Title>
        <Text size="sm" c="dimmed">
          {caption}
        </Text>
      </Stack>
    </Paper>
  );
}

function SectionShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={700}>{title}</Text>
          <Badge variant="light" color="forgeRust">
            loading
          </Badge>
        </Group>
        {children}
      </Stack>
    </Paper>
  );
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}
