'use strict';

const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  auditClarificationFirst,
  parseArgs
} = require('../../../scripts/clarification-first-audit');

async function seedProject(rootDir) {
  const files = {
    'scripts/interactive-dialogue-governance.js': [
      'function contextHasBusinessScope() {}',
      'function goalMentionsBusinessScope() {}',
      'const reason = "business scene/module/page/entity context is missing; clarify scope before fallback or execution";',
      'const q = "Which module/page/entity is affected first?";'
    ].join('\n'),
    'scripts/symbol-evidence-locate.js': [
      'const action = "clarify_business_scope";',
      'const advisory = "Clarify target module/page/entity and business constraints before deciding whether scoped writes are safe.";'
    ].join('\n'),
    'lib/workspace/takeover-baseline.js': [
      'const CLARIFICATION_FIRST_CORE_PRINCIPLE_HEADING = "## 11. 业务场景未知时必须先澄清，禁止直接彻底禁用";',
      'async function _reconcileCorePrinciplesBaseline() {}',
      '这条规则适用于所有接入 SCE 的项目、模式和交互面，不允许按项目例外绕过。'
    ].join('\n'),
    'docs/interactive-customization/dialogue-governance-policy-baseline.json': JSON.stringify({
      response_rules: [
        'clarify and narrow scope before using any fallback restriction; do not replace understanding with blanket disable'
      ],
      clarification_templates: [
        'Which entity or business rule is affected, and what constraint must stay intact?'
      ]
    }, null, 2),
    '.sce/steering/CORE_PRINCIPLES.md': [
      '## 11. 业务场景未知时必须先澄清，禁止直接彻底禁用',
      '这条规则适用于所有接入 SCE 的项目、模式和交互面，不允许按项目例外绕过。'
    ].join('\n'),
    'template/.sce/steering/CORE_PRINCIPLES.md': [
      '## 7. 业务场景未知时先澄清，不得直接彻底禁用',
      '这条规则适用于所有使用 SCE 的项目，不设项目级例外。'
    ].join('\n'),
    'README.md': 'When business scene/module/page/entity context is missing, SCE must route to clarification first; unknown business scope must not be turned into blanket disable.\n',
    'README.zh.md': '缺少业务场景/模块/页面/实体上下文时，SCE 必须先进入澄清，而不是把未知业务范围直接变成一刀切禁用\n',
    'docs/security-governance-default-baseline.md': [
      'Missing business scene/module/page/entity context must route to clarification first; unknown scope is never a valid reason for blanket disable.',
      'This clarification-first rule applies to every SCE-integrated project and surface with no project-specific exception.'
    ].join('\n'),
    'docs/starter-kit/README.md': [
      'This baseline applies to every onboarded project with no project-specific exception.',
      'missing business scope is handled through clarification, not blanket disable fallback.'
    ].join('\n'),
    'docs/command-reference.md': 'Missing business scene/module/page/entity context defaults to `clarify`; unknown scope must not be converted into blanket disable fallback.\n',
    'tests/unit/sample.test.js': 'expect(true).toBe(true);\n'
  };

  await Promise.all(Object.entries(files).map(async ([relativePath, content]) => {
    const target = path.join(rootDir, relativePath);
    await fs.ensureDir(path.dirname(target));
    await fs.writeFile(target, content, 'utf8');
  }));
}

describe('clarification-first-audit script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-clarification-first-'));
    await seedProject(tempDir);
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('parseArgs supports audit flags', () => {
    const parsed = parseArgs([
      '--project-path', tempDir,
      '--json',
      '--fail-on-violation',
      '--out', path.join(tempDir, 'report.json')
    ]);

    expect(parsed.projectPath).toBe(path.resolve(tempDir));
    expect(parsed.json).toBe(true);
    expect(parsed.failOnViolation).toBe(true);
    expect(parsed.out).toBe(path.resolve(path.join(tempDir, 'report.json')));
  });

  test('passes when clarification-first baseline is present', () => {
    const report = auditClarificationFirst({ projectPath: tempDir });

    expect(report.passed).toBe(true);
    expect(report.violation_count).toBe(0);
  });

  test('flags missing required snippets', async () => {
    await fs.writeFile(
      path.join(tempDir, 'README.md'),
      'SCE default governance behavior.\n',
      'utf8'
    );

    const report = auditClarificationFirst({ projectPath: tempDir });

    expect(report.passed).toBe(false);
    expect(report.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rule: 'missing_required_snippet',
        file: 'README.md'
      })
    ]));
  });

  test('flags legacy blanket-disable phrases outside allowed audit files', async () => {
    await fs.writeFile(
      path.join(tempDir, 'docs', 'legacy-note.md'),
      'No reliable symbol evidence found. Fallback to answer-only mode and block high-risk writes.\n',
      'utf8'
    );

    const report = auditClarificationFirst({ projectPath: tempDir });

    expect(report.passed).toBe(false);
    expect(report.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rule: 'prohibited_legacy_disable_phrase',
        file: 'docs/legacy-note.md'
      })
    ]));
  });
});
