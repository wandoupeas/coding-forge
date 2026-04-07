import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildInitVerificationSummary, initProject } from '../../cli/commands/init.js';
import { loadWorkspaceState } from '../../core/workspace.js';
import { buildDoctorReport } from '../../cli/commands/doctor.js';

describe('init command adapter', () => {
  let sandboxDir = '';

  beforeEach(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-init-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (sandboxDir) {
      await rm(sandboxDir, { recursive: true, force: true });
      sandboxDir = '';
    }
  });

  it('creates a workspace in the target base path and prints next steps', async () => {
    await initProject('sample-project', { template: 'default' }, sandboxDir);

    const projectRoot = join(sandboxDir, 'sample-project');
    const workspace = await loadWorkspaceState(projectRoot);
    const report = await buildDoctorReport(projectRoot);
    const verification = await buildInitVerificationSummary(projectRoot);
    const agentsDoc = await readFile(join(projectRoot, 'AGENTS.md'), 'utf-8');
    const agentGuide = await readFile(join(projectRoot, 'docs', 'agent-guide.md'), 'utf-8');
    const superpowersGuide = await readFile(
      join(projectRoot, 'docs', 'methodology', 'superpowers-integration.md'),
      'utf-8'
    );
    const preCommitHook = await readFile(join(projectRoot, '.githooks', 'pre-commit'), 'utf-8');
    const commitMsgHook = await readFile(join(projectRoot, '.githooks', 'commit-msg'), 'utf-8');
    const guardScript = await readFile(join(projectRoot, 'scripts', 'webforge-guard.mjs'), 'utf-8');
    const onboardingProtocol = await readFile(
      join(projectRoot, 'docs', 'examples', 'agent-onboarding-protocol.md'),
      'utf-8'
    );

    expect(workspace.runtime.version).toBe('0.2');
    expect(workspace.paths.runtime).toContain('sample-project/.webforge/runtime.json');
    expect(report.summary.fail).toBe(0);
    expect(report.summary.warn).toBe(0);
    expect(verification).toMatchObject({
      protocolDocExists: true,
      doctorFailCount: 0,
      doctorWarnCount: 0,
      onboardCanProceed: true,
      shouldReadHasAgents: true,
      ok: true
    });
    expect(agentsDoc).toContain('标准 Onboarding Protocol');
    expect(agentsDoc).toContain('webforge onboard --json');
    expect(agentsDoc).toContain('webforge doctor --json');
    expect(agentGuide).toContain('恢复协议');
    expect(agentGuide).toContain('webforge logs runtime --json');
    expect(superpowersGuide).toContain('与恢复协议的连接点');
    expect(superpowersGuide).toContain('doctor / onboard / resume / logs');
    expect(preCommitHook).toContain('node scripts/webforge-guard.mjs pre-commit');
    expect(commitMsgHook).toContain('node scripts/webforge-guard.mjs commit-msg "$1"');
    expect(guardScript).toContain('commit message must start with a tracked task id');
    expect(onboardingProtocol).toContain('Agent Onboarding Protocol');
    expect(onboardingProtocol).toContain('webforge onboard --json');
    expect(onboardingProtocol).toContain('webforge doctor --json');
    expect(onboardingProtocol).toContain('webforge resume --json');
    expect(onboardingProtocol).toContain('webforge logs runtime --json');
    expect(onboardingProtocol).toContain('contextDrift.status = drifted');

    const output = vi.mocked(console.log).mock.calls.flat().map(String).join('\n');
    expect(output).toContain('项目初始化完成');
    expect(output).toContain('初始化后自检');
    expect(output).toContain('doctor: fail=0 | warn=0');
    expect(output).toContain('onboard: canProceed=yes');
    expect(output).toContain('sample-project');
    expect(output).toContain('webforge onboard --json');
  });

  it('patches existing package.json with WebForge guard scripts during in-place init', async () => {
    const packageJsonPath = join(sandboxDir, 'package.json');
    await writeFile(
      packageJsonPath,
      JSON.stringify(
        {
          name: 'in-place-project',
          private: true,
          scripts: {
            test: 'vitest'
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    await initProject('in-place-project', { template: 'default', inPlace: true }, sandboxDir);

    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['webforge:doctor']).toBe('webforge doctor --json');
    expect(packageJson.scripts['webforge:guard']).toBe('node scripts/webforge-guard.mjs pre-commit');
    expect(packageJson.scripts.prepare).toContain('git config core.hooksPath .githooks');
  });
});
