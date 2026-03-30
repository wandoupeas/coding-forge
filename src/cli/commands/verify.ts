/**
 * verify 命令 - 对显式验证场景提供稳定入口
 */

import { resolve } from 'path';
import { Command } from 'commander';
import logger from '../utils/logger.js';
import {
  buildInitVerificationSummary,
  type InitVerificationSummary
} from './init.js';

export interface VerifyInitOptions {
  json?: boolean;
}

export function createVerifyCommand(basePath: string = process.cwd()): Command {
  const command = new Command('verify').description('运行可复用的 WebForge 验证流程');

  command
    .command('init')
    .description('验证初始化后的 onboarding contract 与 doctor/onboard 输出是否一致')
    .argument('[project-path]', '要验证的项目路径，默认使用当前目录')
    .option('--json', '输出结构化验证结果')
    .action(async (projectPath: string | undefined, options: VerifyInitOptions) => {
      try {
        const summary = await verifyInitCommand(projectPath, options, basePath);
        if (!summary.ok) {
          process.exit(1);
        }
      } catch (error) {
        logger.error(`验证失败: ${error}`);
        process.exit(1);
      }
    });

  return command;
}

export async function verifyInitCommand(
  projectPath?: string,
  options: VerifyInitOptions = {},
  basePath: string = process.cwd()
): Promise<InitVerificationSummary> {
  const targetPath = projectPath ? resolve(basePath, projectPath) : basePath;
  const summary = await buildInitVerificationSummary(targetPath);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  logger.h1('🧪 Init Verification');
  logger.info(`target: ${targetPath}`);
  logger.info(`status: ${summary.ok ? 'ok' : 'fail'}`);
  logger.info(`protocol doc: ${summary.protocolDocPath}`);
  logger.info(`protocol doc exists: ${summary.protocolDocExists ? 'yes' : 'no'}`);
  logger.info(`doctor: fail=${summary.doctorFailCount} | warn=${summary.doctorWarnCount}`);
  logger.info(`onboard: canProceed=${summary.onboardCanProceed ? 'yes' : 'no'}`);
  logger.info(`shouldRead contains AGENTS.md: ${summary.shouldReadHasAgents ? 'yes' : 'no'}`);

  return summary;
}
