import { Alert, Box, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { startTransition, useEffect, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import RecoveryPanel from '../components/projects/RecoveryPanel';
import RuntimeEventsPanel from '../components/projects/RuntimeEventsPanel';
import ProjectStatusSummary from '../components/projects/ProjectStatusSummary';
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
    <Stack gap="xl">
      {state.error ? (
        <Alert color="orange" radius="xl" title="Using last successful snapshot">
          {state.error}
        </Alert>
      ) : null}

      <ProjectHeader
        title={state.overview.project.name}
        rootPath={state.overview.project.rootPath}
        id={id}
      />

      <Group grow align="stretch">
        <MetricCard label="Tasks" value={String(state.overview.tasks.total)} />
        <MetricCard
          label="Deliverables"
          value={String(state.overview.artifacts.deliverablesCount)}
        />
        <MetricCard label="Pending review" value={String(state.tasks.counts.pendingReview)} />
        <MetricCard label="Doctor fails" value={String(state.overview.recovery.doctorSummary.fail)} />
        <MetricCard label="Runtime status" value={state.overview.runtime.status} />
      </Group>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <RecoveryPanel recovery={state.recovery} />
        <Box
          style={{
            padding: '1.15rem',
            borderRadius: 24,
            border: '1px solid rgba(22,32,40,0.1)',
            background: 'rgba(255,255,255,0.72)'
          }}
        >
          <Stack gap="lg">
            <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
              Tasks
            </Text>
            <Title order={3} style={{ fontSize: '1.45rem' }}>
              Task distribution and review pressure.
            </Title>
            <ProjectStatusSummary
              ready={state.tasks.counts.ready}
              blocked={state.tasks.counts.blocked}
              pendingReview={state.tasks.counts.pendingReview}
              total={state.tasks.counts.total}
            />
            <Group grow>
              <MetricCard label="Ready" value={String(state.tasks.counts.ready)} compact />
              <MetricCard label="Blocked" value={String(state.tasks.counts.blocked)} compact />
              <MetricCard label="Completed" value={String(state.tasks.counts.completed)} compact />
            </Group>
            <Group grow>
              <MetricCard
                label="Knowledge"
                value={String(state.overview.artifacts.knowledgeCount)}
                compact
              />
              <MetricCard
                label="Deliverables"
                value={String(state.overview.artifacts.deliverablesCount)}
                compact
              />
              <MetricCard
                label="Sessions"
                value={String(state.overview.artifacts.sessionCount)}
                compact
              />
            </Group>
            <Group grow align="stretch">
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
            </Group>
          </Stack>
        </Box>
      </SimpleGrid>

      <RuntimeEventsPanel runtime={state.runtime} recovery={state.recovery} />
    </Stack>
  );
}

function ProjectHeader({ title, rootPath, id }: { title: string; rootPath: string; id: string }) {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={6}>
          <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
            Project detail
          </Text>
          <Title order={2} style={{ fontSize: 'clamp(1.9rem, 2.4vw, 3rem)' }}>
            {title}
          </Title>
          <Text className="forge-mono" size="xs" c="dimmed">
            {rootPath}
          </Text>
        </Stack>
      </Group>
      <ProjectNav projectId={id} />
    </Stack>
  );
}

function ProjectNav({ projectId }: { projectId: string }) {
  const links = [
    { label: 'Overview', to: `/projects/${projectId}` },
    { label: 'Artifacts', to: `/projects/${projectId}/artifacts` },
    { label: 'Runtime', to: `/projects/${projectId}/runtime` }
  ];

  return (
    <Group gap="sm">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          style={({ isActive }) => ({
            padding: '0.55rem 0.9rem',
            borderRadius: 999,
            border: '1px solid rgba(22,32,40,0.1)',
            background: isActive ? 'rgba(22,32,40,0.92)' : 'rgba(255,255,255,0.64)',
            color: isActive ? '#f8f3e8' : 'inherit',
            fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
            fontSize: '0.78rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          })}
        >
          {link.label}
        </NavLink>
      ))}
    </Group>
  );
}

function MetricCard({
  label,
  value,
  compact = false
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <Box
      style={{
        padding: compact ? '0.85rem 0.95rem' : '1rem 1.05rem',
        borderRadius: 20,
        border: '1px solid rgba(22,32,40,0.1)',
        background: 'rgba(255,255,255,0.62)'
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
        {label}
      </Text>
      <Title order={compact ? 4 : 3} mt={8}>
        {value}
      </Title>
    </Box>
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
    <Box
      style={{
        flex: 1,
        padding: '0.95rem 1rem',
        borderRadius: 18,
        border: '1px solid rgba(22,32,40,0.08)',
        background: 'rgba(255,255,255,0.54)'
      }}
    >
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
            <Box
              key={item.id}
              style={{
                padding: '0.7rem 0.8rem',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.68)',
                border: '1px solid rgba(22,32,40,0.08)'
              }}
            >
              <Text fw={600}>{item.title}</Text>
              <Text mt={4} className="forge-mono" size="xs" c="dimmed">
                {item.id} · {item.meta}
              </Text>
            </Box>
          ))
        )}
      </Stack>
    </Box>
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
