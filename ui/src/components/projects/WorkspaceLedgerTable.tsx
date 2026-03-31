import { Badge, Paper, ScrollArea, Table, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { ProjectsDashboardSnapshot } from '../../lib/api';

interface WorkspaceLedgerTableProps {
  projects: ProjectsDashboardSnapshot['projects'];
}

export default function WorkspaceLedgerTable({ projects }: WorkspaceLedgerTableProps) {
  return (
    <Paper component="section" aria-label="Workspace ledger" withBorder radius="md" p="md">
      <ScrollArea type="auto" offsetScrollbars>
        <Table
          miw={820}
          highlightOnHover
          withColumnBorders
          withTableBorder
          striped
          verticalSpacing="sm"
          horizontalSpacing="md"
          aria-label="Workspace ledger"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Workspace</Table.Th>
              <Table.Th>Tasks</Table.Th>
              <Table.Th>Runtime</Table.Th>
              <Table.Th>Recovery</Table.Th>
              <Table.Th>Artifacts</Table.Th>
              <Table.Th>Updated</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {projects.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed">No project rows are available yet.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              projects.map((entry) => {
                const overview = entry.overview;
                const runtimeStatus = overview?.runtime.status ?? 'unavailable';
                const recoveryStatus = overview?.recovery.status ?? 'blocked';
                const taskSummary = overview
                  ? `${overview.tasks.ready} ready / ${overview.tasks.blocked} blocked / ${overview.tasks.pendingReview} review`
                  : 'overview unavailable';
                const artifactSummary = overview
                  ? `${overview.artifacts.knowledgeCount} knowledge / ${overview.artifacts.deliverablesCount} deliverables / ${overview.artifacts.sessionCount} sessions`
                  : 'no artifacts snapshot';

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
                        {overview?.runtime.summary ?? entry.error ?? 'snapshot pending'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={recoveryColor(recoveryStatus)}>
                        {recoveryStatus}
                      </Badge>
                      <Text mt={6} size="xs" c="dimmed">
                        {overview
                          ? `drift=${overview.recovery.contextDriftStatus} / thread=${overview.recovery.threadLinkageStatus}`
                          : 'recovery unavailable'}
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
