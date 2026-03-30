import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { initProject } from '../../cli/commands/init.js';
import { verifyInitCommand } from '../../cli/commands/verify.js';

describe('verify command', () => {
  let sandboxDir = '';

  beforeEach(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-verify-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (sandboxDir) {
      await rm(sandboxDir, { recursive: true, force: true });
      sandboxDir = '';
    }
  });

  it('verifies an initialized project in text mode', async () => {
    await initProject('verify-project', { template: 'default' }, sandboxDir);
    vi.mocked(console.log).mockClear();

    const projectRoot = join(sandboxDir, 'verify-project');
    const summary = await verifyInitCommand(undefined, {}, projectRoot);

    expect(summary.ok).toBe(true);
    const output = vi.mocked(console.log).mock.calls.flat().map(String).join('\n');
    expect(output).toContain('Init Verification');
    expect(output).toContain(`target: ${projectRoot}`);
    expect(output).toContain('status: ok');
    expect(output).toContain('doctor: fail=0 | warn=0');
    expect(output).toContain('onboard: canProceed=yes');
  });

  it('supports json output with a relative project path', async () => {
    await initProject('verify-json-project', { template: 'default' }, sandboxDir);
    vi.mocked(console.log).mockClear();

    const summary = await verifyInitCommand('verify-json-project', { json: true }, sandboxDir);
    const payload = JSON.parse(vi.mocked(console.log).mock.calls.flat().map(String).join('\n'));

    expect(summary.ok).toBe(true);
    expect(payload.ok).toBe(true);
    expect(payload.protocolDocExists).toBe(true);
    expect(payload.doctorFailCount).toBe(0);
    expect(payload.onboardCanProceed).toBe(true);
  });
});
