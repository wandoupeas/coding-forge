import { mkdtemp, rm, symlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createProgram,
  isCliEntrypoint,
  registerGlobalErrorHandlers
} from '../../cli/index.js';

describe('cli bootstrap', () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      cleanupPaths.splice(0, cleanupPaths.length).map((path) =>
        rm(path, { recursive: true, force: true })
      )
    );
  });

  it('creates a program with the expected commands', () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toEqual([
      'init',
      'plan',
      'run',
      'onboard',
      'resume',
      'dashboard',
      'doctor',
      'superpowers',
      'knowledge',
      'logs',
      'deliverables',
      'review',
      'checkpoint',
      'mailbox',
      'verify',
      'record',
      'ui'
    ]);
  });

  it('exposes structured briefing output on the resume and doctor commands', () => {
    const program = createProgram();
    const resume = program.commands.find((command) => command.name() === 'resume');
    const doctor = program.commands.find((command) => command.name() === 'doctor');
    const resumeFlags = resume?.options.map((option) => option.long);
    const doctorFlags = doctor?.options.map((option) => option.long);

    expect(resumeFlags).toContain('--json');
    expect(doctorFlags).toContain('--json');
  });

  it('detects whether the current argv targets the CLI entrypoint', () => {
    expect(isCliEntrypoint(['node', '/tmp/elsewhere.js'])).toBe(false);
    expect(isCliEntrypoint(['node', new URL('../../cli/index.ts', import.meta.url).pathname])).toBe(
      true
    );
  });

  it('treats a symlink to the CLI entrypoint as the current executable', async () => {
    const sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-cli-entry-'));
    cleanupPaths.push(sandboxDir);

    const symlinkPath = join(sandboxDir, 'webforge');
    await symlink(new URL('../../cli/index.ts', import.meta.url).pathname, symlinkPath);

    expect(isCliEntrypoint(['node', symlinkPath])).toBe(true);
  });

  it('registers both global error handlers', () => {
    const onSpy = vi.spyOn(process, 'on');

    registerGlobalErrorHandlers();

    expect(onSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
  });
});
