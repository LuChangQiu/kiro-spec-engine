const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  runSpecDomainInitCommand,
  runSpecDomainRefreshCommand,
  runSpecDomainValidateCommand
} = require('../../../lib/commands/spec-domain');

describe('spec-domain command', () => {
  let tempDir;
  let originalLog;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-spec-domain-'));
    await fs.ensureDir(path.join(tempDir, '.sce', 'specs', '130-01-domain-command'));
    originalLog = console.log;
    console.log = jest.fn();
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('init creates missing artifacts', async () => {
    const result = await runSpecDomainInitCommand({
      spec: '130-01-domain-command',
      scene: 'scene.domain-command',
      json: true
    }, {
      projectPath: tempDir
    });

    expect(result.mode).toBe('spec-domain-init');
    expect(result.spec_id).toBe('130-01-domain-command');
    expect(result.created.domain_map).toBe(true);
    expect(result.created.scene_spec).toBe(true);
    expect(result.created.domain_chain).toBe(true);
  });

  test('validate fails for missing artifacts and passes after refresh', async () => {
    const failed = await runSpecDomainValidateCommand({
      spec: '130-01-domain-command',
      json: true
    }, {
      projectPath: tempDir
    });
    expect(failed.passed).toBe(false);

    await runSpecDomainRefreshCommand({
      spec: '130-01-domain-command',
      scene: 'scene.domain-command',
      json: true
    }, {
      projectPath: tempDir
    });

    const passed = await runSpecDomainValidateCommand({
      spec: '130-01-domain-command',
      json: true
    }, {
      projectPath: tempDir
    });
    expect(passed.passed).toBe(true);
    expect(passed.ratio).toBe(1);
  });

  test('validate throws with failOnError', async () => {
    await expect(runSpecDomainValidateCommand({
      spec: '130-01-domain-command',
      failOnError: true,
      json: true
    }, {
      projectPath: tempDir
    })).rejects.toThrow('spec domain validation failed');
  });
});
