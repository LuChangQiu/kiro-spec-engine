const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  runSpecGate,
  generateSpecGatePolicyTemplate,
  _parseSpecTargets
} = require('../../../lib/commands/spec-gate');

describe('spec-gate command', () => {
  let tempDir;
  let originalLog;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-spec-gate-'));
    await fs.ensureDir(path.join(tempDir, '.kiro', 'config'));

    const specPath = path.join(tempDir, '.kiro', 'specs', '111-01-gate-contract-test');
    const specPath2 = path.join(tempDir, '.kiro', 'specs', '111-02-gate-contract-test');
    await fs.ensureDir(specPath);
    await fs.ensureDir(specPath2);

    await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements\n', 'utf8');
    await fs.writeFile(path.join(specPath, 'design.md'), '# Design\n## Requirement Mapping\n', 'utf8');
    await fs.writeFile(path.join(specPath, 'tasks.md'), '- [ ] 1. Test task\n  - **Requirement**: Requirement 1\n  - **Design**: Design 1\n  - **Validation**: Acceptance Criteria\n', 'utf8');
    await fs.writeFile(path.join(specPath2, 'requirements.md'), '# Requirements\n', 'utf8');
    await fs.writeFile(path.join(specPath2, 'design.md'), '# Design\n## Requirement Mapping\n', 'utf8');
    await fs.writeFile(path.join(specPath2, 'tasks.md'), '- [ ] 1. Test task\n  - **Requirement**: Requirement 1\n  - **Design**: Design 1\n  - **Validation**: Acceptance Criteria\n', 'utf8');

    originalLog = console.log;
    console.log = jest.fn();
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('returns standard json contract and writes report file', async () => {
    const result = await runSpecGate({
      spec: '111-01-gate-contract-test',
      json: true,
      out: 'reports/spec-gate-result.json'
    }, {
      projectPath: tempDir
    });

    expect(result).toHaveProperty('spec_id', '111-01-gate-contract-test');
    expect(result).toHaveProperty('run_id');
    expect(result).toHaveProperty('decision');
    expect(result).toHaveProperty('score');
    expect(Array.isArray(result.failed_checks)).toBe(true);
    expect(Array.isArray(result.next_actions)).toBe(true);

    const outPath = path.join(tempDir, 'reports', 'spec-gate-result.json');
    expect(await fs.pathExists(outPath)).toBe(true);
  });

  test('generates policy template file', async () => {
    const outputPath = path.join(tempDir, 'policy', 'spec-gate-policy.json');

    const response = await generateSpecGatePolicyTemplate({
      out: outputPath,
      silent: true
    }, {
      projectPath: tempDir
    });

    expect(response.success).toBe(true);
    expect(await fs.pathExists(outputPath)).toBe(true);

    const content = await fs.readJson(outputPath);
    expect(content).toHaveProperty('rules.mandatory');
    expect(content).toHaveProperty('thresholds.go');
  });

  test('defaults to orchestrate mode for multi-spec targets', async () => {
    const runOrchestration = jest.fn(async () => ({
      status: 'completed',
      totalSpecs: 2,
      completedSpecs: 2,
      failedSpecs: 0
    }));

    const result = await runSpecGate({
      specs: '111-01-gate-contract-test,111-02-gate-contract-test',
      json: true,
      maxParallel: 3
    }, {
      projectPath: tempDir,
      runOrchestration
    });

    expect(runOrchestration).toHaveBeenCalledWith(expect.objectContaining({
      specs: '111-01-gate-contract-test,111-02-gate-contract-test',
      maxParallel: 3,
      silent: true
    }), expect.any(Object));

    expect(result.mode).toBe('orchestrate');
    expect(result.status).toBe('completed');
    expect(result.spec_ids).toEqual(['111-01-gate-contract-test', '111-02-gate-contract-test']);
  });

  test('parses --spec and --specs into de-duplicated targets', () => {
    const targets = _parseSpecTargets({
      spec: '111-01-gate-contract-test',
      specs: '111-01-gate-contract-test, 111-02-gate-contract-test , '
    });

    expect(targets).toEqual(['111-01-gate-contract-test', '111-02-gate-contract-test']);
  });
});
