const { printCloseLoopControllerSummary } = require('../../../lib/auto/controller-output');

describe('auto controller output helper', () => {
  test('prints controller summary lines', () => {
    const logs = [];
    const original = console.log;
    console.log = (line) => logs.push(line);
    const chalk = { blue: (x) => x, gray: (x) => x };
    try {
      printCloseLoopControllerSummary(chalk, {
        status: 'completed',
        cycles_performed: 1,
        max_cycles: 2,
        processed_goals: 1,
        completed_goals: 1,
        failed_goals: 0,
        pending_goals: 0,
        dedupe_enabled: false
      });
    } finally {
      console.log = original;
    }
    expect(logs[0]).toContain('Autonomous close-loop controller summary');
  });
});
