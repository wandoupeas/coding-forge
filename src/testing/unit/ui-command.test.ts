import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../../cli/index.js';
import { startUiServer } from '../../cli/commands/ui.js';

describe('ui command', () => {
  it('registers the ui command on the root program', () => {
    const commandNames = createProgram().commands.map((command) => command.name());

    expect(commandNames).toContain('ui');
  });

  it('accepts root, host and port options', () => {
    const program = createProgram();
    const uiCommand = program.commands.find((command) => command.name() === 'ui');
    const optionNames = uiCommand?.options.map((option) => option.long);

    expect(optionNames).toContain('--root');
    expect(optionNames).toContain('--host');
    expect(optionNames).toContain('--port');
  });

  it('renders a scaffold summary when started', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await startUiServer({
      root: '/tmp/projects',
      host: '127.0.0.1',
      port: '4173'
    });

    const output = consoleSpy.mock.calls.flat().map(String).join('\n');
    expect(output).toContain('Web UI Scaffold');
    expect(output).toContain('root: /tmp/projects');
    expect(output).toContain('host: 127.0.0.1');
    expect(output).toContain('port: 4173');
    expect(output).toContain('url: http://127.0.0.1:4173');

    consoleSpy.mockRestore();
  });
});
