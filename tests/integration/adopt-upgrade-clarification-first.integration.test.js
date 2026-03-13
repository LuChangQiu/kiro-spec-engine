const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { runCliWithRetry } = require('./cli-runner');

const {
  CLARIFICATION_FIRST_CORE_PRINCIPLE_HEADING,
  NO_BLIND_FIX_CORE_PRINCIPLE_HEADING,
  STEERING_CHANGE_EVALUATION_CORE_PRINCIPLE_HEADING,
  BACKEND_API_PRECEDENCE_CORE_PRINCIPLE_HEADING
} = require('../../lib/workspace/takeover-baseline');
const packageJson = require('../../package.json');

function runCli(args, options = {}) {
  return runCliWithRetry(args, {
    cwd: options.cwd || process.cwd(),
    timeoutMs: options.timeoutMs || 30000,
    skipSteeringCheck: options.skipSteeringCheck !== false,
    maxTransientRetries: options.maxTransientRetries || 1,
    env: {
      CI: '1',
      ...options.env
    }
  });
}

jest.setTimeout(45000);

describe('adopt/upgrade clarification-first integration', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-adopt-upgrade-cli-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('adopt writes clarification-first core principle into project steering baseline', async () => {
    await fs.writeJson(path.join(tempDir, 'package.json'), {
      name: 'clarification-first-adopt-fixture',
      version: '1.0.0'
    }, { spaces: 2 });

    const result = await runCli(['adopt'], { cwd: tempDir });

    expect(result.exitCode).toBe(0);
    expect(await fs.pathExists(path.join(tempDir, '.sce', 'steering', 'CORE_PRINCIPLES.md'))).toBe(true);

    const corePrinciples = await fs.readFile(path.join(tempDir, '.sce', 'steering', 'CORE_PRINCIPLES.md'), 'utf8');
    expect(corePrinciples).toContain(CLARIFICATION_FIRST_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples).toContain(NO_BLIND_FIX_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples).toContain(STEERING_CHANGE_EVALUATION_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples).toContain(BACKEND_API_PRECEDENCE_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples).toContain('不允许按项目例外绕过');
  });

  test('startup auto-takeover repairs clarification-first rule for older adopted project', async () => {
    await fs.ensureDir(path.join(tempDir, '.sce', 'steering'));
    await fs.writeJson(path.join(tempDir, '.sce', 'version.json'), {
      'sce-version': '3.0.0',
      'template-version': '3.0.0',
      created: '2026-01-01T00:00:00.000Z',
      'last-upgraded': '2026-01-01T00:00:00.000Z',
      'upgrade-history': []
    }, { spaces: 2 });
    await fs.writeFile(
      path.join(tempDir, '.sce', 'steering', 'CORE_PRINCIPLES.md'),
      '# 核心开发原则（基准规则）\n\n## 1. Existing Rule\n\n- keep durable rules only.\n',
      'utf8'
    );

    const statusResult = await runCli(['status'], { cwd: tempDir });
    expect(statusResult.exitCode).toBe(0);

    const corePrinciples = await fs.readFile(path.join(tempDir, '.sce', 'steering', 'CORE_PRINCIPLES.md'), 'utf8');
    expect(corePrinciples).toContain('## 1. Existing Rule');
    expect(corePrinciples).toContain(CLARIFICATION_FIRST_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples).toContain(NO_BLIND_FIX_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples).toContain(STEERING_CHANGE_EVALUATION_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples).toContain(BACKEND_API_PRECEDENCE_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples.match(new RegExp(CLARIFICATION_FIRST_CORE_PRINCIPLE_HEADING, 'g'))).toHaveLength(1);
  });

  test('upgrade repairs clarification-first rule for existing adopted project', async () => {
    await fs.writeJson(path.join(tempDir, 'package.json'), {
      name: 'clarification-first-upgrade-fixture',
      version: '1.0.0'
    }, { spaces: 2 });

    const adoptResult = await runCli(['adopt'], { cwd: tempDir });
    expect(adoptResult.exitCode).toBe(0);

    const versionPath = path.join(tempDir, '.sce', 'version.json');
    const versionInfo = await fs.readJson(versionPath);
    versionInfo['sce-version'] = '1.0.0';
    versionInfo['template-version'] = '1.0.0';
    await fs.writeJson(versionPath, versionInfo, { spaces: 2 });

    await fs.writeFile(
      path.join(tempDir, '.sce', 'steering', 'CORE_PRINCIPLES.md'),
      '# 核心开发原则（基准规则）\n\n## 1. Existing Rule\n\n- keep durable rules only.\n',
      'utf8'
    );

    const upgradeResult = await runCli(['upgrade', '--auto', '--to', packageJson.version], {
      cwd: tempDir,
      timeoutMs: 45000
    });

    expect(upgradeResult.exitCode).toBe(0);

    const upgradedVersion = await fs.readJson(versionPath);
    expect(upgradedVersion['sce-version']).toBe(packageJson.version);

    const corePrinciples = await fs.readFile(path.join(tempDir, '.sce', 'steering', 'CORE_PRINCIPLES.md'), 'utf8');
    expect(corePrinciples).toContain('## 1. Existing Rule');
    expect(corePrinciples).toContain(CLARIFICATION_FIRST_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples).toContain(NO_BLIND_FIX_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples).toContain(STEERING_CHANGE_EVALUATION_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples).toContain(BACKEND_API_PRECEDENCE_CORE_PRINCIPLE_HEADING);
    expect(corePrinciples.match(new RegExp(CLARIFICATION_FIRST_CORE_PRINCIPLE_HEADING, 'g'))).toHaveLength(1);
  });
});
