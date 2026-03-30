import { describe, expect, it } from 'vitest';
import { createPlanCommand } from '../../cli/commands/plan.js';

describe('plan command options', () => {
  it('supports disabling superpowers from the CLI', () => {
    const command = createPlanCommand();

    command.parseOptions(['--no-superpowers']);

    expect(command.opts().superpowers).toBe(false);
  });
});
