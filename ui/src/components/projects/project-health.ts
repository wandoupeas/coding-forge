import type { ProjectsDashboardSnapshot } from '../../lib/api';

export type ProjectDashboardEntry = ProjectsDashboardSnapshot['projects'][number];

export type ProjectHealthKind = 'healthy' | 'watch' | 'blocked' | 'missing-overview';

export interface ProjectHealth {
  kind: ProjectHealthKind;
  severity: number;
  label: string;
  color: 'forgeLime' | 'forgeInk' | 'forgeRust';
  summary: string;
}

export interface ProjectHealthTotals {
  healthy: number;
  watch: number;
  blocked: number;
  pendingReview: number;
}

const HEALTH_LABELS: Record<ProjectHealthKind, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  blocked: 'Blocked',
  'missing-overview': 'Missing overview'
};

const HEALTH_COLORS: Record<ProjectHealthKind, 'forgeLime' | 'forgeInk' | 'forgeRust'> = {
  healthy: 'forgeLime',
  watch: 'forgeInk',
  blocked: 'forgeRust',
  'missing-overview': 'forgeRust'
};

const HEALTH_SEVERITY: Record<ProjectHealthKind, number> = {
  healthy: 0,
  watch: 1,
  blocked: 2,
  'missing-overview': 3
};

export function getProjectHealth(entry: ProjectDashboardEntry): ProjectHealth {
  if (!entry.overview || entry.error) {
    return {
      kind: 'missing-overview',
      severity: HEALTH_SEVERITY['missing-overview'],
      label: HEALTH_LABELS['missing-overview'],
      color: HEALTH_COLORS['missing-overview'],
      summary: entry.error ?? 'No project overview is available yet.'
    };
  }

  if (!entry.overview.recovery.canProceed || entry.overview.tasks.blocked > 0) {
    return {
      kind: 'blocked',
      severity: HEALTH_SEVERITY.blocked,
      label: HEALTH_LABELS.blocked,
      color: HEALTH_COLORS.blocked,
      summary: `${entry.overview.tasks.blocked} blocked task(s), ${entry.overview.runtime.summary}`
    };
  }

  if (
    entry.overview.tasks.pendingReview > 0 ||
    entry.overview.recovery.contextDriftStatus === 'drifted'
  ) {
    return {
      kind: 'watch',
      severity: HEALTH_SEVERITY.watch,
      label: HEALTH_LABELS.watch,
      color: HEALTH_COLORS.watch,
      summary:
        entry.overview.tasks.pendingReview > 0
          ? `${entry.overview.tasks.pendingReview} item(s) pending review`
          : `Context drift reported as ${entry.overview.recovery.contextDriftStatus}`
    };
  }

  return {
    kind: 'healthy',
    severity: HEALTH_SEVERITY.healthy,
    label: HEALTH_LABELS.healthy,
    color: HEALTH_COLORS.healthy,
    summary: entry.overview.runtime.summary || 'Snapshot is ready for follow-up work.'
  };
}

export function summarizeProjectHealth(projects: ProjectsDashboardSnapshot['projects']): ProjectHealthTotals {
  return projects.reduce(
    (totals, entry) => {
      const health = getProjectHealth(entry);

      if (health.kind === 'healthy') {
        totals.healthy += 1;
      } else if (health.kind === 'watch') {
        totals.watch += 1;
      } else {
        totals.blocked += 1;
      }

      if (entry.overview?.tasks.pendingReview) {
        totals.pendingReview += 1;
      }

      return totals;
    },
    {
      healthy: 0,
      watch: 0,
      blocked: 0,
      pendingReview: 0
    }
  );
}

export function compareProjectHealth(a: ProjectHealth, b: ProjectHealth): number {
  if (a.severity !== b.severity) {
    return b.severity - a.severity;
  }

  return 0;
}
