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
            label="Scan Root"
            value="Loading..."
            caption="Waiting for the first workspace snapshot"
          />
          <TopMetric label="Projects" value="0" caption="No project records loaded yet" />
          <TopMetric
            label="Signals"
            value="0"
            caption="Pending review and drift signals will appear here"
          />
        </Group>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, lg: 3 }}>
            <SectionShell title="Project Index">
              <Loader color="forgeRust" />
              <Text mt="sm" c="dimmed">
                Scanning workspaces and assembling the project index...
              </Text>
            </SectionShell>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <SectionShell title="Workspace Ledger">
              <Text c="dimmed">
                A compact project table will land here once the snapshot is ready.
              </Text>
            </SectionShell>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 3 }}>
            <SectionShell title="Signal Rail">
              <Text c="dimmed">
                This rail will collect blocked, drifted, and pending-review signals.
              </Text>
            </SectionShell>
          </Grid.Col>
        </Grid>
      </Stack>
    );
  }

  if (state.status === 'error' || !state.snapshot) {
    return (
      <Alert color="red" radius="xl" title="UI data source unavailable">
        {state.error ?? 'Unable to load project monitoring data.'}
      </Alert>
    );
  }

  const health = summarizeProjectHealth(state.snapshot.projects);

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
          caption={`${health.pendingReview} project${
            health.pendingReview === 1 ? '' : 's'
          } with pending review artifacts`}
        />
      </Group>

      <Stack gap={4}>
        <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
          Multi-project overview
        </Text>
        <Title order={2} style={{ fontSize: 'clamp(1.6rem, 2vw, 2.5rem)' }}>
          One board for drift, blockage, recovery, and runtime pulse.
        </Title>
        <Text c="dimmed" style={{ maxWidth: 840 }}>
          The homepage now acts as a compact control surface: the project index is the entry rail,
          the workspace ledger shows the current snapshot, and the signal rail compresses anything
          that needs attention.
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
