#!/usr/bin/env node

import { access } from 'fs/promises';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { constants } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(rootDir, 'dist', 'cli', 'index.js');

async function main() {
  await ensureBuiltCli();

  const sandboxDir = await mkdtemp(join(tmpdir(), 'webforge-smoke-'));
  const projectName = 'demo-onboarding';

  try {
    logStep(`init ${projectName}`);
    const initOutput = await runCli(['init', projectName], sandboxDir);

    const projectRoot = join(sandboxDir, projectName);
    const protocolPath = join(projectRoot, 'docs', 'examples', 'agent-onboarding-protocol.md');
    const protocol = await readFile(protocolPath, 'utf-8');

    assert(initOutput.includes('初始化后自检'), 'init output must include post-init verification');
    assert(initOutput.includes('doctor: fail=0 | warn=0'), 'init output must report doctor self-check');
    assert(initOutput.includes('onboard: canProceed=yes'), 'init output must report onboard self-check');
    assert(
      protocol.includes('webforge onboard --json'),
      'generated onboarding protocol must include onboard --json'
    );

    logStep('verify init');
    const verify = await runCliJson(['verify', 'init', '--json'], projectRoot);
    assert(verify?.ok === true, 'verify init must pass');
    assert(verify?.doctorFailCount === 0, 'verify init doctorFailCount must be 0');
    assert(verify?.onboardCanProceed === true, 'verify init onboardCanProceed must be true');

    logStep('doctor --json');
    const doctor = await runCliJson(['doctor', '--json'], projectRoot);
    assert(doctor?.summary?.fail === 0, 'doctor summary.fail must be 0');
    assert(Array.isArray(doctor?.guidance), 'doctor guidance must be an array');

    logStep('resume --json');
    const resume = await runCliJson(['resume', '--json'], projectRoot);
    assert(Array.isArray(resume?.shouldRead), 'resume shouldRead must be an array');
    assert(resume.shouldRead.includes('AGENTS.md'), 'resume shouldRead must include AGENTS.md');
    assert(typeof resume.nextAction === 'string', 'resume nextAction must be a string');

    logStep('onboard --json');
    const onboard = await runCliJson(['onboard', '--json'], projectRoot);
    assert(onboard?.canProceed === true, 'onboard canProceed must be true');
    assert(onboard?.doctor?.summary?.fail === 0, 'onboard doctor summary.fail must be 0');
    assert(Array.isArray(onboard?.shouldRead), 'onboard shouldRead must be an array');
    assert(
      onboard.shouldRead.includes('AGENTS.md'),
      'onboard shouldRead must include AGENTS.md'
    );

    console.log('Smoke onboarding passed.');
    console.log(`doctor.fail=${doctor.summary.fail}`);
    console.log(`resume.nextAction=${resume.nextAction}`);
    console.log(`onboard.status=${onboard.status}`);
  } finally {
    await rm(sandboxDir, { recursive: true, force: true });
  }
}

async function ensureBuiltCli() {
  try {
    await access(cliPath, constants.R_OK);
  } catch {
    throw new Error(`CLI build output not found at ${cliPath}. Run npm run build first.`);
  }
}

async function runCli(args, cwd) {
  const result = await runNode(args, cwd);
  if (result.code !== 0) {
    throw new Error(
      `Command failed: node ${cliPath} ${args.join(' ')}\n${result.stderr || result.stdout}`
    );
  }

  return result.stdout.trim();
}

async function runCliJson(args, cwd) {
  const output = await runCli(args, cwd);

  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON output for ${args.join(' ')}: ${String(error)}\n${output}`
    );
  }
}

function runNode(args, cwd) {
  return new Promise((resolve, reject) => {
    const stdoutPath = join(cwd, `.webforge-smoke-${Date.now()}-stdout.log`);
    const stderrPath = join(cwd, `.webforge-smoke-${Date.now()}-stderr.log`);
    const child = spawn(
      '/bin/bash',
      ['-lc', `${buildShellCommand(args)} > ${shellQuote(stdoutPath)} 2> ${shellQuote(stderrPath)}`],
      {
      cwd,
      stdio: ['ignore', 'ignore', 'ignore']
      }
    );

    child.on('error', reject);
    child.on('close', async (code) => {
      const stdout = await readOptionalText(stdoutPath);
      const stderr = await readOptionalText(stderrPath);
      await rm(stdoutPath, { force: true });
      await rm(stderrPath, { force: true });
      resolve({ code, stdout, stderr });
    });
  });
}

function buildShellCommand(args) {
  const command = [process.execPath, cliPath, ...args]
    .map((part) => shellQuote(part))
    .join(' ');

  return command;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

async function readOptionalText(path) {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logStep(step) {
  console.log(`> ${step}`);
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
