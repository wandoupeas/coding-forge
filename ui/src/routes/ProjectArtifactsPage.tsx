import { Alert, Box, Stack, Text } from '@mantine/core';
import { startTransition, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ArtifactBrowser from '../components/projects/ArtifactBrowser';
import ProjectDetailShell from '../components/projects/ProjectDetailShell';
import {
  fetchProjectArtifacts,
  fetchProjectRecovery,
  type ApiProjectArtifacts,
  type ApiProjectRecord,
  type ApiProjectRecovery
} from '../lib/api';

interface ArtifactsState {
  status: 'loading' | 'ready' | 'error';
  project: ApiProjectRecord | null;
  artifacts: ApiProjectArtifacts | null;
  recovery: ApiProjectRecovery | null;
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
    project: null,
    artifacts: null,
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
        const [artifacts, recovery] = await Promise.all([
          fetchProjectArtifacts(id),
          fetchProjectRecovery(id)
        ]);
        if (disposed) {
          return;
        }

        startTransition(() => {
          setState({
            status: 'ready',
            project: artifacts.project,
            artifacts: artifacts.data,
            recovery: recovery.data,
            error: null
          });
        });
      } catch (error) {
        if (disposed) {
          return;
        }

        startTransition(() => {
          setState({
            status: 'error',
            project: null,
            artifacts: null,
            recovery: null,
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
    return <NavigateBackHome message="项目 ID 缺失。" />;
  }

  if (state.status === 'loading' && !state.artifacts) {
    return <PageLoading label="正在加载产物..." />;
  }

  if (state.status === 'error' || !state.project || !state.artifacts || !state.recovery) {
    return <NavigateBackHome message={state.error ?? '产物不可用。'} />;
  }

  const artifacts = state.artifacts;

  return (
    <ProjectDetailShell
      projectId={id}
      title={state.project.name}
      rootPath={state.project.rootPath}
      activeTab="evidence"
      recovery={state.recovery}
    >
      <ArtifactBrowser artifacts={artifacts} />
    </ProjectDetailShell>
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
    <Alert color="red" radius="xl" title="产物不可用">
      <Text>{message}</Text>
      <Text mt="sm" component={Link} to="/">
        返回项目列表
      </Text>
    </Alert>
  );
}
