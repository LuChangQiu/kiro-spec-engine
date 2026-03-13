const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const {
  REQUIRED_GITIGNORE_RULES,
  auditCollabGovernance
} = require('../../../lib/workspace/collab-governance-audit');

function buildRunGitMock(responses) {
  return (_projectRoot, args) => {
    const key = Array.isArray(args) ? args.join(' ') : `${args || ''}`;
    if (Object.prototype.hasOwnProperty.call(responses, key)) {
      const value = responses[key];
      return typeof value === 'function' ? value() : value;
    }
    return {
      status: 0,
      stdout: '',
      stderr: ''
    };
  };
}

describe('collab-governance-audit', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-collab-governance-audit-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('reports missing ignore rules and tracked runtime files', async () => {
    await fs.ensureDir(path.join(tempDir, '.sce', 'steering'));
    await fs.writeFile(path.join(tempDir, '.gitignore'), '.sce/steering/CURRENT_CONTEXT.md\n', 'utf8');

    const report = await auditCollabGovernance(tempDir, {}, {
      runGit: buildRunGitMock({
        'rev-parse --is-inside-work-tree': { status: 0, stdout: 'true\n', stderr: '' },
        'ls-files': { status: 0, stdout: '.sce/steering/CURRENT_CONTEXT.md\n', stderr: '' },
        'status --porcelain': { status: 0, stdout: '', stderr: '' },
        'remote -v': { status: 0, stdout: '', stderr: '' },
        'rev-parse --abbrev-ref HEAD': { status: 0, stdout: 'main\n', stderr: '' }
      })
    });

    expect(report.passed).toBe(false);
    expect(report.gitignore.missing_rules).toContain('.sce/config/coordination-log.json');
    expect(report.runtime_tracking.tracked_runtime_files).toContain('.sce/steering/CURRENT_CONTEXT.md');
    expect(report.violations).toContain('runtime/personal state tracked by git: .sce/steering/CURRENT_CONTEXT.md');
  });

  test('reports legacy references and warns when multi-agent config is referenced but missing', async () => {
    await fs.ensureDir(path.join(tempDir, 'docs'));
    await fs.writeFile(path.join(tempDir, 'docs', 'guide.md'), [
      'Use .sce/config/multi-agent.json to seed collaboration.',
      'Do not keep .kiro-workspaces around.'
    ].join('\n'), 'utf8');
    await fs.writeFile(
      path.join(tempDir, '.gitignore'),
      `${REQUIRED_GITIGNORE_RULES.map((item) => item.rule).join('\n')}\n`,
      'utf8'
    );

    const report = await auditCollabGovernance(tempDir, {}, {
      runGit: buildRunGitMock({
        'rev-parse --is-inside-work-tree': { status: 1, stdout: 'false\n', stderr: 'not a git repo' }
      })
    });

    expect(report.passed).toBe(false);
    expect(report.legacy_references.matches).toHaveLength(1);
    expect(report.violations).toContain('legacy .kiro reference: docs/guide.md:2');
    expect(report.multi_agent.warnings).toContain(
      'multi-agent config is referenced in active docs/code but project config is not seeded'
    );
  });

  test('passes with aligned gitignore, valid multi-agent config, and clean steering boundary', async () => {
    await fs.ensureDir(path.join(tempDir, '.sce', 'config'));
    await fs.ensureDir(path.join(tempDir, '.sce', 'steering', 'compiled'));
    await fs.writeFile(
      path.join(tempDir, '.gitignore'),
      `${REQUIRED_GITIGNORE_RULES.map((item) => item.rule).join('\n')}\n`,
      'utf8'
    );
    await fs.writeJson(path.join(tempDir, '.sce', 'config', 'multi-agent.json'), {
      enabled: false,
      heartbeatIntervalMs: 60000,
      heartbeatTimeoutMs: 180000,
      coordinatorEnabled: false,
      maxRetries: 5,
      retryBaseDelayMs: 100
    }, { spaces: 2 });
    await fs.writeFile(path.join(tempDir, '.sce', 'steering', 'CORE_PRINCIPLES.md'), '# core\n', 'utf8');
    await fs.writeFile(path.join(tempDir, '.sce', 'steering', 'ENVIRONMENT.md'), '# env\n', 'utf8');
    await fs.writeFile(path.join(tempDir, '.sce', 'steering', 'CURRENT_CONTEXT.md'), '# current\n', 'utf8');
    await fs.writeFile(path.join(tempDir, '.sce', 'steering', 'RULES_GUIDE.md'), '# rules\n', 'utf8');
    await fs.writeFile(path.join(tempDir, '.sce', 'steering', 'manifest.yaml'), 'schema_version: 1.0\n', 'utf8');

    const report = await auditCollabGovernance(tempDir, {}, {
      runGit: buildRunGitMock({
        'rev-parse --is-inside-work-tree': { status: 0, stdout: 'true\n', stderr: '' },
        'ls-files': { status: 0, stdout: '.gitignore\n.sce/config/multi-agent.json\n', stderr: '' },
        'status --porcelain': { status: 0, stdout: '', stderr: '' },
        'remote -v': { status: 0, stdout: '', stderr: '' },
        'rev-parse --abbrev-ref HEAD': { status: 0, stdout: 'main\n', stderr: '' }
      })
    });

    expect(report.passed).toBe(true);
    expect(report.reason).toBe('warnings');
    expect(report.gitignore.missing_rules).toEqual([]);
    expect(report.multi_agent.valid).toBe(true);
    expect(report.steering_boundary.passed).toBe(true);
  });

  test('flags steering boundary drift', async () => {
    await fs.ensureDir(path.join(tempDir, '.sce', 'config'));
    await fs.ensureDir(path.join(tempDir, '.sce', 'steering'));
    await fs.writeFile(
      path.join(tempDir, '.gitignore'),
      `${REQUIRED_GITIGNORE_RULES.map((item) => item.rule).join('\n')}\n`,
      'utf8'
    );
    await fs.writeJson(path.join(tempDir, '.sce', 'config', 'multi-agent.json'), {
      enabled: false
    }, { spaces: 2 });
    await fs.writeFile(path.join(tempDir, '.sce', 'steering', 'CORE_PRINCIPLES.md'), '# core\n', 'utf8');
    await fs.writeFile(path.join(tempDir, '.sce', 'steering', 'analysis-notes.md'), '# drift\n', 'utf8');

    const report = await auditCollabGovernance(tempDir, {}, {
      runGit: buildRunGitMock({
        'rev-parse --is-inside-work-tree': { status: 0, stdout: 'true\n', stderr: '' },
        'ls-files': { status: 0, stdout: '.gitignore\n.sce/config/multi-agent.json\n', stderr: '' },
        'status --porcelain': { status: 0, stdout: '', stderr: '' },
        'remote -v': { status: 0, stdout: '', stderr: '' },
        'rev-parse --abbrev-ref HEAD': { status: 0, stdout: 'main\n', stderr: '' }
      })
    });

    expect(report.passed).toBe(false);
    expect(report.steering_boundary.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'analysis-notes.md',
          path: '.sce/steering/analysis-notes.md'
        })
      ])
    );
  });
});
