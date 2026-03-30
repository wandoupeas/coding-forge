/**
 * CLI 日志工具
 * 美化终端输出
 */

import chalk from 'chalk';

export const logger = {
  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  },

  success(message: string): void {
    console.log(chalk.green('✔'), message);
  },

  warning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  },

  error(message: string): void {
    console.log(chalk.red('✖'), message);
  },

  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🐛'), chalk.gray(message));
    }
  },

  h1(title: string): void {
    console.log('\n' + chalk.bold.green(title));
    console.log(chalk.green('═'.repeat(title.length * 2)));
  },

  h2(title: string): void {
    console.log('\n' + chalk.bold.cyan(title));
  },

  list(items: string[], bullet: string = '  •'): void {
    for (const item of items) {
      console.log(`${bullet} ${item}`);
    }
  },

  table(rows: string[][]): void {
    // 简单表格实现
    if (rows.length === 0) return;

    const colWidths = rows[0].map((_, i) => 
      Math.max(...rows.map(row => (row[i] || '').length))
    );

    for (const row of rows) {
      const line = row.map((cell, i) => 
        (cell || '').padEnd(colWidths[i] + 2)
      ).join('');
      console.log('  ' + line);
    }
  },

  // 进度条
  progress(current: number, total: number, width: number = 30): string {
    const ratio = total > 0 ? current / total : 0;
    const filled = Math.round(width * ratio);
    const empty = width - filled;
    
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percent = Math.round(ratio * 100);
    
    return `[${bar}] ${percent}% (${current}/${total})`;
  }
};

export default logger;
