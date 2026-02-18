const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { runSpecPipeline, _parseSpecTargets } = require('../../../lib/commands/spec-pipeline');

describe('spec-pipeline command', () => {
  let tempDir;
  let originalLog;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-spec-pipeline-'));
    await fs.ensureDir(path.join(tempDir, '.kiro', 'specs', '110-01-pipeline-test'));
    await fs.ensureDir(path.join(tempDir, '.kiro', 'specs', '110-02-pipeline-test'));

    originalLog = console.log;
    console.log = jest.fn();
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('runs full stage flow successfully and writes output', async () => {
    const adapters = {
      requirements: jest.fn(async () => ({ success: true })),
      design: jest.fn(async () => ({ success: true })),
      tasks: jest.fn(async () => ({ success: true })),
      gate: jest.fn(async () => ({ success: true }))
    };

    const result = await runSpecPipeline({
      spec: '110-01-pipeline-test',
      json: true,
      out: 'reports/pipeline-result.json',
      continueOnWarning: true
    }, {
      projectPath: tempDir,
      adapters
    });

    expect(result.status).toBe('completed');
    expect(result.stage_results).toHaveLength(4);
    expect(adapters.requirements).toHaveBeenCalled();
    expect(adapters.gate).toHaveBeenCalled();

    const outPath = path.join(tempDir, 'reports', 'pipeline-result.json');
    expect(await fs.pathExists(outPath)).toBe(true);
  });

  test('supports resume from latest unfinished stage', async () => {
    let firstDesignRun = true;

    const adapters = {
      requirements: jest.fn(async () => ({ success: true })),
      design: jest.fn(async () => {
        if (firstDesignRun) {
          firstDesignRun = false;
          return { success: false, error: 'design failed once' };
        }

        return { success: true };
      }),
      tasks: jest.fn(async () => ({ success: true })),
      gate: jest.fn(async () => ({ success: true }))
    };

    const firstRun = await runSpecPipeline({
      spec: '110-01-pipeline-test',
      json: true
    }, {
      projectPath: tempDir,
      adapters
    });

    expect(firstRun.status).toBe('failed');
    expect(firstRun.failure.stage).toBe('design');

    const resumedRun = await runSpecPipeline({
      spec: '110-01-pipeline-test',
      resume: true,
      continueOnWarning: true,
      json: true
    }, {
      projectPath: tempDir,
      adapters
    });

    expect(resumedRun.status).toBe('completed');
    expect(resumedRun.run_id).toBe(firstRun.run_id);
    expect(resumedRun.stage_results.find(item => item.name === 'requirements').status).toBe('skipped');
  });

  test('propagates downstream stage failure with structured reason', async () => {
    const adapters = {
      requirements: jest.fn(async () => ({ success: true })),
      design: jest.fn(async () => ({ success: true })),
      tasks: jest.fn(async () => ({ success: true })),
      gate: jest.fn(async () => ({ success: false, error: 'gate rejected' }))
    };

    const result = await runSpecPipeline({
      spec: '110-01-pipeline-test',
      json: true
    }, {
      projectPath: tempDir,
      adapters
    });

    expect(result.status).toBe('failed');
    expect(result.failure.stage).toBe('gate');
    expect(result.failure.error).toContain('gate rejected');
  });

  test('defaults to orchestrate mode for multi-spec targets', async () => {
    const runOrchestration = jest.fn(async () => ({
      status: 'completed',
      totalSpecs: 2,
      completedSpecs: 2,
      failedSpecs: 0
    }));

    const result = await runSpecPipeline({
      specs: '110-01-pipeline-test,110-02-pipeline-test',
      json: true,
      maxParallel: 4
    }, {
      projectPath: tempDir,
      runOrchestration
    });

    expect(runOrchestration).toHaveBeenCalledWith(expect.objectContaining({
      specs: '110-01-pipeline-test,110-02-pipeline-test',
      maxParallel: 4,
      silent: true
    }), expect.any(Object));

    expect(result.mode).toBe('orchestrate');
    expect(result.status).toBe('completed');
    expect(result.spec_ids).toEqual(['110-01-pipeline-test', '110-02-pipeline-test']);
  });

  test('parses --spec and --specs into de-duplicated targets', () => {
    const targets = _parseSpecTargets({
      spec: '110-01-pipeline-test',
      specs: '110-01-pipeline-test, 110-02-pipeline-test , '
    });

    expect(targets).toEqual(['110-01-pipeline-test', '110-02-pipeline-test']);
  });
});
