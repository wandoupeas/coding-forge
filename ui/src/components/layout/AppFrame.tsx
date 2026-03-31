import { AppShell, Box, Group, Stack, Text, Title } from '@mantine/core';
import type { PropsWithChildren } from 'react';

export default function AppFrame({ children }: PropsWithChildren) {
  return (
    <AppShell
      header={{ height: 164 }}
      padding="lg"
      styles={{
        main: {
          background: 'transparent'
        },
        header: {
          background: 'transparent',
          border: 'none'
        }
      }}
    >
      <AppShell.Header px="lg" py="md">
        <Box
          style={{
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid var(--forge-line)',
            borderRadius: 24,
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,248,236,0.72))',
            boxShadow: 'var(--forge-shadow)'
          }}
        >
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, rgba(151,199,31,0.08), transparent 36%, rgba(212,78,33,0.08))',
              pointerEvents: 'none'
            }}
          />
          <Group justify="space-between" align="flex-start" px="xl" py="lg">
            <Stack gap={8}>
              <Text className="forge-mono" size="xs" c="dimmed" tt="uppercase">
                Coding Forge / Monitoring Surface
              </Text>
              <Title
                order={1}
                style={{
                  fontSize: 'clamp(2rem, 4vw, 3.5rem)',
                  lineHeight: 0.94,
                  maxWidth: 780
                }}
              >
                A living control surface for every
                <br />
                <span style={{ color: 'var(--forge-rust)' }}>WebForge workspace</span>.
              </Title>
            </Stack>

            <Box
              style={{
                minWidth: 240,
                padding: '0.85rem 1rem',
                borderRadius: 18,
                border: '1px solid rgba(22, 32, 40, 0.12)',
                background: 'rgba(22, 32, 40, 0.92)',
                color: '#f8f3e8'
              }}
            >
              <Text className="forge-mono" size="xs" c="rgba(248,243,232,0.72)" tt="uppercase">
                Operating note
              </Text>
              <Text mt={8} size="sm" lh={1.55}>
                Read-only mission control. It visualizes `.webforge/` as-is and never writes back
                to project state.
              </Text>
            </Box>
          </Group>
        </Box>
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
