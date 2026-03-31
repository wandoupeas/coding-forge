import { Grid, NavLink, Paper, ScrollArea, Stack, Tabs, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import type { ApiProjectArtifacts } from '../../lib/api';

type ArtifactKind = 'knowledge' | 'deliverable' | 'session';

type ArtifactSelection =
  | { kind: 'knowledge'; id: string }
  | { kind: 'deliverable'; id: string }
  | { kind: 'session'; id: string };

interface ArtifactBrowserProps {
  artifacts: ApiProjectArtifacts;
}

export default function ArtifactBrowser({ artifacts }: ArtifactBrowserProps) {
  const initialSelection = defaultSelection(artifacts);
  const [activeKind, setActiveKind] = useState<ArtifactKind>(initialSelection?.kind ?? 'knowledge');
  const [selection, setSelection] = useState<ArtifactSelection | null>(initialSelection);

  useEffect(() => {
    const nextSelection = defaultSelection(artifacts);
    setActiveKind(nextSelection?.kind ?? 'knowledge');
    setSelection(nextSelection);
  }, [artifacts]);

  const items = itemsForKind(artifacts, activeKind);
  const preview = buildPreview(artifacts, selection);

  return (
    <Paper withBorder radius="md" p="md">
      <Grid gutter="md" align="start">
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Tabs
            orientation="vertical"
            value={activeKind}
            onChange={(value) => {
              const nextKind = (value as ArtifactKind | null) ?? 'knowledge';
              setActiveKind(nextKind);
              setSelection(defaultSelectionForKind(artifacts, nextKind));
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="knowledge">Knowledge ({artifacts.knowledge.total})</Tabs.Tab>
              <Tabs.Tab value="deliverable">
                Deliverables ({artifacts.deliverables.total})
              </Tabs.Tab>
              <Tabs.Tab value="session">Sessions ({artifacts.sessions.total})</Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
                {activeKind === 'knowledge'
                  ? 'Knowledge'
                  : activeKind === 'deliverable'
                    ? 'Deliverables'
                    : 'Sessions'}
              </Text>
              <ScrollArea h={380} type="auto" offsetScrollbars>
                <Stack gap={6}>
                  {items.length === 0 ? (
                    <Text c="dimmed" size="sm">
                      No items are available in this lane.
                    </Text>
                  ) : (
                    items.map((item) => (
                      <NavLink
                        key={item.id}
                        active={selection?.id === item.id && selection.kind === item.kind}
                        label={item.title}
                        description={item.meta}
                        onClick={() => setSelection({ kind: item.kind, id: item.id } as ArtifactSelection)}
                      />
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
                Preview
              </Text>
              <Title order={4}>{preview.title}</Title>
              <Text size="sm" c="dimmed">
                {preview.meta}
              </Text>
              <ScrollArea h={320} type="auto" offsetScrollbars>
                <Text size="sm" lh={1.7} style={{ whiteSpace: 'pre-wrap' }}>
                  {preview.body}
                </Text>
              </ScrollArea>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Paper>
  );
}

function defaultSelection(artifacts: ApiProjectArtifacts): ArtifactSelection | null {
  return (
    defaultSelectionForKind(artifacts, 'knowledge') ??
    defaultSelectionForKind(artifacts, 'deliverable') ??
    defaultSelectionForKind(artifacts, 'session')
  );
}

function defaultSelectionForKind(
  artifacts: ApiProjectArtifacts,
  kind: ArtifactKind
): ArtifactSelection | null {
  if (kind === 'knowledge') {
    const item = artifacts.knowledge.items[0];
    return item ? { kind: 'knowledge', id: item.id } : null;
  }

  if (kind === 'deliverable') {
    const item = artifacts.deliverables.items[0];
    return item ? { kind: 'deliverable', id: item.id } : null;
  }

  const item = artifacts.sessions.items[0];
  return item ? { kind: 'session', id: item.id } : null;
}

function itemsForKind(artifacts: ApiProjectArtifacts, kind: ArtifactKind) {
  if (kind === 'knowledge') {
    return artifacts.knowledge.items.map((item) => ({
      kind,
      id: item.id,
      title: item.title,
      meta: `${item.type} · ${item.updatedAt}`
    }));
  }

  if (kind === 'deliverable') {
    return artifacts.deliverables.items.map((item) => ({
      kind,
      id: item.id,
      title: item.title,
      meta: `${item.status} · ${item.createdBy}`
    }));
  }

  return artifacts.sessions.items.map((item) => ({
    kind,
    id: item.id,
    title: item.name,
    meta: `${item.status} · ${item.lastActive}`
  }));
}

function buildPreview(artifacts: ApiProjectArtifacts, selection: ArtifactSelection | null) {
  if (!selection) {
    return {
      title: 'No artifact selected',
      meta: 'Choose an item from the browser to inspect its preview and metadata.',
      body: 'This panel reads from the tracked `.webforge/` payload without mutating project state.'
    };
  }

  if (selection.kind === 'knowledge') {
    const item = artifacts.knowledge.items.find((entry) => entry.id === selection.id);
    if (item) {
      return {
        title: item.title,
        meta: `${item.type} · ${item.updatedAt} · ${item.path}`,
        body: item.preview ?? `Knowledge entry stored at ${item.path}. No text preview is available.`
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
          `Deliverable ${item.id} belongs to task ${item.taskId}. No text preview is available.`
      };
    }
  }

  const item = artifacts.sessions.items.find((entry) => entry.id === selection.id);
  if (item) {
    return {
      title: item.name,
      meta: `${item.status} · ${item.lastActive}`,
      body:
        item.preview ??
        `Session ${item.id} last focused on task ${item.currentTask ?? 'none'} in phase ${item.currentPhase ?? 'none'}.`
    };
  }

  return {
    title: 'Artifact unavailable',
    meta: 'The selected item is no longer present in the current payload.',
    body: 'Refresh the view to synchronize with the latest `.webforge/` state.'
  };
}
