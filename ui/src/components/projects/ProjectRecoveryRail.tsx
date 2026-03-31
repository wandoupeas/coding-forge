import { Badge, Divider, List, Paper, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import type { ApiProjectRecovery } from '../../lib/api';

interface ProjectRecoveryRailProps {
  recovery: ApiProjectRecovery;
}

export default function ProjectRecoveryRail({ recovery }: ProjectRecoveryRailProps) {
  const doctorSummary = `${recovery.doctor.summary.ok} ok / ${recovery.doctor.summary.warn} warn / ${recovery.doctor.summary.fail} fail`;
  const firstMissingThreadArtifact =
    recovery.threadLinkage.missingArtifacts[0] ??
    recovery.threadLinkage.missingWorktreePath ??
    recovery.threadLinkage.missingThreadId ??
    'none';
  const firstMissingWorkflowArtifact =
    recovery.runtimeLogs?.workflowContext?.missingArtifacts[0] ??
    recovery.runtimeLogs?.workflowContext?.missingWorktreePath ??
    recovery.runtimeLogs?.workflowContext?.missingCompactSessionId ??
    'none';

  return (
    <Paper component="aside" aria-label="Recovery rail" withBorder radius="md" p="md">
      <Stack gap="md">
        <Stack gap={4}>
          <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
            Recovery Rail
          </Text>
          <Text fw={700}>Doctor signals, next action, and workspace context.</Text>
          <Stack gap={6}>
            <Badge
              variant="light"
              color={recovery.status === 'ready' ? 'forgeLime' : 'forgeRust'}
              radius="xl"
            >
              {recovery.status}
            </Badge>
            <Badge
              variant="light"
              color={recovery.contextDrift.status === 'drifted' ? 'forgeRust' : 'forgeInk'}
              radius="xl"
            >
              drift: {recovery.contextDrift.status}
            </Badge>
            <Badge
              variant="light"
              color={recovery.threadLinkage.status === 'ready' ? 'forgeLime' : 'forgeRust'}
              radius="xl"
            >
              thread: {recovery.threadLinkage.status}
            </Badge>
          </Stack>
        </Stack>

        <Divider />

        <Section title="Next action">
          <Text size="sm" lh={1.6}>
            {recovery.resume.nextAction}
          </Text>
        </Section>

        <Section title="Doctor">
          <KeyValueRow label="summary" value={doctorSummary} />
          <KeyValueRow label="can proceed" value={recovery.canProceed ? 'yes' : 'no'} />
        </Section>

        <Section title="Workflow context">
          <KeyValueRow label="workflow" value={recovery.workflowContext?.workflow ?? 'none'} />
          <KeyValueRow label="branch" value={recovery.workflowContext?.branch ?? 'none'} />
          <KeyValueRow label="worktree" value={recovery.workflowContext?.worktreePath ?? 'none'} />
          <KeyValueRow label="thread" value={recovery.workflowContext?.threadId ?? 'none'} />
          <KeyValueRow
            label="compact from"
            value={recovery.workflowContext?.compactFromSession ?? 'none'}
          />
          <KeyValueRow label="missing" value={firstMissingWorkflowArtifact} />
        </Section>

        <Section title="Thread linkage">
          <KeyValueRow label="status" value={recovery.threadLinkage.status} />
          <KeyValueRow label="workflow" value={recovery.threadLinkage.workflow ?? 'none'} />
          <KeyValueRow label="branch" value={recovery.threadLinkage.branch ?? 'none'} />
          <KeyValueRow label="worktree" value={recovery.threadLinkage.worktreePath ?? 'none'} />
          <KeyValueRow label="missing" value={firstMissingThreadArtifact} />
        </Section>

        <Section title="Recommended actions">
          {recovery.recommendedActions.length === 0 ? (
            <Text size="sm" c="dimmed">
              No extra actions were recommended by the current recovery snapshot.
            </Text>
          ) : (
            <List spacing="xs" size="sm">
              {recovery.recommendedActions.slice(0, 5).map((action) => (
                <List.Item key={action}>{action}</List.Item>
              ))}
            </List>
          )}
        </Section>
      </Stack>
    </Paper>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
        {title}
      </Text>
      {children}
    </Stack>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text className="forge-mono" size="sm">
        {value}
      </Text>
    </Stack>
  );
}
