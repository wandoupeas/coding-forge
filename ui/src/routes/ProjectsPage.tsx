import {
  Alert,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { startTransition, useEffect, useState, type ReactNode } from 'react';
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

        <Group align="stretch" grow>
          <SectionShell title="Project Index">
            <Loader color="forgeRust" />
            <Text mt="sm" c="dimmed">
              Scanning workspaces and assembling the project index...
            </Text>
          </SectionShell>

          <SectionShell title="Workspace Ledger">
            <Text c="dimmed">
              A compact project table will land here once the snapshot is ready.
            </Text>
          </SectionShell>

          <SectionShell title="Signal Rail">
            <Text c="dimmed">
              This rail will collect blocked, drifted, and pending-review signals.
            </Text>
          </SectionShell>
        </Group>
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

      <Group align="stretch" grow>
        <SectionShell title="Project Index">
          {state.snapshot.projects.length === 0 ? (
            <Text c="dimmed">
              No WebForge projects found.
            </Text>
          ) : (
            <SimpleGrid cols={1} spacing="sm">
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
        </SectionShell>

        <SectionShell title="Workspace Ledger">
          <Text c="dimmed">
            A table-oriented ledger will replace this placeholder in the next task.
          </Text>
        </SectionShell>

        <SectionShell title="Signal Rail">
          <Text c="dimmed">
            This rail will consolidate drift, review, and recovery signals.
          </Text>
        </SectionShell>
      </Group>
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
        <Text fw={700}>{title}</Text>
        {children}
      </Stack>
    </Paper>
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
