import { Alert, Box, Group, Stack, Text, Title } from '@mantine/core';
import { startTransition, useEffect, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import RuntimeEventsPanel from '../components/projects/RuntimeEventsPanel';
import { fetchProjectRecovery, fetchProjectRuntime, type ApiProjectRecovery, type ApiProjectRuntime } from '../lib/api';

interface RuntimePageState {
  status: 'loading' | 'ready' | 'error';
  runtime: ApiProjectRuntime | null;
  recovery: ApiProjectRecovery | null;
  error: string | null;
}

export default function ProjectRuntimePage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<RuntimePageState>({
    status: 'loading',
    runtime: null,
    recovery: null,
    error: null
  });

  useEffect(() => {
    if (!id) {
      return;
    }

    let disposed = false;
    const load = async () => {
      try {
        const [runtime, recovery] = await Promise.all([
          fetchProjectRuntime(id),
          fetchProjectRecovery(id)
        ]);
        if (disposed) {
          return;
        }

        startTransition(() => {
          setState({
            status: 'ready',
            runtime: runtime.data,
            recovery: recovery.data,
            error: null
          });
        });
      } catch (error) {
        if (disposed) {
          return;
        }

        startTransition(() => {
          setState((current) => ({
            status: current.runtime && current.recovery ? 'ready' : 'error',
            runtime: current.runtime,
            recovery: current.recovery,
            error: error instanceof Error ? error.message : String(error)
          }));
        });
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 3000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [id]);

  if (!id) {
    return <NavigateBackHome message="Project id is missing." />;
  }

  if (state.status === 'loading' && !state.runtime) {
    return <PageLoading label="Loading runtime view..." />;
  }

  if (state.status === 'error' || !state.runtime || !state.recovery) {
    return <NavigateBackHome message={state.error ?? 'Runtime view is unavailable.'} />;
  }

  return (
    <Stack gap="xl">
      {state.error ? (
        <Alert color="orange" radius="xl" title="Using last successful snapshot">
          {state.error}
        </Alert>
      ) : null}

      <Stack gap="md">
        <Stack gap={6}>
          <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
            Project detail
          </Text>
          <Title order={2}>Runtime + recovery watch</Title>
          <Text c="dimmed">
            Compare the latest execution pulse with current recovery context and mailbox pressure.
          </Text>
        </Stack>
        <ProjectNav projectId={id} />
      </Stack>

      <Group grow>
        <MetricCard label="Runtime status" value={state.runtime.runtime.status} />
        <MetricCard label="Last event" value={state.runtime.latestObservation?.lastEvent ?? 'none'} />
        <MetricCard label="Drift" value={state.recovery.contextDrift.status} />
        <MetricCard label="Checkpoint count" value={String(state.runtime.checkpoints.total)} />
      </Group>

      <RuntimeEventsPanel runtime={state.runtime} recovery={state.recovery} />
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Box
      style={{
        padding: '1rem 1.05rem',
        borderRadius: 20,
        border: '1px solid rgba(22,32,40,0.1)',
        background: 'rgba(255,255,255,0.62)'
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
        {label}
      </Text>
      <Title order={3} mt={8}>
        {value}
      </Title>
    </Box>
  );
}

function PageLoading({ label }: { label: string }) {
  return (
    <Box style={{ minHeight: '45vh', display: 'grid', placeItems: 'center' }}>
      <Text className="forge-mono" size="sm">
        {label}
      </Text>
    </Box>
  );
}

function NavigateBackHome({ message }: { message: string }) {
  return (
    <Alert color="red" radius="xl" title="Runtime unavailable">
      <Text>{message}</Text>
      <Text mt="sm" component={Link} to="/">
        Back to projects
      </Text>
    </Alert>
  );
}
