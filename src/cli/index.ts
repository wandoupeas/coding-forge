#!/usr/bin/env node
/**
 * WebForge CLI 入口
 */

import { Command } from 'commander';
import { realpathSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInitCommand } from './commands/init.js';
import { createPlanCommand } from './commands/plan.js';
import { createRunCommand, createDeliverablesCommand } from './commands/run.js';
import { createOnboardCommand } from './commands/onboard.js';
import { createResumeCommand } from './commands/resume.js';
import { createDashboardCommand } from './commands/dashboard.js';
import { createDoctorCommand } from './commands/doctor.js';
import { createSuperpowersCommand } from './commands/superpowers.js';
import { createKnowledgeCommand } from './commands/knowledge.js';
import { createLogsCommand } from './commands/logs.js';
import { createMailboxCommand } from './commands/mailbox.js';
import { createReviewCommand } from './commands/review.js';
import { createCheckpointCommand } from './commands/checkpoint.js';
import { createUiCommand } from './commands/ui.js';
import logger from './utils/logger.js';
import { createVerifyCommand } from './commands/verify.js';
import { createRecordCommand } from './commands/record.js';
import { createStatusCommand } from './commands/status.js';

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('webforge')
    .description('WebForge harness compatibility CLI')
    .version(getVersion())
    .showHelpAfterError()
    .configureOutput({
      writeErr: (str) => logger.error(str.trim()),
      outputError: (str, write) => write(logger.error(str.trim()) as unknown as string)
    });

  program.addCommand(createInitCommand());
  program.addCommand(createPlanCommand());
  program.addCommand(createRunCommand());
  program.addCommand(createOnboardCommand());
  program.addCommand(createResumeCommand());
  program.addCommand(createDashboardCommand());
  program.addCommand(createDoctorCommand());
  program.addCommand(createSuperpowersCommand());
  program.addCommand(createKnowledgeCommand());
  program.addCommand(createLogsCommand());
  program.addCommand(createDeliverablesCommand());
  program.addCommand(createReviewCommand());
  program.addCommand(createCheckpointCommand());
  program.addCommand(createMailboxCommand());
  program.addCommand(createVerifyCommand());
  program.addCommand(createRecordCommand());
  program.addCommand(createStatusCommand());
  program.addCommand(createUiCommand());

  return program;
}

export function registerGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    logger.error(`未捕获的异常: ${error.message}`);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error(`未处理的 Promise: ${reason}`);
    process.exit(1);
  });
}

export function isCliEntrypoint(argv: string[] = process.argv): boolean {
  if (!argv[1]) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(realpathSync(argv[1])).href;
  } catch {
    return import.meta.url === pathToFileURL(resolve(argv[1])).href;
  }
}

if (isCliEntrypoint()) {
  registerGlobalErrorHandlers();
  createProgram().parse();
}
