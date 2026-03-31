import { Box, Group, Stack, Text } from '@mantine/core';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface ProjectStatusSummaryProps {
  ready: number;
  blocked: number;
  pendingReview: number;
  total: number;
}

const COLORS = {
  ready: '#97c71f',
  blocked: '#d44e21',
  pendingReview: '#325b8c',
  idle: '#c7b79d'
};

export default function ProjectStatusSummary(props: ProjectStatusSummaryProps) {
  const chartData = [
    { name: '就绪', value: props.ready, color: COLORS.ready },
    { name: '阻塞', value: props.blocked, color: COLORS.blocked },
    { name: '待审核', value: props.pendingReview, color: COLORS.pendingReview },
    {
      name: '其他',
      value: Math.max(props.total - props.ready - props.blocked - props.pendingReview, 0),
      color: COLORS.idle
    }
  ].filter((item) => item.value > 0);

  return (
    <Group align="stretch" gap="md" wrap="nowrap">
      <Box
        style={{
          width: 120,
          minWidth: 120,
          height: 120,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.64)',
          border: '1px solid rgba(22,32,40,0.08)'
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={30}
              outerRadius={44}
              stroke="none"
              paddingAngle={5}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Box>

      <Stack gap={8} justify="center" style={{ flex: 1 }}>
        <SummaryRow label="就绪" value={props.ready} accent={COLORS.ready} />
        <SummaryRow label="阻塞" value={props.blocked} accent={COLORS.blocked} />
        <SummaryRow label="待审核" value={props.pendingReview} accent={COLORS.pendingReview} />
        <SummaryRow label="任务总计" value={props.total} accent={COLORS.idle} />
      </Stack>
    </Group>
  );
}

function SummaryRow({
  label,
  value,
  accent
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Group
      justify="space-between"
      px="sm"
      py={8}
      style={{
        borderRadius: 12,
        background: 'rgba(255,255,255,0.55)',
        border: '1px solid rgba(22,32,40,0.08)'
      }}
    >
      <Group gap="xs">
        <Box
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: accent
          }}
        />
        <Text size="sm">{label}</Text>
      </Group>
      <Text className="forge-mono" fw={700}>
        {value}
      </Text>
    </Group>
  );
}
