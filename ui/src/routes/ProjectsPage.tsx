import {
  Alert,
  Box,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { startTransition, useEffect, useState } from 'react';
import ProjectCard from '../components/projects/ProjectCard';
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
      <Box
        style={{
          minHeight: '55vh',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        <Stack align="center" gap="sm">
          <Loader color="forgeRust" />
          <Text className="forge-mono" size="sm">
            Scanning workspaces and assembling control cards...
          </Text>
        </Stack>
      </Box>
    );
  }

  if (state.status === 'error' || !state.snapshot) {
    return (
      <Alert color="red" radius="xl" title="UI data source unavailable">
        {state.error ?? 'Unable to load project monitoring data.'}
      </Alert>
    );
  }

  const health = summarizeHealth(state.snapshot);

  return (
    <Stack gap="xl">
      {state.error ? (
        <Alert color="orange" radius="xl" title="Using last successful scan">
          {state.error}
        </Alert>
      ) : null}

      <Group align="stretch" gap="lg" grow>
        <TopMetric
          label="Scan Root"
          value={state.snapshot.rootPath}
          caption={`Last refresh ${formatTimestamp(state.snapshot.fetchedAt)}`}
        />
        <TopMetric
          label="Projects"
          value={String(state.snapshot.projects.length)}
          caption={`${health.healthy} healthy / ${health.watch} watch / ${health.blocked} blocked`}
        />
        <TopMetric
          label="Signals"
          value={String(health.pendingReview)}
          caption="Projects with pending review artifacts"
        />
      </Group>

      <Stack gap={4}>
        <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
          Multi-project overview
        </Text>
        <Title order={2} style={{ fontSize: 'clamp(1.6rem, 2vw, 2.5rem)' }}>
          One board for drift, blockage, recovery, and runtime pulse.
        </Title>
      </Stack>

      {state.snapshot.projects.length === 0 ? (
        <Box
          style={{
            padding: '3rem',
            borderRadius: 28,
            border: '1px dashed rgba(22,32,40,0.18)',
            background: 'rgba(255,255,255,0.5)'
          }}
        >
          <Title order={3}>No WebForge projects found</Title>
          <Text mt="sm" c="dimmed" maw={560}>
            Point <code>webforge ui --root &lt;path&gt;</code> at a directory containing one or
            more repositories with <code>.webforge/</code> state, then refresh this page.
          </Text>
        </Box>
      ) : (
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
          {state.snapshot.projects.map((entry) => (
            <ProjectCard
              key={entry.project.id}
              project={entry.project}
              overview={entry.overview}
              error={entry.error}
            />
          ))}
        </SimpleGrid>
      )}
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
    <Box
      style={{
        padding: '1rem 1.15rem',
        borderRadius: 22,
        border: '1px solid rgba(22,32,40,0.1)',
        background: 'rgba(255,255,255,0.64)',
        boxShadow: '0 12px 32px rgba(22, 32, 40, 0.06)'
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
        {label}
      </Text>
      <Title
        order={3}
        mt={10}
        style={{
          fontSize: '1.35rem',
          lineHeight: 1.05,
          wordBreak: 'break-word'
        }}
      >
        {value}
      </Title>
      <Text mt={10} size="sm" c="dimmed">
        {caption}
      </Text>
    </Box>
  );
}

function summarizeHealth(snapshot: ProjectsDashboardSnapshot) {
  return snapshot.projects.reduce(
    (summary, entry) => {
      if (!entry.overview || entry.error) {
        summary.blocked += 1;
        return summary;
      }

      if (!entry.overview.recovery.canProceed || entry.overview.tasks.blocked > 0) {
        summary.blocked += 1;
      } else if (
        entry.overview.tasks.pendingReview > 0 ||
        entry.overview.recovery.contextDriftStatus === 'drifted'
      ) {
        summary.watch += 1;
      } else {
        summary.healthy += 1;
      }

      if (entry.overview.tasks.pendingReview > 0) {
        summary.pendingReview += 1;
      }

      return summary;
    },
    {
      healthy: 0,
      watch: 0,
      blocked: 0,
      pendingReview: 0
    }
  );
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}
