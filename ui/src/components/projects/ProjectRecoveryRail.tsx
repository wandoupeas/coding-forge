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
    <Paper component="aside" aria-label="恢复侧栏" withBorder radius="md" p="md">
      <Stack gap="md">
        <Stack gap={4}>
          <Text className="forge-mono" size="xs" tt="uppercase" c="dimmed">
            恢复侧栏
          </Text>
          <Text fw={700}>Doctor 信号、下一步操作和工作区上下文。</Text>
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

        <Section title="下一步操作">
          <Text size="sm" lh={1.6}>
            {recovery.resume.nextAction}
          </Text>
        </Section>

        <Section title="Doctor 诊断">
          <KeyValueRow label="摘要" value={doctorSummary} />
          <KeyValueRow label="可继续" value={recovery.canProceed ? '是' : '否'} />
        </Section>

        <Section title="工作流上下文">
          <KeyValueRow label="工作流" value={recovery.workflowContext?.workflow ?? 'none'} />
          <KeyValueRow label="分支" value={recovery.workflowContext?.branch ?? 'none'} />
          <KeyValueRow label="工作树" value={recovery.workflowContext?.worktreePath ?? 'none'} />
          <KeyValueRow label="线程" value={recovery.workflowContext?.threadId ?? 'none'} />
          <KeyValueRow
            label="压缩来源"
            value={recovery.workflowContext?.compactFromSession ?? 'none'}
          />
          <KeyValueRow label="缺失" value={firstMissingWorkflowArtifact} />
        </Section>

        <Section title="线程关联">
          <KeyValueRow label="状态" value={recovery.threadLinkage.status} />
          <KeyValueRow label="工作流" value={recovery.threadLinkage.workflow ?? 'none'} />
          <KeyValueRow label="分支" value={recovery.threadLinkage.branch ?? 'none'} />
          <KeyValueRow label="工作树" value={recovery.threadLinkage.worktreePath ?? 'none'} />
          <KeyValueRow label="缺失" value={firstMissingThreadArtifact} />
        </Section>

        <Section title="建议操作">
          {recovery.recommendedActions.length === 0 ? (
            <Text size="sm" c="dimmed">
              当前恢复快照未产生额外建议。
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
