import { Alert, Box, Group, Stack, Text, Title } from '@mantine/core';
import { startTransition, useEffect, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { fetchProjectArtifacts, type ApiProjectArtifacts } from '../lib/api';

interface ArtifactsState {
  status: 'loading' | 'ready' | 'error';
  artifacts: ApiProjectArtifacts | null;
  error: string | null;
}

type ArtifactSelection =
  | { kind: 'knowledge'; id: string }
  | { kind: 'deliverable'; id: string }
  | { kind: 'session'; id: string };

export default function ProjectArtifactsPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<ArtifactsState>({
    status: 'loading',
    artifacts: null,
    error: null
  });
  const [selection, setSelection] = useState<ArtifactSelection | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    let disposed = false;
    const load = async () => {
      try {
        const artifacts = await fetchProjectArtifacts(id);
        if (disposed) {
          return;
        }

        startTransition(() => {
          setState({
            status: 'ready',
            artifacts: artifacts.data,
            error: null
          });
          setSelection(defaultSelection(artifacts.data));
        });
      } catch (error) {
        if (disposed) {
          return;
        }

        startTransition(() => {
          setState({
            status: 'error',
            artifacts: null,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }
    };

    void load();

    return () => {
      disposed = true;
    };
  }, [id]);

  if (!id) {
    return <NavigateBackHome message="Project id is missing." />;
  }

  if (state.status === 'loading' && !state.artifacts) {
    return <PageLoading label="Loading artifacts..." />;
  }

  if (state.status === 'error' || !state.artifacts) {
    return <NavigateBackHome message={state.error ?? 'Artifacts are unavailable.'} />;
  }

  const artifacts = state.artifacts;
  const preview = buildPreview(artifacts, selection);

  return (
    <Stack gap="xl">
      <ProjectHeader title="Artifacts" subtitle="Knowledge, deliverables, and sessions." id={id} />

      <Group align="stretch" gap="lg" grow>
        <ArtifactColumn
          title={`Knowledge · ${artifacts.knowledge.total}`}
          items={artifacts.knowledge.items.map((item) => ({
            id: item.id,
            title: item.title,
            meta: `${item.type} · ${item.updatedAt}`,
            onClick: () => setSelection({ kind: 'knowledge', id: item.id })
          }))}
        />
        <ArtifactColumn
          title={`Deliverables · ${artifacts.deliverables.total}`}
          items={artifacts.deliverables.items.map((item) => ({
            id: item.id,
            title: item.title,
            meta: `${item.status} · ${item.createdBy}`,
            onClick: () => setSelection({ kind: 'deliverable', id: item.id })
          }))}
        />
        <ArtifactColumn
          title={`Sessions · ${artifacts.sessions.total}`}
          items={artifacts.sessions.items.map((item) => ({
            id: item.id,
            title: item.name,
            meta: `${item.status} · ${item.lastActive}`,
            onClick: () => setSelection({ kind: 'session', id: item.id })
          }))}
        />
      </Group>

      <Box
        style={{
          padding: '1.15rem',
          borderRadius: 24,
          border: '1px solid rgba(22,32,40,0.1)',
          background: 'rgba(255,255,255,0.72)'
        }}
      >
        <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
          Preview
        </Text>
        <Title order={3} mt="xs">
          {preview.title}
        </Title>
        <Text mt="sm" size="sm" c="dimmed">
          {preview.meta}
        </Text>
        <Text mt="lg" lh={1.7} style={{ whiteSpace: 'pre-wrap' }}>
          {preview.body}
        </Text>
      </Box>
    </Stack>
  );
}

function ArtifactColumn({
  title,
  items
}: {
  title: string;
  items: Array<{ id: string; title: string; meta: string; onClick: () => void }>;
}) {
  return (
    <Box
      style={{
        minHeight: 360,
        padding: '1rem',
        borderRadius: 22,
        border: '1px solid rgba(22,32,40,0.1)',
        background: 'rgba(255,255,255,0.62)'
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
        {title}
      </Text>
      <Stack mt="sm" gap="sm">
        {items.map((item) => (
          <Box
            key={item.id}
            onClick={item.onClick}
            style={{
              cursor: 'pointer',
              padding: '0.85rem 0.95rem',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.68)',
              border: '1px solid rgba(22,32,40,0.08)'
            }}
          >
            <Text fw={600}>{item.title}</Text>
            <Text mt={6} className="forge-mono" size="xs" c="dimmed">
              {item.meta}
            </Text>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function defaultSelection(artifacts: ApiProjectArtifacts): ArtifactSelection | null {
  const knowledge = artifacts.knowledge.items[0];
  if (knowledge) {
    return { kind: 'knowledge', id: knowledge.id };
  }

  const deliverable = artifacts.deliverables.items[0];
  if (deliverable) {
    return { kind: 'deliverable', id: deliverable.id };
  }

  const session = artifacts.sessions.items[0];
  if (session) {
    return { kind: 'session', id: session.id };
  }

  return null;
}

function buildPreview(artifacts: ApiProjectArtifacts, selection: ArtifactSelection | null) {
  if (!selection) {
    return {
      title: 'No artifact selected',
      meta: 'Choose a knowledge item, deliverable, or session from the columns above.',
      body: 'This preview area is read-only. It surfaces the tracked metadata from `.webforge/` without mutating project state.'
    };
  }

  if (selection.kind === 'knowledge') {
    const item = artifacts.knowledge.items.find((entry) => entry.id === selection.id);
    if (item) {
      return {
        title: item.title,
        meta: `${item.type} · ${item.updatedAt} · ${item.path}`,
        body:
          item.preview ??
          `Knowledge entry stored at ${item.path}. The file is tracked, but no text preview is currently available.`
      };
    }
  }

  if (selection.kind === 'deliverable') {
    const item = artifacts.deliverables.items.find((entry) => entry.id === selection.id);
    if (item) {
      return {
        title: item.title,
        meta: `${item.type} · ${item.status} · ${item.createdBy} · ${item.path}`,
        body:
          item.preview ??
          `Deliverable ${item.id} belongs to task ${item.taskId}. The file is tracked at ${item.path}, but no text preview is currently available.`
      };
    }
  }

  const session = artifacts.sessions.items.find((entry) => entry.id === selection.id);
  if (session) {
    return {
      title: session.name,
      meta: `${session.status} · ${session.lastActive}`,
      body:
        session.preview ??
        `Session ${session.id} last focused on task ${session.currentTask ?? 'none'} in phase ${session.currentPhase ?? 'none'}.`
    };
  }

  return {
    title: 'Artifact unavailable',
    meta: 'The selected item is no longer present in the current payload.',
    body: 'Refresh the page to synchronize with the latest `.webforge/` state.'
  };
}

function ProjectHeader({ title, subtitle, id }: { title: string; subtitle: string; id: string }) {
  return (
    <Stack gap="md">
      <Stack gap={6}>
        <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
          Project detail
        </Text>
        <Title order={2}>{title}</Title>
        <Text c="dimmed">{subtitle}</Text>
      </Stack>
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
    <Alert color="red" radius="xl" title="Artifacts unavailable">
      <Text>{message}</Text>
      <Text mt="sm" component={Link} to="/">
        Back to projects
      </Text>
    </Alert>
  );
}
