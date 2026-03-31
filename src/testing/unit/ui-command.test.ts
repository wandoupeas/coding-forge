import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProgram } from '../../cli/index.js';
import { startUiServer } from '../../cli/commands/ui.js';

const { startUiHttpServerMock } = vi.hoisted(() => ({
  startUiHttpServerMock: vi.fn(async (options: { host: string; port: number }) => ({
    server: {} as never,
    registry: {} as never,
    rootPath: '/tmp/projects',
    staticRoot: '/tmp/static',
    refreshProjects: async () => [],
    host: options.host,
    port: options.port === 0 ? 43173 : options.port,
    url: `http://${options.host}:${options.port === 0 ? 43173 : options.port}`,
    close: async () => undefined
  }))
}));

vi.mock('../../ui/http/server.js', () => ({
  startUiHttpServer: startUiHttpServerMock
}));

describe('ui command', () => {
  afterEach(async () => {
    startUiHttpServerMock.mockClear();
  });

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

  it('starts the ui server and renders the access summary', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const handle = await startUiServer({
      root: '/tmp/projects',
      host: '127.0.0.1',
      port: '0',
      staticRoot: '/tmp/static'
    });

    const output = consoleSpy.mock.calls.flat().map(String).join('\n');
    expect(startUiHttpServerMock).toHaveBeenCalledWith({
      rootPath: '/tmp/projects',
      host: '127.0.0.1',
      port: 0,
      staticRoot: '/tmp/static'
    });
    expect(output).toContain('Web UI Ready');
    expect(output).toContain('root: /tmp/projects');
    expect(output).toContain('host: 127.0.0.1');
    expect(output).toContain(`url: ${handle.url}`);

    await handle.close();
    consoleSpy.mockRestore();
  });
});
