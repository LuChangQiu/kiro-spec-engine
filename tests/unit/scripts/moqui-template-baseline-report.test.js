const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function buildContract({
  templateName,
  provides,
  businessRules = true,
  decisionLogic = true
}) {
  return {
    apiVersion: 'sce.scene.package/v0.1',
    kind: 'scene-template',
    metadata: {
      group: 'sce.scene',
      name: templateName,
      version: '0.1.0',
      summary: `Fixture template for ${templateName}`
    },
    compatibility: {
      kse_version: '>=1.24.0',
      scene_api_version: 'sce.scene/v0.2',
      moqui_model_version: '3.x',
      adapter_api_version: 'v1'
    },
    capabilities: {
      provides: Array.isArray(provides) ? provides : [],
      requires: ['binding:http']
    },
    capability_contract: {
      bindings: [
        {
          ref: 'scene.binding.read',
          type: 'query',
          intent: 'Read scene data'
        }
      ]
    },
    ontology_model: {
      entities: [
        { id: 'Order', type: 'aggregate' },
        { id: 'OrderItem', type: 'entity' }
      ],
      relations: [
        { source: 'Order', target: 'OrderItem', type: 'contains' }
      ]
    },
    governance_contract: {
      business_rules: businessRules
        ? [{ id: 'BR-order-check', entity_ref: 'Order', status: 'active', passed: true }]
        : [],
      decision_logic: decisionLogic
        ? [{ id: 'DEC-order-routing', status: 'resolved', automated: true }]
        : []
    }
  };
}

async function writeTemplate(templateRoot, templateId, contract) {
  const dirPath = path.join(templateRoot, templateId);
  await fs.ensureDir(dirPath);
  await fs.writeJson(path.join(dirPath, 'scene-package.json'), contract, { spaces: 2 });
}

describe('moqui-template-baseline-report script', () => {
  let tempDir;
  let templateRoot;
  let outFile;
  let markdownFile;
  let scriptPath;
  let projectRoot;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-moqui-baseline-'));
    templateRoot = path.join(tempDir, '.sce', 'templates', 'scene-packages');
    outFile = path.join(tempDir, 'baseline.json');
    markdownFile = path.join(tempDir, 'baseline.md');
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'moqui-template-baseline-report.js');
    await fs.ensureDir(templateRoot);
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('default selector includes scene/suite templates without include-all', async () => {
    await writeTemplate(
      templateRoot,
      'sce.scene--scene-runbook-export--0.1.0',
      buildContract({
        templateName: 'scene-runbook-export-template',
        provides: ['scene-runbook-export']
      })
    );
    await writeTemplate(
      templateRoot,
      'finance-ledger-sync-template',
      buildContract({
        templateName: 'finance-ledger-sync-template',
        provides: ['finance-ledger-sync']
      })
    );

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--template-dir',
        templateRoot,
        '--out',
        outFile,
        '--markdown-out',
        markdownFile,
        '--json'
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.filter.match).toContain('runbook');
    expect(payload.summary.total_templates).toBe(2);
    expect(payload.summary.scoped_templates).toBe(1);
    expect(payload.templates.map((item) => item.template_id)).toEqual([
      'sce.scene--scene-runbook-export--0.1.0'
    ]);
    expect(payload.summary.scope_breakdown).toEqual(expect.objectContaining({
      scene_orchestration: 1
    }));
  });

  test('emits coverage matrix and gap frequency for baseline triage', async () => {
    await writeTemplate(
      templateRoot,
      'sce.scene--moqui-order-fulfillment--0.1.0',
      buildContract({
        templateName: 'moqui-order-fulfillment-template',
        provides: ['moqui-order-fulfillment'],
        businessRules: true,
        decisionLogic: true
      })
    );
    await writeTemplate(
      templateRoot,
      'sce.scene--suite-action-pack-followup--0.1.0',
      buildContract({
        templateName: 'suite-action-pack-followup-template',
        provides: ['scene-action-pack-followup'],
        businessRules: false,
        decisionLogic: false
      })
    );

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--template-dir',
        templateRoot,
        '--out',
        outFile,
        '--markdown-out',
        markdownFile,
        '--include-all',
        '--json'
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.scoped_templates).toBe(2);
    expect(payload.summary.coverage_matrix).toEqual(expect.objectContaining({
      total_templates: 2,
      entity_coverage: expect.objectContaining({ count: 2 }),
      relation_coverage: expect.objectContaining({ count: 2 }),
      business_rule_coverage: expect.objectContaining({ count: 1 }),
      decision_coverage: expect.objectContaining({ count: 1 })
    }));
    expect(payload.summary.gap_frequency).toEqual(expect.arrayContaining([
      expect.objectContaining({ gap: 'business rules missing', count: 1 }),
      expect.objectContaining({ gap: 'decision logic missing', count: 1 })
    ]));
    expect(await fs.pathExists(markdownFile)).toBe(true);
    const markdown = await fs.readFile(markdownFile, 'utf8');
    expect(markdown).toContain('## Capability Matrix');
    expect(markdown).toContain('## Top Gaps');
  });

  test('emits coverage matrix deltas when compare-with is provided', async () => {
    const compareFile = path.join(tempDir, 'baseline-previous.json');

    await fs.writeJson(compareFile, {
      generated_at: '2026-02-16T00:00:00.000Z',
      template_root: '.sce/templates/scene-packages',
      summary: {
        scoped_templates: 2,
        avg_score: 90,
        valid_rate_percent: 100,
        baseline_passed: 1,
        baseline_failed: 1,
        portfolio_passed: false,
        coverage_matrix: {
          graph_valid: { count: 2, rate_percent: 100 },
          score_passed: { count: 2, rate_percent: 100 },
          entity_coverage: { count: 2, rate_percent: 100 },
          relation_coverage: { count: 2, rate_percent: 100 },
          business_rule_coverage: { count: 1, rate_percent: 50 },
          business_rule_closed: { count: 1, rate_percent: 50, among_covered_rate_percent: 100 },
          decision_coverage: { count: 1, rate_percent: 50 },
          decision_closed: { count: 1, rate_percent: 50, among_covered_rate_percent: 100 },
          baseline_passed: { count: 1, rate_percent: 50 }
        }
      },
      templates: [
        {
          template_id: 'sce.scene--moqui-order-fulfillment--0.1.0',
          baseline: { flags: { baseline_passed: true } }
        },
        {
          template_id: 'sce.scene--suite-action-pack-followup--0.1.0',
          baseline: { flags: { baseline_passed: false } }
        }
      ]
    }, { spaces: 2 });

    await writeTemplate(
      templateRoot,
      'sce.scene--moqui-order-fulfillment--0.1.0',
      buildContract({
        templateName: 'moqui-order-fulfillment-template',
        provides: ['moqui-order-fulfillment'],
        businessRules: true,
        decisionLogic: true
      })
    );
    await writeTemplate(
      templateRoot,
      'sce.scene--suite-action-pack-followup--0.1.0',
      buildContract({
        templateName: 'suite-action-pack-followup-template',
        provides: ['scene-action-pack-followup'],
        businessRules: true,
        decisionLogic: true
      })
    );

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--template-dir',
        templateRoot,
        '--out',
        outFile,
        '--markdown-out',
        markdownFile,
        '--include-all',
        '--compare-with',
        compareFile,
        '--json'
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.compare).toEqual(expect.objectContaining({
      coverage_matrix_deltas: expect.objectContaining({
        business_rule_closed: expect.objectContaining({
          rate_percent: 50
        }),
        decision_closed: expect.objectContaining({
          rate_percent: 50
        })
      }),
      coverage_matrix_regressions: []
    }));
    const markdown = await fs.readFile(markdownFile, 'utf8');
    expect(markdown).toContain('Delta business-rule closed: 50%');
    expect(markdown).toContain('Delta decision closed: 50%');
    expect(markdown).toContain('Matrix regressions: none');
  });

  test('emits coverage matrix regressions for negative deltas', async () => {
    const compareFile = path.join(tempDir, 'baseline-previous-regression.json');

    await fs.writeJson(compareFile, {
      generated_at: '2026-02-16T00:00:00.000Z',
      template_root: '.sce/templates/scene-packages',
      summary: {
        scoped_templates: 2,
        avg_score: 92,
        valid_rate_percent: 100,
        baseline_passed: 2,
        baseline_failed: 0,
        portfolio_passed: true,
        coverage_matrix: {
          graph_valid: { count: 2, rate_percent: 100 },
          score_passed: { count: 2, rate_percent: 100 },
          entity_coverage: { count: 2, rate_percent: 100 },
          relation_coverage: { count: 2, rate_percent: 100 },
          business_rule_coverage: { count: 2, rate_percent: 100 },
          business_rule_closed: { count: 2, rate_percent: 100, among_covered_rate_percent: 100 },
          decision_coverage: { count: 2, rate_percent: 100 },
          decision_closed: { count: 2, rate_percent: 100, among_covered_rate_percent: 100 },
          baseline_passed: { count: 2, rate_percent: 100 }
        }
      },
      templates: [
        {
          template_id: 'sce.scene--moqui-order-fulfillment--0.1.0',
          baseline: { flags: { baseline_passed: true } }
        },
        {
          template_id: 'sce.scene--suite-action-pack-followup--0.1.0',
          baseline: { flags: { baseline_passed: true } }
        }
      ]
    }, { spaces: 2 });

    await writeTemplate(
      templateRoot,
      'sce.scene--moqui-order-fulfillment--0.1.0',
      buildContract({
        templateName: 'moqui-order-fulfillment-template',
        provides: ['moqui-order-fulfillment'],
        businessRules: true,
        decisionLogic: true
      })
    );
    await writeTemplate(
      templateRoot,
      'sce.scene--suite-action-pack-followup--0.1.0',
      buildContract({
        templateName: 'suite-action-pack-followup-template',
        provides: ['scene-action-pack-followup'],
        businessRules: false,
        decisionLogic: false
      })
    );

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--template-dir',
        templateRoot,
        '--out',
        outFile,
        '--markdown-out',
        markdownFile,
        '--include-all',
        '--compare-with',
        compareFile,
        '--json'
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.compare.coverage_matrix_regressions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metric: 'business_rule_closed',
        delta_rate_percent: -50
      }),
      expect.objectContaining({
        metric: 'decision_closed',
        delta_rate_percent: -50
      })
    ]));
    const markdown = await fs.readFile(markdownFile, 'utf8');
    expect(markdown).toContain('Matrix regressions:');
    expect(markdown).toContain('business-rule-closed:-50%');
    expect(markdown).toContain('decision-closed:-50%');
  });
});
