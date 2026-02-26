const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const TemplateManager = require('../../../lib/templates/template-manager');
const { ValidationError } = require('../../../lib/templates/template-error');

describe('TemplateManager', () => {
  let tempDir;
  let cacheDir;
  let manager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-template-manager-'));
    cacheDir = path.join(tempDir, 'cache');
    manager = new TemplateManager({ cacheDir });

    const officialDir = path.join(cacheDir, 'official');
    await fs.ensureDir(officialDir);

    await fs.writeJson(path.join(officialDir, 'template-registry.json'), {
      version: '2.0.0',
      templates: [
        {
          id: 'web/basic-spec',
          name: 'Basic Spec Scaffold',
          template_type: 'spec-scaffold',
          category: 'web-features',
          description: 'Scaffold template',
          difficulty: 'beginner',
          tags: ['spec'],
          applicable_scenarios: ['feature-development'],
          files: ['requirements.md', 'design.md', 'tasks.md'],
          min_sce_version: '3.3.0',
          risk_level: 'low',
          rollback_contract: {
            supported: true,
            strategy: 'git-revert'
          }
        },
        {
          id: 'moqui/order-capability',
          name: 'Order Capability Template',
          template_type: 'capability-template',
          category: 'moqui',
          description: 'Capability template',
          difficulty: 'advanced',
          tags: ['moqui', 'order'],
          applicable_scenarios: ['order-management'],
          files: ['capability.yaml'],
          min_sce_version: '3.3.0',
          max_sce_version: '3.3.99',
          ontology_scope: {
            domains: ['erp'],
            entities: ['OrderHeader']
          },
          risk_level: 'medium',
          rollback_contract: {
            supported: true,
            strategy: 'compensating-action'
          }
        },
        {
          id: 'moqui/runtime-playbook',
          name: 'Runtime Playbook',
          template_type: 'runtime-playbook',
          category: 'moqui',
          description: 'Runtime operations playbook',
          difficulty: 'intermediate',
          tags: ['runtime', 'playbook'],
          applicable_scenarios: ['ops'],
          files: ['runbook.md'],
          min_sce_version: '3.4.0',
          risk_level: 'high',
          rollback_contract: {
            supported: true,
            strategy: 'runbook-revert'
          }
        }
      ]
    }, { spaces: 2 });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('uses .sce template cache path by default', () => {
    const defaultManager = new TemplateManager();
    expect(defaultManager.cacheDir).toContain(path.join('.sce', 'templates'));
  });

  test('lists templates with type and compatibility filters', async () => {
    const allTemplates = await manager.listTemplates();
    expect(allTemplates).toHaveLength(3);

    const capabilityOnly = await manager.listTemplates({ templateType: 'capability-template' });
    expect(capabilityOnly.map((entry) => entry.id)).toEqual(['moqui/order-capability']);

    const compatibleWith3313 = await manager.listTemplates({ compatibleWith: '3.3.13' });
    expect(compatibleWith3313.map((entry) => entry.id).sort()).toEqual([
      'moqui/order-capability',
      'web/basic-spec'
    ]);

    const highRisk = await manager.listTemplates({ riskLevel: 'high' });
    expect(highRisk.map((entry) => entry.id)).toEqual(['moqui/runtime-playbook']);
  });

  test('searches templates with source and typed filters', async () => {
    const runtimeResults = await manager.searchTemplates('runtime', {
      source: 'official',
      templateType: 'runtime-playbook',
      compatibleWith: '3.4.2'
    });

    expect(runtimeResults).toHaveLength(1);
    expect(runtimeResults[0].id).toBe('moqui/runtime-playbook');
  });

  test('rejects invalid compatibility semver filters', async () => {
    await expect(manager.listTemplates({ compatibleWith: 'latest' }))
      .rejects
      .toThrow(ValidationError);

    await expect(manager.searchTemplates('moqui', { compatibleWith: 'dev' }))
      .rejects
      .toThrow(ValidationError);
  });
});
