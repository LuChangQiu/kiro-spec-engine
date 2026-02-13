const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  parseSpecTargets,
  runMultiSpecViaOrchestrate
} = require('../../../lib/spec/multi-spec-orchestrate');

describe('multi-spec-orchestrate helper', () => {
  let tempDir;
  let originalLog;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kse-multi-spec-helper-'));
    originalLog = console.log;
    console.log = jest.fn();
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('parses single and list spec inputs with deduplication', () => {
    const result = parseSpecTargets({
      spec: 'alpha',
      specs: 'alpha, beta , gamma, '
    });

    expect(result).toEqual(['alpha', 'beta', 'gamma']);
  });

  test('runs orchestrate mode and persists output file', async () => {
    const runOrchestration = jest.fn(async () => ({
      status: 'completed',
      totalSpecs: 2
    }));

    const response = await runMultiSpecViaOrchestrate({
      specTargets: ['alpha', 'beta'],
      projectPath: tempDir,
      commandOptions: {
        json: true,
        out: 'reports/multi-result.json',
        maxParallel: 3
      },
      runOrchestration,
      commandLabel: 'Test command',
      nextActionLabel: 'Defaulted to orchestrate.'
    });

    expect(runOrchestration).toHaveBeenCalledWith(expect.objectContaining({
      specs: 'alpha,beta',
      maxParallel: 3,
      silent: true
    }), expect.any(Object));
    expect(response.mode).toBe('orchestrate');

    const outPath = path.join(tempDir, 'reports', 'multi-result.json');
    expect(await fs.pathExists(outPath)).toBe(true);
  });
});

