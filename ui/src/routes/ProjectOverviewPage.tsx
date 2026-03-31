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
    return <NavigateBackHome message="Project id is missing." />;
  }

  if (state.status === 'loading' && !state.overview) {
    return <PageLoading label="Loading project overview..." />;
  }

  if (state.status === 'error' || !state.overview || !state.tasks || !state.recovery || !state.runtime) {
    return <NavigateBackHome message={state.error ?? 'Project overview is unavailable.'} />;
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
        <Alert color="orange" radius="md" title="Using last successful snapshot">
          {state.error}
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <RecoveryPanel recovery={state.recovery} />
        <Paper withBorder radius="md" p="md">
          <Stack gap="lg">
            <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
              Artifact pulse
            </Text>
            <Text fw={700}>Current task pressure, artifact counts, and runtime pulse.</Text>
            <Grid gutter="sm">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact label="Tasks" value={String(state.overview.tasks.total)} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact label="Ready" value={String(state.tasks.counts.ready)} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact
                  label="Pending review"
                  value={String(state.tasks.counts.pendingReview)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact
                  label="Deliverables"
                  value={String(state.overview.artifacts.deliverablesCount)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact
                  label="Knowledge"
                  value={String(state.overview.artifacts.knowledgeCount)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <SummaryFact
                  label="Sessions"
                  value={String(state.overview.artifacts.sessionCount)}
                />
              </Grid.Col>
            </Grid>
            <Alert color="blue" radius="md" title="Runtime pulse">
              <Text size="sm">{state.runtime.runtime.summary}</Text>
            </Alert>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
            Task lanes
          </Text>
          <Text fw={700}>Ready now, blocked, and pending review queues.</Text>
          <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
            <TaskListBlock
              title="Ready now"
              items={state.tasks.ready.map((task) => ({
                id: task.id,
                title: task.title,
                meta: `${task.assignee} · P${task.priority}`
              }))}
            />
            <TaskListBlock
              title="Blocked"
              items={state.tasks.blocked.map((task) => ({
                id: task.id,
                title: task.title,
                meta: `${task.assignee} · ${task.blockedBy.join(', ') || 'no blocker'}`
              }))}
            />
            <TaskListBlock
              title="Pending review"
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
            No tasks in this lane.
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
    <Alert color="red" radius="xl" title="Project view unavailable">
      <Text>{message}</Text>
      <Text mt="sm" component={Link} to="/">
        Back to projects
      </Text>
    </Alert>
  );
}
