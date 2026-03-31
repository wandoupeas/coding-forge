import { Badge, Paper, ScrollArea, Table, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { ProjectsDashboardSnapshot } from '../../lib/api';

interface WorkspaceLedgerTableProps {
  projects: ProjectsDashboardSnapshot['projects'];
}

export default function WorkspaceLedgerTable({ projects }: WorkspaceLedgerTableProps) {
  return (
    <Paper component="section" aria-label="工作区台账" withBorder radius="md" p="md">
      <ScrollArea type="auto" offsetScrollbars>
        <Table
          miw={820}
          highlightOnHover
          withColumnBorders
          withTableBorder
          striped
          verticalSpacing="sm"
          horizontalSpacing="md"
          aria-label="工作区台账"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>工作区</Table.Th>
              <Table.Th>任务</Table.Th>
              <Table.Th>运行时</Table.Th>
              <Table.Th>恢复</Table.Th>
              <Table.Th>产物</Table.Th>
              <Table.Th>更新时间</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {projects.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed">暂无可用的项目行。</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              projects.map((entry) => {
                const overview = entry.overview;
                const runtimeStatus = overview?.runtime.status ?? 'unavailable';
                const recoveryStatus = overview?.recovery.status ?? 'blocked';
                const taskSummary = overview
                  ? `${overview.tasks.ready} 就绪 / ${overview.tasks.blocked} 阻塞 / ${overview.tasks.pendingReview} 待审核`
                  : '概览不可用';
                const artifactSummary = overview
                  ? `${overview.artifacts.knowledgeCount} 知识 / ${overview.artifacts.deliverablesCount} 交付物 / ${overview.artifacts.sessionCount} 会话`
                  : '无产物快照';

                return (
                  <Table.Tr key={entry.project.id}>
                    <Table.Td>
                      <Text component={Link} to={`/projects/${entry.project.id}`} fw={700}>
                        {entry.project.name}
                      </Text>
                      <Text className="forge-mono" size="xs" c="dimmed">
                        {entry.project.rootPath}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{taskSummary}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={runtimeColor(runtimeStatus)}>
                        {runtimeStatus}
                      </Badge>
                      <Text mt={6} size="xs" c="dimmed">
                        {overview?.runtime.summary ?? entry.error ?? '快照待生成'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={recoveryColor(recoveryStatus)}>
                        {recoveryStatus}
                      </Badge>
                      <Text mt={6} size="xs" c="dimmed">
                        {overview
                          ? `drift=${overview.recovery.contextDriftStatus} / thread=${overview.recovery.threadLinkageStatus}`
                          : '恢复不可用'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{artifactSummary}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text className="forge-mono" size="xs">
                        {entry.project.updatedAt}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  );
}

function runtimeColor(status: string) {
  if (status === 'ready') {
    return 'forgeLime' as const;
  }

  if (status === 'running' || status === 'watch') {
    return 'forgeInk' as const;
  }

  return 'forgeRust' as const;
}

function recoveryColor(status: string) {
  return status === 'ready' ? ('forgeLime' as const) : ('forgeRust' as const);
}
