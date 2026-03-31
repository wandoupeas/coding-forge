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
              <Tabs.Tab value="knowledge">知识 ({artifacts.knowledge.total})</Tabs.Tab>
              <Tabs.Tab value="deliverable">
                交付物 ({artifacts.deliverables.total})
              </Tabs.Tab>
              <Tabs.Tab value="session">会话 ({artifacts.sessions.total})</Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
                {activeKind === 'knowledge'
                  ? '知识'
                  : activeKind === 'deliverable'
                    ? '交付物'
                    : '会话'}
              </Text>
              <ScrollArea h={380} type="auto" offsetScrollbars>
                <Stack gap={6}>
                  {items.length === 0 ? (
                    <Text c="dimmed" size="sm">
                      此分类下暂无可用项目。
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
                预览
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
      title: '未选择产物',
      meta: '从浏览器中选择一个条目以查看其预览和元数据。',
      body: '此面板从已跟踪的 `.webforge/` 数据中读取，不会修改项目状态。'
    };
  }

  if (selection.kind === 'knowledge') {
    const item = artifacts.knowledge.items.find((entry) => entry.id === selection.id);
    if (item) {
      return {
        title: item.title,
        meta: `${item.type} · ${item.updatedAt} · ${item.path}`,
        body: item.preview ?? `知识条目存储于 ${item.path}，暂无文本预览。`
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
          `交付物 ${item.id} 属于任务 ${item.taskId}，暂无文本预览。`
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
        `会话 ${item.id} 上次聚焦于任务 ${item.currentTask ?? 'none'}，阶段 ${item.currentPhase ?? 'none'}。`
    };
  }

  return {
    title: '产物不可用',
    meta: '所选条目已不在当前数据中。',
    body: '刷新视图以与最新的 `.webforge/` 状态同步。'
  };
}
