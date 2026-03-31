import { Badge, Box, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import ProjectStatusSummary from './ProjectStatusSummary';
import type { ApiProjectOverview, ApiProjectRecord } from '../../lib/api';

interface ProjectCardProps {
  project: ApiProjectRecord;
  overview: ApiProjectOverview | null;
  error: string | null;
}

export default function ProjectCard({ project, overview, error }: ProjectCardProps) {
  const health = getHealthTone(overview, error);

  return (
    <Box
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: 360,
        padding: '1.25rem',
        borderRadius: 24,
        border: `1px solid ${health.border}`,
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,248,240,0.72))',
        boxShadow: '0 20px 48px rgba(22, 32, 40, 0.1)'
      }}
    >
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          background: health.glow,
          pointerEvents: 'none'
        }}
      />
      <Stack gap="lg" style={{ position: 'relative', zIndex: 1 }}>
        <Group justify="space-between" align="flex-start">
          <Stack gap={6} style={{ maxWidth: '75%' }}>
            <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
              Workspace
            </Text>
            <Title order={3} style={{ fontSize: '1.65rem', lineHeight: 1 }}>
              {project.name}
            </Title>
            <Text className="forge-mono" size="xs" c="dimmed">
              {project.rootPath}
            </Text>
          </Stack>

          <Badge
            radius="xl"
            size="lg"
            style={{
              background: health.badge,
              color: health.badgeText,
              border: `1px solid ${health.border}`
            }}
          >
            {health.label}
          </Badge>
        </Group>

        {overview ? (
          <>
            <ProjectStatusSummary
              ready={overview.tasks.ready}
              blocked={overview.tasks.blocked}
              pendingReview={overview.tasks.pendingReview}
              total={overview.tasks.total}
            />

            <Group gap="sm" wrap="wrap">
              <MetaPill label="Recovery" value={overview.recovery.status} />
              <MetaPill label="Drift" value={overview.recovery.contextDriftStatus} />
              <MetaPill label="Thread" value={overview.recovery.threadLinkageStatus} />
              <MetaPill label="Runtime" value={overview.runtime.status} />
            </Group>

            <Box
              style={{
                padding: '0.95rem 1rem',
                borderRadius: 16,
                background: 'rgba(22, 32, 40, 0.92)',
                color: '#f8f3e8'
              }}
            >
              <Text className="forge-mono" size="xs" c="rgba(248,243,232,0.7)" tt="uppercase">
                Next signal
              </Text>
              <Text mt={8} size="sm" lh={1.6}>
                {overview.runtime.summary || 'No runtime summary yet.'}
              </Text>
              <Text mt={10} className="forge-mono" size="xs" c="rgba(248,243,232,0.7)">
                latest event: {overview.runtime.latestRuntimeEvent ?? 'none'}
              </Text>
            </Box>

            <Text
              component={Link}
              to={`/projects/${project.id}`}
              className="forge-mono"
              size="xs"
              tt="uppercase"
              fw={700}
              style={{
                alignSelf: 'flex-start',
                padding: '0.55rem 0.85rem',
                borderRadius: 999,
                border: '1px solid rgba(22,32,40,0.12)',
                background: 'rgba(255,255,255,0.66)'
              }}
            >
              Open project board
            </Text>
          </>
        ) : (
          <Box
            style={{
              padding: '1rem',
              borderRadius: 16,
              border: '1px dashed rgba(22,32,40,0.18)',
              background: 'rgba(255,255,255,0.55)'
            }}
          >
            <Text fw={600}>Project discovered, but overview is unavailable.</Text>
            <Text mt={6} size="sm" c="dimmed">
              {error ?? 'The project has not produced a readable overview yet.'}
            </Text>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <Box
      style={{
        padding: '0.45rem 0.75rem',
        borderRadius: 999,
        border: '1px solid rgba(22,32,40,0.1)',
        background: 'rgba(255,255,255,0.62)'
      }}
    >
      <Text className="forge-mono" size="xs" tt="uppercase">
        {label}: {value}
      </Text>
    </Box>
  );
}

function getHealthTone(overview: ApiProjectOverview | null, error: string | null) {
  if (error || !overview) {
    return {
      label: 'Needs Attention',
      border: 'rgba(212, 78, 33, 0.28)',
      badge: 'rgba(212, 78, 33, 0.14)',
      badgeText: '#8b3516',
      glow: 'radial-gradient(circle at top right, rgba(212,78,33,0.16), transparent 34%)'
    };
  }

  if (!overview.recovery.canProceed || overview.tasks.blocked > 0) {
    return {
      label: 'Blocked',
      border: 'rgba(212, 78, 33, 0.28)',
      badge: 'rgba(212, 78, 33, 0.14)',
      badgeText: '#8b3516',
      glow: 'radial-gradient(circle at top right, rgba(212,78,33,0.16), transparent 34%)'
    };
  }

  if (overview.tasks.pendingReview > 0 || overview.recovery.contextDriftStatus === 'drifted') {
    return {
      label: 'Watch',
      border: 'rgba(50, 91, 140, 0.26)',
      badge: 'rgba(50, 91, 140, 0.12)',
      badgeText: '#204a75',
      glow: 'radial-gradient(circle at top right, rgba(50,91,140,0.14), transparent 34%)'
    };
  }

  return {
    label: 'Healthy',
    border: 'rgba(151, 199, 31, 0.3)',
    badge: 'rgba(151, 199, 31, 0.14)',
    badgeText: '#49620e',
    glow: 'radial-gradient(circle at top right, rgba(151,199,31,0.16), transparent 34%)'
  };
}
