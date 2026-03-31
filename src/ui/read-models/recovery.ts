import { buildDoctorReport } from '../../cli/commands/doctor.js';
import { buildRuntimeLogsSummary } from '../../cli/commands/logs.js';
import { buildOnboardingSummary } from '../../cli/commands/onboard.js';
import { buildResumeSummary } from '../../cli/commands/resume.js';

export interface RecoveryReadModel {
  doctor: Awaited<ReturnType<typeof buildDoctorReport>>;
  resume: Awaited<ReturnType<typeof buildResumeSummary>>;
  onboard: Awaited<ReturnType<typeof buildOnboardingSummary>>;
  runtimeLogs: Awaited<ReturnType<typeof buildRuntimeLogsSummary>> | null;
  canProceed: boolean;
  status: 'ready' | 'blocked';
  contextDrift: Awaited<ReturnType<typeof buildResumeSummary>>['runtimeLog']['contextDrift'];
  threadLinkage: Awaited<ReturnType<typeof buildResumeSummary>>['threadLinkage'];
  workflowContext: Awaited<ReturnType<typeof buildResumeSummary>>['workflowContext'];
  recommendedActions: string[];
}

export async function buildRecoveryReadModel(
  basePath: string = process.cwd()
): Promise<RecoveryReadModel> {
  const [doctor, resume, onboard] = await Promise.all([
    buildDoctorReport(basePath),
    buildResumeSummary(basePath),
    buildOnboardingSummary(basePath)
  ]);
  const runtimeLogs = await buildRuntimeLogsSummary(resume.runtimeLog.sessionId ?? undefined, basePath)
    .catch(() => null);

  return {
    doctor,
    resume,
    onboard,
    runtimeLogs,
    canProceed: onboard.canProceed,
    status: onboard.status,
    contextDrift: resume.runtimeLog.contextDrift,
    threadLinkage: resume.threadLinkage,
    workflowContext: resume.workflowContext,
    recommendedActions: onboard.recommendedActions
  };
}
