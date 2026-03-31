import { Alert, Box, Group, Stack, Text, Title } from '@mantine/core';
import { startTransition, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProjectDetailShell from '../components/projects/ProjectDetailShell';
import RuntimeEventsPanel from '../components/projects/RuntimeEventsPanel';
import {
  fetchProjectRecovery,
  fetchProjectRuntime,
  type ApiProjectRecord,
  type ApiProjectRecovery,
  type ApiProjectRuntime
} from '../lib/api';

interface RuntimePageState {
  status: 'loading' | 'ready' | 'error';
  project: ApiProjectRecord | null;
  runtime: ApiProjectRuntime | null;
  recovery: ApiProjectRecovery | null;
  error: string | null;
}

export default function ProjectRuntimePage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<RuntimePageState>({
    status: 'loading',
    project: null,
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
            project: runtime.project,
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
            status: current.project && current.runtime && current.recovery ? 'ready' : 'error',
            project: current.project,
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
    return <NavigateBackHome message="项目 ID 缺失。" />;
  }

  if (state.status === 'loading' && !state.runtime) {
    return <PageLoading label="正在加载运行时视图..." />;
  }

  if (state.status === 'error' || !state.project || !state.runtime || !state.recovery) {
    return <NavigateBackHome message={state.error ?? '运行时视图不可用。'} />;
  }

  return (
    <ProjectDetailShell
      projectId={id}
      title={state.project.name}
      rootPath={state.project.rootPath}
      activeTab="runtime"
      recovery={state.recovery}
    >
      {state.error ? (
        <Alert color="orange" radius="md" title="正在使用上次成功的快照">
          {state.error}
        </Alert>
      ) : null}

      <Group grow>
        <MetricCard label="运行时状态" value={state.runtime.runtime.status} />
        <MetricCard label="最后事件" value={state.runtime.latestObservation?.lastEvent ?? 'none'} />
        <MetricCard label="漂移" value={state.recovery.contextDrift.status} />
        <MetricCard label="检查点数量" value={String(state.runtime.checkpoints.total)} />
      </Group>

      <RuntimeEventsPanel runtime={state.runtime} recovery={state.recovery} />
    </ProjectDetailShell>
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
    <Alert color="red" radius="xl" title="运行时不可用">
      <Text>{message}</Text>
      <Text mt="sm" component={Link} to="/">
        返回项目列表
      </Text>
    </Alert>
  );
}
