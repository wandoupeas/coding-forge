import { Alert, Box, Grid, Loader, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { startTransition, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProjectDetailShell from '../components/projects/ProjectDetailShell';
import RecoveryPanel from '../components/projects/RecoveryPanel';
import RuntimeEventsPanel from '../components/projects/RuntimeEventsPanel';
import {
  fetchProjectOverview,
  fetchProjectRecovery,
  fetchProjectRuntime,
  fetchProjectTasks,
  type ApiProjectOverview,
  type ApiProjectRecovery,
  type ApiProjectRuntime,
  type ApiProjectTasks
} from '../lib/api';

interface OverviewState {
  status: 'loading' | 'ready' | 'error';
  overview: ApiProjectOverview | null;
  tasks: ApiProjectTasks | null;
  recovery: ApiProjectRecovery | null;
  runtime: ApiProjectRuntime | null;
  error: string | null;
}

export default function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<OverviewState>({
    status: 'loading',
    overview: null,
    tasks: null,
    recovery: null,
    runtime: null,
    error: null
  });

  useEffect(() => {
    if (!id) {
      return;
    }

    let disposed = false;
    const load = async () => {
      try {
        const [overview, tasks, recovery, runtime] = await Promise.all([
          fetchProjectOverview(id),
          fetchProjectTasks(id),
          fetchProjectRecovery(id),
          fetchProjectRuntime(id)
        ]);

        if (disposed) {
          return;
        }

        startTransition(() => {
          setState({
            status: 'ready',
            overview: overview.data,
            tasks: tasks.data,
            recovery: recovery.data,
            runtime: runtime.data,
            error: null
          });
        });
      } catch (error) {
        if (disposed) {
          return;
        }

        startTransition(() => {
          setState((current) => ({
            status: current.overview && current.tasks && current.recovery && current.runtime ? 'ready' : 'error',
            overview: current.overview,
            tasks: current.tasks,
            recovery: current.recovery,
            runtime: current.runtime,
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
  }, [id]);

  if (!id) {
    return <NavigateBackHome message="项目 ID 缺失。" />;
  }

  if (state.status === 'loading' && !state.overview) {
    return <PageLoading label="正在加载项目概览..." />;
  }

  if (state.status === 'error' || !state.overview || !state.tasks || !state.recovery || !state.runtime) {
    return <NavigateBackHome message={state.error ?? '项目概览不可用。'} />;
  }

  return (
    <ProjectDetailShell
      projectId={id}
      title={state.overview.project.name}
      rootPath={state.overview.project.rootPath}
      activeTab="summary"
      recovery={state.recovery}
    >
      {state.error ? (
        <Alert color="orange" radius="md" title="正在使用上次成功的快照">
          {state.error}
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <RecoveryPanel recovery={state.recovery} />
        <Paper withBorder radius="md" p="md">
          <Stack gap="lg">
            <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
              产物脉搏
            </Text>
            <Text fw={700}>当前任务压力、产物数量和运行时脉搏。</Text>
            <Grid gutter="sm">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact label="任务" value={String(state.overview.tasks.total)} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact label="就绪" value={String(state.tasks.counts.ready)} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact
                  label="待审核"
                  value={String(state.tasks.counts.pendingReview)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact
                  label="交付物"
                  value={String(state.overview.artifacts.deliverablesCount)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact
                  label="知识"
                  value={String(state.overview.artifacts.knowledgeCount)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact
                  label="会话"
                  value={String(state.overview.artifacts.sessionCount)}
                />
              </Grid.Col>
            </Grid>
            <Alert color="blue" radius="md" title="运行时脉搏">
              <Text size="sm">{state.runtime.runtime.summary}</Text>
            </Alert>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
            任务泳道
          </Text>
          <Text fw={700}>就绪、阻塞和待审核队列。</Text>
          <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
            <TaskListBlock
              title="立即就绪"
              items={state.tasks.ready.map((task) => ({
                id: task.id,
                title: task.title,
                meta: `${task.assignee} · P${task.priority}`
              }))}
            />
            <TaskListBlock
              title="阻塞"
              items={state.tasks.blocked.map((task) => ({
                id: task.id,
                title: task.title,
                meta: `${task.assignee} · ${task.blockedBy.join(', ') || 'no blocker'}`
              }))}
            />
            <TaskListBlock
              title="待审核"
              items={state.tasks.pendingReview.map((task) => ({
                id: task.id,
                title: task.title,
                meta: `${task.assignee} · P${task.priority}`
              }))}
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      <RuntimeEventsPanel runtime={state.runtime} recovery={state.recovery} />
    </ProjectDetailShell>
  );
}

function TaskListBlock({
  title,
  items
}: {
  title: string;
  items: Array<{ id: string; title: string; meta: string }>;
}) {
  return (
    <Paper withBorder radius="md" p="md">
      <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
        {title}
      </Text>
      <Stack mt="sm" gap="sm">
        {items.length === 0 ? (
          <Text size="sm" c="dimmed">
            此泳道暂无任务。
          </Text>
        ) : (
          items.slice(0, 4).map((item) => (
            <Paper key={item.id} withBorder radius="md" p="sm">
              <Text fw={600}>{item.title}</Text>
              <Text mt={4} className="forge-mono" size="xs" c="dimmed">
                {item.id} · {item.meta}
              </Text>
            </Paper>
          ))
        )}
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

function PageLoading({ label }: { label: string }) {
  return (
    <Box style={{ minHeight: '45vh', display: 'grid', placeItems: 'center' }}>
      <Stack align="center" gap="sm">
        <Loader color="forgeRust" />
        <Text className="forge-mono" size="sm">
          {label}
        </Text>
      </Stack>
    </Box>
  );
}

function NavigateBackHome({ message }: { message: string }) {
  return (
    <Alert color="red" radius="xl" title="项目视图不可用">
      <Text>{message}</Text>
      <Text mt="sm" component={Link} to="/">
        返回项目列表
      </Text>
    </Alert>
  );
}
