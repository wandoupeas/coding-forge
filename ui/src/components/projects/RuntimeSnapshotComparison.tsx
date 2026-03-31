import { Paper, Stack, Text } from '@mantine/core';
import type { ApiProjectRecovery } from '../../lib/api';

interface RuntimeSnapshotComparisonProps {
  title: string;
  workflowContext:
    | NonNullable<ApiProjectRecovery['runtimeLogs']>['workflowContext']
    | NonNullable<ApiProjectRecovery['runtimeLogs']>['currentWorkflowContext'];
  threadLinkage:
    | NonNullable<ApiProjectRecovery['runtimeLogs']>['threadLinkage']
    | NonNullable<ApiProjectRecovery['runtimeLogs']>['currentThreadLinkage']
    | null;
}

export default function RuntimeSnapshotComparison({
  title,
  workflowContext,
  threadLinkage
}: RuntimeSnapshotComparisonProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
          {title}
        </Text>
        <KeyValueRow label="工作流" value={workflowContext?.workflow ?? 'none'} />
        <KeyValueRow label="状态" value={workflowContext?.status ?? 'none'} />
        <KeyValueRow label="分支" value={workflowContext?.branch ?? 'none'} />
        <KeyValueRow label="工作树" value={workflowContext?.worktreePath ?? 'none'} />
        <KeyValueRow label="线程" value={threadLinkage?.threadId ?? 'none'} />
        <KeyValueRow label="线程状态" value={threadLinkage?.status ?? 'none'} />
        <KeyValueRow
          label="缺失"
          value={
            threadLinkage?.missingArtifacts[0] ??
            threadLinkage?.missingWorktreePath ??
            threadLinkage?.missingThreadId ??
            workflowContext?.missingArtifacts[0] ??
            workflowContext?.missingWorktreePath ??
            workflowContext?.missingCompactSessionId ??
            'none'
          }
        />
      </Stack>
    </Paper>
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
