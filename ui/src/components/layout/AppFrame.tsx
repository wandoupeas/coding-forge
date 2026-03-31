import { AppShell, Group, Stack, Text, Title } from '@mantine/core';
import type { PropsWithChildren } from 'react';

export default function AppFrame({ children }: PropsWithChildren) {
  return (
    <AppShell
      header={{ height: 84 }}
      padding="md"
      styles={{
        header: {
          background: 'var(--mantine-color-body)',
          borderBottom: '1px solid var(--mantine-color-default-border)'
        },
        main: {
          background: 'var(--mantine-color-body)'
        }
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" align="center">
          <Stack gap={0}>
            <Title order={3} fw={600}>
              Coding Forge Monitor
            </Title>
            <Text size="xs" c="dimmed">
              Read-only workspace monitor backed by <span className="forge-mono">.webforge/</span>
            </Text>
          </Stack>
        </Group>
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
