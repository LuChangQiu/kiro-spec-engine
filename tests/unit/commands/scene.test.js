const path = require('path');

const {
  validateSourceOptions,
  validateRunMode,
  validateRunOptions,
  validateDoctorOptions,
  validateScaffoldOptions,
  validateEvalOptions,
  validateCatalogOptions,
  validateRouteOptions,
  validateRoutePolicyTemplateOptions,
  validateRoutePolicySuggestOptions,
  validateRoutePolicyRolloutOptions,
  validateScenePackageTemplateOptions,
  validateScenePackageValidateOptions,
  validateScenePackagePublishOptions,
  validateScenePackageInstantiateOptions,
  validateScenePackageRegistryOptions,
  validateScenePackageGateTemplateOptions,
  validateScenePackageGateOptions,
  normalizeEvalTaskSyncPolicy,
  resolveEvalTaskPriority,
  resolveSceneEvalConfigProfile,
  normalizeEvalProfileInferenceRules,
  buildRuntimeContext,
  parseDoctorFeedbackTemplate,
  runSceneValidateCommand,
  runSceneDoctorCommand,
  runSceneEvalCommand,
  runSceneEvalPolicyTemplateCommand,
  runSceneEvalConfigTemplateCommand,
  runSceneEvalProfileRulesTemplateCommand,
  runSceneRoutePolicyTemplateCommand,
  runSceneRoutePolicySuggestCommand,
  runSceneRoutePolicyRolloutCommand,
  runScenePackageTemplateCommand,
  runScenePackageValidateCommand,
  runScenePackagePublishCommand,
  runScenePackageInstantiateCommand,
  runScenePackageRegistryCommand,
  runScenePackageGateTemplateCommand,
  runScenePackageGateCommand,
  runSceneCatalogCommand,
  runSceneRouteCommand,
  runSceneScaffoldCommand,
  runSceneCommand,
  createTarBuffer,
  extractTarBuffer,
  bundlePackageTarball,
  buildRegistryTarballPath,
  buildTarballFilename,
  resolveLatestVersion,
  validatePackageForPublish,
  loadRegistryIndex,
  saveRegistryIndex,
  addVersionToIndex,
  removeVersionFromIndex,
  storeToRegistry,
  removeFromRegistry,
  normalizeScenePackageRegistryPublishOptions,
  validateScenePackageRegistryPublishOptions,
  printScenePackageRegistryPublishSummary,
  runScenePackageRegistryPublishCommand,
  normalizeSceneUnpublishOptions,
  validateSceneUnpublishOptions,
  printSceneUnpublishSummary,
  runSceneUnpublishCommand,
  normalizeSceneExtractOptions,
  validateSceneExtractOptions,
  printSceneExtractSummary,
  runSceneExtractCommand,
  normalizeOntologyOptions,
  validateOntologyOptions,
  runSceneOntologyShowCommand,
  runSceneOntologyDepsCommand,
  runSceneOntologyValidateCommand,
  runSceneOntologyActionsCommand,
  runSceneOntologyLineageCommand,
  runSceneOntologyAgentInfoCommand,
  printSceneOntologyShowSummary,
  printSceneOntologyDepsSummary,
  printSceneOntologyValidateSummary,
  printSceneOntologyActionsSummary,
  printSceneOntologyLineageSummary,
  printSceneOntologyAgentInfoSummary
} = require('../../../lib/commands/scene');

function normalizePath(targetPath) {
  return targetPath.split('\\').join('/');
}

describe('Scene command', () => {
  let originalLog;
  let originalError;
  let originalExitCode;

  beforeEach(() => {
    originalLog = console.log;
    originalError = console.error;
    originalExitCode = process.exitCode;
    console.log = jest.fn();
    console.error = jest.fn();
    delete process.exitCode;
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = originalExitCode;
  });

  test('validateSourceOptions enforces source constraints', () => {
    expect(validateSourceOptions({})).toBe('either --spec or --manifest is required');
    expect(validateSourceOptions({ spec: 'a', manifest: 'b' })).toBe('use --spec or --manifest, not both');
    expect(validateSourceOptions({ spec: 'a' })).toBeNull();
  });

  test('validateRunMode enforces supported modes', () => {
    expect(validateRunMode('preview')).toBe('mode must be dry_run or commit');
    expect(validateRunMode('dry_run')).toBeNull();
  });

  test('validateRunOptions enforces source and mode constraints', () => {
    expect(validateRunOptions({ mode: 'dry_run' })).toBe('either --spec or --manifest is required');
    expect(validateRunOptions({ spec: 'a', manifest: 'b', mode: 'dry_run' })).toBe('use --spec or --manifest, not both');
    expect(validateRunOptions({ spec: 'a', mode: 'preview' })).toBe('mode must be dry_run or commit');
    expect(validateRunOptions({ spec: 'a', mode: 'dry_run', bindingPluginDir: {} })).toBe('--binding-plugin-dir must be a non-empty path');
    expect(validateRunOptions({ spec: 'a', mode: 'dry_run', bindingPluginManifest: {} })).toBe('--binding-plugin-manifest must be a non-empty path');
    expect(validateRunOptions({ spec: 'a', mode: 'commit' })).toBeNull();
  });

  test('validateDoctorOptions mirrors source and mode constraints', () => {
    expect(validateDoctorOptions({ mode: 'dry_run' })).toBe('either --spec or --manifest is required');
    expect(validateDoctorOptions({ spec: 'x', mode: 'preview' })).toBe('mode must be dry_run or commit');
    expect(validateDoctorOptions({ manifest: 'scene.yaml', mode: 'commit', syncSpecTasks: true })).toBe('--sync-spec-tasks requires --spec source');
    expect(validateDoctorOptions({ spec: 'x', mode: 'commit', bindingPluginDir: {} })).toBe('--binding-plugin-dir must be a non-empty path');
    expect(validateDoctorOptions({ spec: 'x', mode: 'commit', bindingPluginManifest: {} })).toBe('--binding-plugin-manifest must be a non-empty path');
    expect(validateDoctorOptions({ spec: 'x', mode: 'commit' })).toBeNull();
  });

  test('validateScaffoldOptions enforces scaffold constraints', () => {
    expect(validateScaffoldOptions({ type: 'erp', output: 'custom/scene.yaml' })).toBe('--spec is required for scaffold');
    expect(validateScaffoldOptions({ spec: 'x', type: 'robotic', output: 'custom/scene.yaml' })).toBe('type must be erp or hybrid');
    expect(validateScaffoldOptions({ spec: 'x', type: 'erp', output: '' })).toBe('--output must be a non-empty relative path');
    expect(validateScaffoldOptions({ spec: 'x', type: 'hybrid', output: 'custom/scene.yaml' })).toBeNull();
  });

  test('validateEvalOptions enforces result or feedback source', () => {
    expect(validateEvalOptions({})).toBe('at least one of --result or --feedback is required');
    expect(validateEvalOptions({ result: '.kiro/results/run.json' })).toBeNull();
    expect(validateEvalOptions({ feedback: '.kiro/results/feedback.md' })).toBeNull();
    expect(validateEvalOptions({ result: '.kiro/results/run.json', syncSpecTasks: true })).toBe('--sync-spec-tasks requires --spec source');
    expect(validateEvalOptions({ result: '.kiro/results/run.json', env: 'prod' })).toBe('--env requires --eval-config');
    expect(validateEvalOptions({ result: '.kiro/results/run.json', profile: 'finance' })).toBe('profile must be one of default, erp, ops, robot');
    expect(validateEvalOptions({ result: '.kiro/results/run.json', profileRules: {} })).toBe('--profile-rules must be a non-empty path');
  });

  test('validateCatalogOptions enforces catalog constraints', () => {
    expect(validateCatalogOptions({ spec: '' })).toBe('--spec must be a non-empty spec name');
    expect(validateCatalogOptions({ specManifest: '' })).toBe('--spec-manifest must be a non-empty relative path');
    expect(validateCatalogOptions({ specManifest: '/tmp/scene.yaml' })).toBe('--spec-manifest must be a relative path');
    expect(validateCatalogOptions({ out: '', specManifest: 'custom/scene.yaml' })).toBe('--out must be a non-empty path');
    expect(validateCatalogOptions({ specManifest: 'custom/scene.yaml' })).toBeNull();
  });

  test('validateRouteOptions enforces selector and route constraints', () => {
    expect(validateRouteOptions({ specManifest: 'custom/scene.yaml', mode: 'dry_run' }))
      .toBe('at least one selector is required (--spec/--scene-ref/--domain/--kind/--query)');
    expect(validateRouteOptions({ specManifest: 'custom/scene.yaml', sceneRef: 'x', mode: 'preview' }))
      .toBe('mode must be dry_run or commit');
    expect(validateRouteOptions({ specManifest: '/tmp/scene.yaml', sceneRef: 'x', mode: 'dry_run' }))
      .toBe('--spec-manifest must be a relative path');
    expect(validateRouteOptions({ specManifest: 'custom/scene.yaml', sceneRef: 'x', mode: 'dry_run', routePolicy: {} }))
      .toBe('--route-policy must be a non-empty path');
    expect(validateRouteOptions({ specManifest: 'custom/scene.yaml', sceneRef: 'x', mode: 'dry_run' })).toBeNull();
  });

  test('validateRoutePolicyTemplateOptions enforces template constraints', () => {
    expect(validateRoutePolicyTemplateOptions({ out: '' })).toBe('--out must be a non-empty path');
    expect(validateRoutePolicyTemplateOptions({ out: '.kiro/results/route-policy.json', profile: 'finance' }))
      .toBe('profile must be one of default, erp, hybrid, robot');
    expect(validateRoutePolicyTemplateOptions({ out: '.kiro/results/route-policy.json', profile: 'robot' })).toBeNull();
  });

  test('validateRoutePolicySuggestOptions enforces eval source and tuning constraints', () => {
    expect(validateRoutePolicySuggestOptions({ eval: [], profile: 'default', maxAdjustment: 6 }))
      .toBe('at least one eval source is required (--eval/--eval-dir)');
    expect(validateRoutePolicySuggestOptions({ eval: ['.kiro/results/eval.json'], profile: 'finance', maxAdjustment: 6 }))
      .toBe('profile must be one of default, erp, hybrid, robot');
    expect(validateRoutePolicySuggestOptions({ eval: ['.kiro/results/eval.json'], profile: 'erp', maxAdjustment: Number.NaN }))
      .toBe('--max-adjustment must be a number');
    expect(validateRoutePolicySuggestOptions({ eval: ['.kiro/results/eval.json'], profile: 'erp', maxAdjustment: -1 }))
      .toBe('--max-adjustment must be greater than or equal to 0');
    expect(validateRoutePolicySuggestOptions({
      eval: ['.kiro/results/eval.json'],
      profile: 'hybrid',
      maxAdjustment: 4,
      policyOut: '.kiro/results/route-policy.json'
    })).toBeNull();
  });

  test('validateRoutePolicyRolloutOptions enforces rollout packaging constraints', () => {
    expect(validateRoutePolicyRolloutOptions({ targetPolicy: '.kiro/config/scene-route-policy.json', outDir: '.kiro/releases' }))
      .toBe('--suggestion is required');
    expect(validateRoutePolicyRolloutOptions({
      suggestion: '.kiro/results/route-policy-suggest.json',
      targetPolicy: '.kiro/config/scene-route-policy.json',
      outDir: '.kiro/releases',
      name: '***'
    })).toBe('--name must contain at least one alphanumeric character');
    expect(validateRoutePolicyRolloutOptions({
      suggestion: '.kiro/results/route-policy-suggest.json',
      targetPolicy: '.kiro/config/scene-route-policy.json',
      outDir: '.kiro/releases',
      name: 'pilot-wave-01'
    })).toBeNull();
  });

  test('validateScenePackageTemplateOptions enforces package template constraints', () => {
    expect(validateScenePackageTemplateOptions({ kind: 'scene-template', group: 'kse.scene', version: '0.1.0' }))
      .toBe('--out must be a non-empty path');
    expect(validateScenePackageTemplateOptions({ out: '.kiro/templates/scene-package.json', kind: 'bad-kind', group: 'kse.scene', version: '0.1.0' }))
      .toContain('kind must be one of');
    expect(validateScenePackageTemplateOptions({ out: '.kiro/templates/scene-package.json', kind: 'scene-template', group: 'kse.scene', version: 'v1' }))
      .toBe('--pkg-version must be a semantic version (x.y.z)');
    expect(validateScenePackageTemplateOptions({ out: '.kiro/templates/scene-package.json', kind: 'scene-template', group: 'kse.scene', version: '1.2.3' }))
      .toBeNull();
  });

  test('validateScenePackageValidateOptions enforces package source constraints', () => {
    expect(validateScenePackageValidateOptions({ specPackage: 'custom/scene-package.json' }))
      .toBe('either --spec or --package is required');
    expect(validateScenePackageValidateOptions({ spec: '67-00-scene-package-contract', packagePath: '.kiro/package.json', specPackage: 'custom/scene-package.json' }))
      .toBe('use --spec or --package, not both');
    expect(validateScenePackageValidateOptions({ spec: '67-00-scene-package-contract', specPackage: '/tmp/package.json' }))
      .toBe('--spec-package must be a relative path');
    expect(validateScenePackageValidateOptions({ spec: '67-00-scene-package-contract', specPackage: 'custom/scene-package.json' }))
      .toBeNull();
  });

  test('validateScenePackagePublishOptions enforces publish constraints', () => {
    expect(validateScenePackagePublishOptions({ specPackage: 'custom/scene-package.json', sceneManifest: 'custom/scene.yaml', outDir: '.kiro/templates' }))
      .toBe('--spec is required');
    expect(validateScenePackagePublishOptions({ spec: '67-00-scene-package', specPackage: '/tmp/scene-package.json', sceneManifest: 'custom/scene.yaml', outDir: '.kiro/templates' }))
      .toBe('--spec-package must be a non-empty relative path');
    expect(validateScenePackagePublishOptions({ spec: '67-00-scene-package', specPackage: 'custom/scene-package.json', sceneManifest: '/tmp/scene.yaml', outDir: '.kiro/templates' }))
      .toBe('--scene-manifest must be a non-empty relative path');
    expect(validateScenePackagePublishOptions({ spec: '67-00-scene-package', specPackage: 'custom/scene-package.json', sceneManifest: 'custom/scene.yaml', outDir: '.kiro/templates', templateId: '***' }))
      .toBe('--template-id must contain at least one alphanumeric character');
    expect(validateScenePackagePublishOptions({ spec: '67-00-scene-package', specPackage: 'custom/scene-package.json', sceneManifest: 'custom/scene.yaml', outDir: '.kiro/templates' }))
      .toBeNull();
  });

  test('validateScenePackageInstantiateOptions enforces instantiate constraints', () => {
    expect(validateScenePackageInstantiateOptions({ targetSpec: '68-00-scene-package-template' }))
      .toBe('--template is required');
    expect(validateScenePackageInstantiateOptions({ template: '.kiro/templates/template.manifest.json' }))
      .toBe('--target-spec is required');
    expect(validateScenePackageInstantiateOptions({
      template: '.kiro/templates/template.manifest.json',
      targetSpec: '68-00-scene-package-template',
      values: ''
    })).toBe('--values must be a non-empty path');
    expect(validateScenePackageInstantiateOptions({
      template: '.kiro/templates/template.manifest.json',
      targetSpec: '68-00-scene-package-template',
      values: '.kiro/templates/values.json'
    })).toBeNull();
  });

  test('validateScenePackageRegistryOptions enforces registry constraints', () => {
    expect(validateScenePackageRegistryOptions({})).toBe('--template-dir must be a non-empty path');
    expect(validateScenePackageRegistryOptions({ templateDir: '.kiro/templates/scene-packages', out: '' }))
      .toBe('--out must be a non-empty path');
    expect(validateScenePackageRegistryOptions({ templateDir: '.kiro/templates/scene-packages' }))
      .toBeNull();
  });

  test('validateScenePackageGateTemplateOptions enforces template constraints', () => {
    expect(validateScenePackageGateTemplateOptions({ profile: 'baseline' }))
      .toBe('--out must be a non-empty path');
    expect(validateScenePackageGateTemplateOptions({ out: '.kiro/templates/scene-package-gate-policy.json', profile: 'invalid' }))
      .toContain('profile must be one of');
    expect(validateScenePackageGateTemplateOptions({ out: '.kiro/templates/scene-package-gate-policy.json', profile: 'three-layer' }))
      .toBeNull();
  });

  test('validateScenePackageGateOptions enforces gate constraints', () => {
    expect(validateScenePackageGateOptions({ policy: '.kiro/templates/scene-package-gate-policy.json' }))
      .toBe('--registry is required');
    expect(validateScenePackageGateOptions({ registry: '.kiro/reports/scene-package-registry.json', policy: '' }))
      .toBe('--policy must be a non-empty path');
    expect(validateScenePackageGateOptions({
      registry: '.kiro/reports/scene-package-registry.json',
      policy: '.kiro/templates/scene-package-gate-policy.json',
      syncSpecTasks: true
    })).toBe('--sync-spec-tasks requires --spec source');
    expect(validateScenePackageGateOptions({ registry: '.kiro/reports/scene-package-registry.json', policy: '.kiro/templates/scene-package-gate-policy.json', runbookOut: '' }))
      .toBe('--runbook-out must be a non-empty path');
    expect(validateScenePackageGateOptions({ registry: '.kiro/reports/scene-package-registry.json', policy: '.kiro/templates/scene-package-gate-policy.json', out: '' }))
      .toBe('--out must be a non-empty path');
    expect(validateScenePackageGateOptions({ registry: '.kiro/reports/scene-package-registry.json', policy: '.kiro/templates/scene-package-gate-policy.json' }))
      .toBeNull();
  });

  test('normalizeEvalTaskSyncPolicy keeps only valid priorities', () => {
    const policy = normalizeEvalTaskSyncPolicy({
      default_priority: 'urgent',
      priority_by_grade: {
        critical: 'critical',
        watch: 'high',
        good: 'tiny'
      },
      keyword_priority_overrides: [
        { pattern: 'failed', priority: 'high' },
        { pattern: '', priority: 'critical' },
        { pattern: 'manual', priority: 'medium' },
        { pattern: 'broken-priority', priority: 'invalid' }
      ]
    });

    expect(policy.default_priority).toBe('medium');
    expect(policy.priority_by_grade).toMatchObject({
      critical: 'critical',
      watch: 'high',
      good: 'low'
    });
    expect(policy.keyword_priority_overrides).toEqual([
      { pattern: 'failed', priority: 'high' },
      { pattern: 'manual', priority: 'medium' },
      { pattern: 'broken-priority', priority: 'medium' }
    ]);
  });

  test('resolveEvalTaskPriority applies grade map then keyword escalation', () => {
    const report = {
      overall: {
        grade: 'watch'
      }
    };

    const policy = {
      default_priority: 'low',
      priority_by_grade: {
        watch: 'medium'
      },
      keyword_priority_overrides: [
        { pattern: 'failed', priority: 'high' }
      ]
    };

    expect(resolveEvalTaskPriority('Investigate failed runtime nodes', report, policy)).toBe('high');
    expect(resolveEvalTaskPriority('Improve docs and onboarding', report, policy)).toBe('medium');
  });

  test('resolveSceneEvalConfigProfile merges global and env overrides', () => {
    const resolved = resolveSceneEvalConfigProfile({
      target: {
        max_cycle_time_ms: 2500,
        max_manual_takeover_rate: 0.25
      },
      task_sync_policy: {
        default_priority: 'medium'
      },
      envs: {
        prod: {
          target: {
            max_cycle_time_ms: 1600
          },
          task_sync_policy: {
            default_priority: 'high'
          }
        }
      }
    }, 'prod');

    expect(resolved.targetConfig).toEqual({
      max_cycle_time_ms: 1600,
      max_manual_takeover_rate: 0.25
    });
    expect(resolved.taskSyncPolicy).toEqual({
      default_priority: 'high'
    });
  });

  test('normalizeEvalProfileInferenceRules keeps valid overrides only', () => {
    const normalized = normalizeEvalProfileInferenceRules({
      domain_aliases: {
        warehouse: 'erp',
        edge: 'robot',
        bad: 'finance'
      },
      scene_ref_rules: [
        {
          pattern: '^scene\.warehouse\.',
          profile: 'erp'
        },
        {
          pattern: '',
          profile: 'ops'
        },
        {
          pattern: '[',
          profile: 'ops'
        },
        {
          pattern: 'incident',
          profile: 'ops'
        }
      ]
    });

    expect(normalized.domain_aliases.warehouse).toBe('erp');
    expect(normalized.domain_aliases.edge).toBe('robot');
    expect(normalized.domain_aliases.bad).toBeUndefined();
    expect(normalized.scene_ref_rules).toEqual([
      {
        pattern: '^scene\.warehouse\.',
        profile: 'erp'
      },
      {
        pattern: 'incident',
        profile: 'ops'
      }
    ]);
  });

  test('parseDoctorFeedbackTemplate parses task feedback values', () => {
    const parsed = parseDoctorFeedbackTemplate(`# Doctor Execution Feedback Template

Scene: scene.hybrid.pick@0.2.0
Domain: hybrid
Mode: commit
Status: blocked
Trace: doctor-trace-feedback

## Task Feedback Records

### Task 2: Collect approval before commit
- Priority: high
- Suggestion Code: approval-required
- Trace ID: doctor-trace-feedback
- Scene Ref: scene.hybrid.pick
- Planned Action: Collect approval and rerun commit

- [x] Status: done
- [x] Owner: ops-team
- [x] Evidence Paths: .kiro/results/approval-evidence.json
- [x] Completion Notes: Approval completed and verified
- [x] Eval Update:
  - cycle_time_ms: 980
  - policy_violation_count: 0
  - node_failure_count: 0
  - manual_takeover_rate: 0.1
`);

    expect(parsed.scene_ref).toBe('scene.hybrid.pick');
    expect(parsed.scene_version).toBe('0.2.0');
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0]).toMatchObject({
      task_id: 2,
      status: 'done',
      owner: 'ops-team',
      suggestion_code: 'approval-required'
    });
    expect(parsed.tasks[0].eval_update).toEqual({
      cycle_time_ms: 980,
      policy_violation_count: 0,
      node_failure_count: 0,
      manual_takeover_rate: 0.1
    });
  });

  test('buildRuntimeContext merges context file and flag overrides', async () => {
    const mockReadJson = jest.fn().mockResolvedValue({
      approved: false,
      safetyChecks: { preflight: false },
      tenantId: 'acme'
    });

    const context = await buildRuntimeContext({
      contextFile: 'ctx.json',
      approved: true,
      dualApproved: true,
      safetyStopChannel: true,
      allowHybridCommit: true
    }, '/project', mockReadJson);

    expect(mockReadJson).toHaveBeenCalledWith(path.join('/project', 'ctx.json'));
    expect(context).toEqual({
      approved: true,
      dualApproved: true,
      allowHybridCommit: true,
      tenantId: 'acme',
      safetyChecks: {
        preflight: false,
        stopChannel: true
      }
    });
  });

  test('runSceneValidateCommand returns summary for valid spec manifest', async () => {
    const manifest = {
      metadata: {
        obj_id: 'scene.order.query',
        obj_version: '0.2.0',
        title: 'Order Query'
      },
      spec: {
        domain: 'erp',
        capability_contract: {
          bindings: [
            { type: 'query', ref: 'spec.erp.query' },
            { type: 'service', ref: 'spec.erp.reserve', side_effect: true }
          ]
        },
        governance_contract: {
          risk_level: 'low',
          approval: { required: false }
        }
      }
    };

    const sceneLoader = {
      loadFromSpec: jest.fn().mockResolvedValue(manifest),
      loadFromFile: jest.fn()
    };

    const summary = await runSceneValidateCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader
    });

    expect(sceneLoader.loadFromSpec).toHaveBeenCalledWith('37-00-scene-runtime-execution-pilot', 'custom/scene.yaml');
    expect(summary).toEqual({
      valid: true,
      scene_ref: 'scene.order.query',
      scene_version: '0.2.0',
      title: 'Order Query',
      domain: 'erp',
      risk_level: 'low',
      approval_required: false,
      binding_count: 2,
      side_effect_binding_count: 1
    });
    expect(process.exitCode).toBeUndefined();
  });

  test('runSceneValidateCommand rejects invalid command options', async () => {
    const result = await runSceneValidateCommand({}, {
      projectRoot: '/workspace'
    });

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test('runSceneValidateCommand handles loader errors', async () => {
    const sceneLoader = {
      loadFromSpec: jest.fn().mockRejectedValue(new Error('Invalid scene manifest')),
      loadFromFile: jest.fn()
    };

    const result = await runSceneValidateCommand({
      spec: '37-00-scene-runtime-execution-pilot'
    }, {
      projectRoot: '/workspace',
      sceneLoader
    });

    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  test('runSceneDoctorCommand returns healthy report', async () => {
    const manifest = {
      metadata: {
        obj_id: 'scene.order.query',
        obj_version: '0.2.0',
        title: 'Order Query'
      },
      spec: {
        domain: 'erp',
        intent: { goal: 'Query order' },
        capability_contract: {
          bindings: [{ type: 'query', ref: 'spec.erp.query' }]
        },
        governance_contract: {
          risk_level: 'low',
          approval: { required: false },
          idempotency: { key: 'orderId' }
        }
      }
    };

    const sceneLoader = {
      loadFromSpec: jest.fn().mockResolvedValue(manifest),
      loadFromFile: jest.fn()
    };

    const planCompiler = {
      compile: jest.fn().mockReturnValue({ nodes: [{ node_id: 'n-01' }, { node_id: 'n-02' }] })
    };

    const policyGate = {
      evaluate: jest.fn().mockReturnValue({ allowed: true, reasons: [] })
    };

    const runtimeExecutor = {
      adapterReadinessChecker: jest.fn(),
      bindingPluginLoad: {
        handlers_loaded: 1,
        plugin_dirs: ['/workspace/.kiro/plugins/scene-bindings'],
        plugin_files: ['/workspace/.kiro/plugins/scene-bindings/custom-plugin.js'],
        manifest_path: '/workspace/.kiro/config/scene-binding-plugins.json',
        manifest_loaded: true,
        warnings: []
      }
    };

    const report = await runSceneDoctorCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'dry_run',
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader,
      planCompiler,
      policyGate,
      runtimeExecutor
    });

    expect(report.status).toBe('healthy');
    expect(report.plan.valid).toBe(true);
    expect(report.policy.allowed).toBe(true);
    expect(report.binding_plugins).toMatchObject({
      handlers_loaded: 1,
      manifest_path: '/workspace/.kiro/config/scene-binding-plugins.json',
      manifest_loaded: true
    });
    expect(Array.isArray(report.suggestions)).toBe(true);
    expect(report.suggestions[0].code).toBe('ready-to-run');
    expect(typeof report.trace_id).toBe('string');
    expect(report.trace_id.length).toBeGreaterThan(0);
    expect(process.exitCode).toBeUndefined();
  });

  test('runSceneDoctorCommand flags blocked policy and adapter readiness', async () => {
    const manifest = {
      metadata: {
        obj_id: 'scene.hybrid.pick',
        obj_version: '0.2.0',
        title: 'Hybrid Pick'
      },
      spec: {
        domain: 'hybrid',
        intent: { goal: 'Dispatch pick' },
        capability_contract: {
          bindings: [{ type: 'service', ref: 'spec.erp.reserve' }]
        },
        governance_contract: {
          risk_level: 'high',
          approval: { required: true },
          idempotency: { key: 'orderId' }
        }
      }
    };

    const runtimeExecutor = {
      adapterReadinessChecker: jest.fn().mockResolvedValue({
        ready: false,
        checks: [{ name: 'robot-bridge', passed: false }]
      })
    };

    const report = await runSceneDoctorCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'commit',
      checkAdapter: true,
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader: {
        loadFromSpec: jest.fn().mockResolvedValue(manifest),
        loadFromFile: jest.fn()
      },
      planCompiler: {
        compile: jest.fn().mockReturnValue({ nodes: [{ node_id: 'n-01' }] })
      },
      policyGate: {
        evaluate: jest.fn().mockReturnValue({
          allowed: false,
          reasons: ['approval is required for commit']
        })
      },
      runtimeExecutor
    });

    expect(runtimeExecutor.adapterReadinessChecker).toHaveBeenCalled();
    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('policy blocked: approval is required for commit');
    expect(report.blockers).toContain('adapter checks failed: robot-bridge');
    expect(report.suggestions.some((item) => item.code === 'approval-required')).toBe(true);
    expect(report.suggestions.some((item) => item.code === 'adapter-readiness')).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  test('runSceneDoctorCommand reports binding plugin manifest warnings and suggestions', async () => {
    const manifest = {
      metadata: {
        obj_id: 'scene.order.query',
        obj_version: '0.2.0',
        title: 'Order Query'
      },
      spec: {
        domain: 'erp',
        intent: { goal: 'Query order' },
        capability_contract: {
          bindings: [{ type: 'query', ref: 'spec.erp.query' }]
        },
        governance_contract: {
          risk_level: 'low',
          approval: { required: false },
          idempotency: { key: 'orderId' }
        }
      }
    };

    const report = await runSceneDoctorCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'dry_run',
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader: {
        loadFromSpec: jest.fn().mockResolvedValue(manifest),
        loadFromFile: jest.fn()
      },
      planCompiler: {
        compile: jest.fn().mockReturnValue({ nodes: [{ node_id: 'n-01' }] })
      },
      policyGate: {
        evaluate: jest.fn().mockReturnValue({ allowed: true, reasons: [] })
      },
      runtimeExecutor: {
        adapterReadinessChecker: jest.fn(),
        bindingPluginLoad: {
          handlers_loaded: 0,
          plugin_dirs: [],
          plugin_files: [],
          manifest_path: '/workspace/.kiro/config/scene-binding-plugins.json',
          manifest_loaded: false,
          warnings: ['binding plugin manifest not found: /workspace/.kiro/config/scene-binding-plugins.json']
        }
      }
    });

    expect(report.status).toBe('healthy');
    expect(report.binding_plugins).toMatchObject({
      manifest_path: '/workspace/.kiro/config/scene-binding-plugins.json',
      manifest_loaded: false
    });
    expect(report.suggestions.some((item) => item.code === 'binding-plugin-manifest-missing')).toBe(true);
    expect(process.exitCode).toBeUndefined();
  });

  test('runSceneDoctorCommand prints binding plugin diagnostics in summary output', async () => {
    const manifest = {
      metadata: {
        obj_id: 'scene.order.query',
        obj_version: '0.2.0',
        title: 'Order Query'
      },
      spec: {
        domain: 'erp',
        intent: { goal: 'Query order' },
        capability_contract: {
          bindings: [{ type: 'query', ref: 'spec.erp.query' }]
        },
        governance_contract: {
          risk_level: 'low',
          approval: { required: false },
          idempotency: { key: 'orderId' }
        }
      }
    };

    await runSceneDoctorCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'dry_run'
    }, {
      projectRoot: '/workspace',
      sceneLoader: {
        loadFromSpec: jest.fn().mockResolvedValue(manifest),
        loadFromFile: jest.fn()
      },
      planCompiler: {
        compile: jest.fn().mockReturnValue({ nodes: [{ node_id: 'n-01' }] })
      },
      policyGate: {
        evaluate: jest.fn().mockReturnValue({ allowed: true, reasons: [] })
      },
      runtimeExecutor: {
        adapterReadinessChecker: jest.fn(),
        bindingPluginLoad: {
          handlers_loaded: 1,
          plugin_dirs: ['/workspace/.kiro/plugins/scene-bindings'],
          plugin_files: ['/workspace/.kiro/plugins/scene-bindings/custom-plugin.js'],
          manifest_path: '/workspace/.kiro/config/scene-binding-plugins.json',
          manifest_loaded: true,
          warnings: []
        }
      }
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Binding Plugins: 1 handler(s)'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Manifest:'));
  });



  test('runSceneDoctorCommand writes remediation checklist when todoOut is provided', async () => {
    const manifest = {
      metadata: {
        obj_id: 'scene.hybrid.pick',
        obj_version: '0.2.0',
        title: 'Hybrid Pick'
      },
      spec: {
        domain: 'hybrid',
        intent: { goal: 'Dispatch pick' },
        capability_contract: {
          bindings: [{ type: 'service', ref: 'spec.erp.reserve' }]
        },
        governance_contract: {
          risk_level: 'high',
          approval: { required: true },
          idempotency: { key: 'orderId' }
        }
      }
    };

    const fileSystem = {
      ensureDir: jest.fn().mockResolvedValue(),
      writeFile: jest.fn().mockResolvedValue()
    };

    const report = await runSceneDoctorCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'commit',
      todoOut: '.kiro/results/doctor-remediation.md',
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader: {
        loadFromSpec: jest.fn().mockResolvedValue(manifest),
        loadFromFile: jest.fn()
      },
      planCompiler: {
        compile: jest.fn().mockReturnValue({ nodes: [{ node_id: 'n-01' }] })
      },
      policyGate: {
        evaluate: jest.fn().mockReturnValue({
          allowed: false,
          reasons: ['approval is required for commit']
        })
      },
      runtimeExecutor: {
        adapterReadinessChecker: jest.fn()
      },
      fileSystem
    });

    expect(normalizePath(report.todo_output)).toBe('/workspace/.kiro/results/doctor-remediation.md');
    expect(fileSystem.ensureDir).toHaveBeenCalled();
    expect(fileSystem.writeFile).toHaveBeenCalledTimes(1);
  });



  test('runSceneDoctorCommand syncs actionable suggestions into spec tasks', async () => {
    const manifest = {
      metadata: {
        obj_id: 'scene.hybrid.pick',
        obj_version: '0.2.0',
        title: 'Hybrid Pick'
      },
      spec: {
        domain: 'hybrid',
        intent: { goal: 'Dispatch pick' },
        capability_contract: {
          bindings: [{ type: 'service', ref: 'spec.erp.reserve' }]
        },
        governance_contract: {
          risk_level: 'high',
          approval: { required: true },
          idempotency: { key: 'orderId' }
        }
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),      readFile: jest.fn().mockResolvedValue(`# Implementation Plan\n\n## Tasks\n\n- [x] 1 Existing baseline\n`),
      writeFile: jest.fn().mockResolvedValue(),
      ensureDir: jest.fn().mockResolvedValue()
    };

    const report = await runSceneDoctorCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'commit',
      traceId: 'doctor-trace-1',
      syncSpecTasks: true,
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader: {
        loadFromSpec: jest.fn().mockResolvedValue(manifest),
        loadFromFile: jest.fn()
      },
      planCompiler: {
        compile: jest.fn().mockReturnValue({ nodes: [{ node_id: 'n-01' }] })
      },
      policyGate: {
        evaluate: jest.fn().mockReturnValue({
          allowed: false,
          reasons: ['approval is required for commit']
        })
      },
      runtimeExecutor: {
        adapterReadinessChecker: jest.fn()
      },
      fileSystem
    });

    expect(report.trace_id).toBe('doctor-trace-1');
    expect(report.task_sync).toBeDefined();
    expect(report.task_sync.trace_id).toBe('doctor-trace-1');
    expect(report.task_sync.added_count).toBe(1);
    expect(normalizePath(report.task_sync.tasks_path)).toBe('/workspace/.kiro/specs/37-00-scene-runtime-execution-pilot/tasks.md');

    const syncedTasks = fileSystem.writeFile.mock.calls[fileSystem.writeFile.mock.calls.length - 1][1];
    expect(syncedTasks).toContain('## Doctor Suggested Tasks');
    expect(syncedTasks).toContain('- [ ] 2 [high] Collect approval before commit [doctor_code=approval-required trace_id=doctor-trace-1 scene_ref=scene.hybrid.pick]');
  });


  test('runSceneDoctorCommand writes feedback template when feedbackOut is provided', async () => {
    const manifest = {
      metadata: {
        obj_id: 'scene.hybrid.pick',
        obj_version: '0.2.0',
        title: 'Hybrid Pick'
      },
      spec: {
        domain: 'hybrid',
        intent: { goal: 'Dispatch pick' },
        capability_contract: {
          bindings: [{ type: 'service', ref: 'spec.erp.reserve' }]
        },
        governance_contract: {
          risk_level: 'high',
          approval: { required: true },
          idempotency: { key: 'orderId' }
        }
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue(`# Implementation Plan: Demo

## Tasks

- [x] 1 Baseline task
`),
      writeFile: jest.fn().mockResolvedValue(),
      ensureDir: jest.fn().mockResolvedValue()
    };

    const report = await runSceneDoctorCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'commit',
      traceId: 'doctor-trace-feedback',
      syncSpecTasks: true,
      feedbackOut: '.kiro/results/doctor-feedback-template.md',
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader: {
        loadFromSpec: jest.fn().mockResolvedValue(manifest),
        loadFromFile: jest.fn()
      },
      planCompiler: {
        compile: jest.fn().mockReturnValue({ nodes: [{ node_id: 'n-01' }] })
      },
      policyGate: {
        evaluate: jest.fn().mockReturnValue({
          allowed: false,
          reasons: ['approval is required for commit']
        })
      },
      runtimeExecutor: {
        adapterReadinessChecker: jest.fn()
      },
      fileSystem
    });

    expect(normalizePath(report.feedback_output)).toBe('/workspace/.kiro/results/doctor-feedback-template.md');

    const feedbackCall = fileSystem.writeFile.mock.calls.find((call) => normalizePath(call[0]) === '/workspace/.kiro/results/doctor-feedback-template.md');
    expect(feedbackCall).toBeDefined();

    const feedbackContent = feedbackCall[1];
    expect(feedbackContent).toContain('# Doctor Execution Feedback Template');
    expect(feedbackContent).toContain('### Task 2: Collect approval before commit');
    expect(feedbackContent).toContain('Suggestion Code: approval-required');
    expect(feedbackContent).toContain('Trace ID: doctor-trace-feedback');
    expect(feedbackContent).toContain('- [ ] Eval Update:');
  });

  test('runSceneDoctorCommand writes task draft when taskOut is provided', async () => {
    const manifest = {
      metadata: {
        obj_id: 'scene.hybrid.pick',
        obj_version: '0.2.0',
        title: 'Hybrid Pick'
      },
      spec: {
        domain: 'hybrid',
        intent: { goal: 'Dispatch pick' },
        capability_contract: {
          bindings: [{ type: 'service', ref: 'spec.erp.reserve' }]
        },
        governance_contract: {
          risk_level: 'high',
          approval: { required: true },
          idempotency: { key: 'orderId' }
        }
      }
    };

    const fileSystem = {
      ensureDir: jest.fn().mockResolvedValue(),
      writeFile: jest.fn().mockResolvedValue()
    };

    const report = await runSceneDoctorCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'commit',
      taskOut: '.kiro/results/doctor-task-draft.md',
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader: {
        loadFromSpec: jest.fn().mockResolvedValue(manifest),
        loadFromFile: jest.fn()
      },
      planCompiler: {
        compile: jest.fn().mockReturnValue({ nodes: [{ node_id: 'n-01' }] })
      },
      policyGate: {
        evaluate: jest.fn().mockReturnValue({
          allowed: false,
          reasons: ['approval is required for commit']
        })
      },
      runtimeExecutor: {
        adapterReadinessChecker: jest.fn()
      },
      fileSystem
    });

    expect(normalizePath(report.task_output)).toBe('/workspace/.kiro/results/doctor-task-draft.md');
    expect(fileSystem.writeFile).toHaveBeenCalledTimes(1);

    const draftContent = fileSystem.writeFile.mock.calls[0][1];
    expect(draftContent).toContain('# Doctor Task Draft');
    expect(draftContent).toContain('- [ ] 1 [high] [approval-required] Collect approval before commit');
  });

  test('runSceneEvalCommand aggregates run result and feedback into report', async () => {
    const runResultPayload = {
      scene_ref: 'scene.hybrid.pick',
      scene_version: '0.2.0',
      trace_id: 'trace-run-1',
      run_mode: 'commit',
      run_result: {
        status: 'success',
        run_mode: 'commit'
      },
      eval_payload: {
        trace_id: 'trace-run-1',
        scene_ref: 'scene.hybrid.pick',
        scene_version: '0.2.0',
        status: 'success',
        metrics: {
          cycle_time_ms: 900,
          manual_takeover_rate: 0,
          policy_violation_count: 0,
          node_failure_count: 0
        }
      }
    };

    const feedbackTemplate = `# Doctor Execution Feedback Template

Scene: scene.hybrid.pick@0.2.0
Domain: hybrid
Mode: commit
Status: blocked
Trace: doctor-trace-feedback

## Task Feedback Records

### Task 2: Collect approval before commit
- Priority: high
- Suggestion Code: approval-required
- Trace ID: doctor-trace-feedback
- Scene Ref: scene.hybrid.pick

- [x] Status: done
- [x] Owner: ops-team
- [x] Evidence Paths: .kiro/results/approval.json
- [x] Completion Notes: done
- [x] Eval Update:
  - cycle_time_ms: 1200
  - policy_violation_count: 0
  - node_failure_count: 0
  - manual_takeover_rate: 0.2

### Task 3: Verify adapter readiness
- Priority: medium
- Suggestion Code: adapter-readiness
- Trace ID: doctor-trace-feedback
- Scene Ref: scene.hybrid.pick

- [x] Status: blocked
- [x] Owner: runtime-team
- [x] Evidence Paths:
- [x] Completion Notes: awaiting adapter
- [x] Eval Update:
  - cycle_time_ms: 800
  - policy_violation_count: 0
  - node_failure_count: 0
  - manual_takeover_rate: 0.05
`;

    const fileSystem = {
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/results/run-result.json') {
          return runResultPayload;
        }
        if (normalizedPath === '/workspace/.kiro/results/eval-target.json') {
          return {
            max_cycle_time_ms: 1000,
            min_completion_rate: 0.6,
            max_blocked_rate: 0.4,
            max_manual_takeover_rate: 0.2
          };
        }

        throw new Error(`unexpected readJson path: ${normalizedPath}`);
      }),
      readFile: jest.fn().mockResolvedValue(feedbackTemplate),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const report = await runSceneEvalCommand({
      result: '.kiro/results/run-result.json',
      feedback: '.kiro/results/doctor-feedback.md',
      target: '.kiro/results/eval-target.json',
      out: '.kiro/results/eval-report.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(report).toBeDefined();
    expect(report.scene_ref).toBe('scene.hybrid.pick');
    expect(report.run_evaluation.score).toBe(1);
    expect(report.feedback_evaluation.task_summary).toMatchObject({
      total: 2,
      done: 1,
      blocked: 1
    });
    expect(report.feedback_evaluation.score).toBe(0.6);
    expect(report.overall.score).toBeCloseTo(0.84, 2);
    expect(report.overall.grade).toBe('watch');
    expect(report.output_path).toBe('.kiro/results/eval-report.json');

    const writeCall = fileSystem.writeJson.mock.calls.find((call) => normalizePath(call[0]) === '/workspace/.kiro/results/eval-report.json');
    expect(writeCall).toBeDefined();
  });

  test('runSceneEvalCommand handles feedback-only template without actionable tasks', async () => {
    const feedbackTemplate = `# Doctor Execution Feedback Template

Scene: scene.template.erp-order-query@0.2.0
Domain: erp
Mode: dry_run
Status: healthy
Trace: doctor-trace-erp

## Task Feedback Records

- No synced actionable tasks in this doctor run.
`;

    const fileSystem = {
      readFile: jest.fn().mockResolvedValue(feedbackTemplate),
      readJson: jest.fn(),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const report = await runSceneEvalCommand({
      feedback: '.kiro/results/doctor-feedback-empty.md',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(report.feedback_evaluation.task_summary.total).toBe(0);
    expect(report.feedback_evaluation.score).toBeNull();
    expect(report.overall.grade).toBe('insufficient_data');
  });

  test('runSceneEvalCommand syncs overall recommendations into spec tasks', async () => {
    const feedbackTemplate = `# Doctor Execution Feedback Template

Scene: scene.template.erp-order-query@0.2.0
Domain: erp
Mode: dry_run
Status: healthy
Trace: doctor-trace-erp

## Task Feedback Records

- No synced actionable tasks in this doctor run.
`;

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        return normalizedPath === '/workspace/.kiro/specs/37-00-scene-runtime-execution-pilot/tasks.md';
      }),
      readFile: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/results/doctor-feedback-empty.md') {
          return feedbackTemplate;
        }

        if (normalizedPath === '/workspace/.kiro/specs/37-00-scene-runtime-execution-pilot/tasks.md') {
          return `# Implementation Plan: Demo

## Tasks

- [x] 1 Baseline task
`;
        }

        throw new Error(`unexpected readFile path: ${normalizedPath}`);
      }),
      writeFile: jest.fn().mockResolvedValue(),
      readJson: jest.fn(),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const report = await runSceneEvalCommand({
      feedback: '.kiro/results/doctor-feedback-empty.md',
      spec: '37-00-scene-runtime-execution-pilot',
      syncSpecTasks: true,
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(report.task_sync).toBeDefined();
    expect(report.task_sync.added_count).toBe(1);
    expect(report.task_sync.policy_source).toBe('profile:erp:feedback');
    expect(report.inputs).toMatchObject({
      profile: 'erp',
      profile_source: 'feedback'
    });
    expect(normalizePath(report.task_sync.tasks_path)).toBe('/workspace/.kiro/specs/37-00-scene-runtime-execution-pilot/tasks.md');

    const syncedTasks = fileSystem.writeFile.mock.calls[fileSystem.writeFile.mock.calls.length - 1][1];
    expect(syncedTasks).toContain('## Scene Eval Suggested Tasks');
    expect(syncedTasks).toContain('No feedback tasks found. Sync doctor tasks and fill feedback template before evaluation.');
    expect(syncedTasks).toContain('[medium]');
    expect(syncedTasks).toContain('eval_source=scene-eval');
    expect(syncedTasks).toContain('policy_source=profile:erp:feedback');
  });

  test('runSceneEvalCommand applies custom task policy to sync priority', async () => {
    const runResultPayload = {
      scene_ref: 'scene.hybrid.pick',
      scene_version: '0.2.0',
      trace_id: 'trace-run-2',
      run_mode: 'commit',
      run_result: {
        status: 'failed',
        run_mode: 'commit'
      },
      eval_payload: {
        trace_id: 'trace-run-2',
        scene_ref: 'scene.hybrid.pick',
        scene_version: '0.2.0',
        status: 'failed',
        metrics: {
          cycle_time_ms: 1200,
          manual_takeover_rate: 0.2,
          policy_violation_count: 1,
          node_failure_count: 1
        }
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        return normalizedPath === '/workspace/.kiro/specs/37-00-scene-runtime-execution-pilot/tasks.md';
      }),
      readFile: jest.fn().mockResolvedValue(`# Implementation Plan: Demo

## Tasks

- [x] 1 Baseline task
`),
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/results/run-result-failed.json') {
          return runResultPayload;
        }

        if (normalizedPath === '/workspace/.kiro/results/eval-task-policy.json') {
          return {
            default_priority: 'low',
            priority_by_grade: {
              critical: 'critical',
              at_risk: 'high'
            },
            keyword_priority_overrides: [
              {
                pattern: 'failed runtime nodes',
                priority: 'critical'
              }
            ]
          };
        }

        throw new Error(`unexpected readJson path: ${normalizedPath}`);
      }),
      writeFile: jest.fn().mockResolvedValue(),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const report = await runSceneEvalCommand({
      result: '.kiro/results/run-result-failed.json',
      spec: '37-00-scene-runtime-execution-pilot',
      syncSpecTasks: true,
      taskPolicy: '.kiro/results/eval-task-policy.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(report.task_sync).toBeDefined();
    expect(report.task_sync.added_count).toBeGreaterThan(0);
    expect(report.task_sync.policy_source).toBe('eval-task-policy.json');

    const syncedTasks = fileSystem.writeFile.mock.calls[fileSystem.writeFile.mock.calls.length - 1][1];
    expect(syncedTasks).toContain('[critical] Investigate failed runtime nodes and compensation logs.');
    expect(syncedTasks).toContain('policy_source=eval-task-policy.json');
  });

  test('runSceneEvalCommand infers robot profile from spec manifest domain', async () => {
    const runResultPayload = {
      scene_ref: 'scene.robot.pick',
      scene_version: '0.2.0',
      trace_id: 'trace-run-robot',
      run_mode: 'commit',
      run_result: {
        status: 'failed',
        run_mode: 'commit'
      },
      eval_payload: {
        trace_id: 'trace-run-robot',
        scene_ref: 'scene.robot.pick',
        scene_version: '0.2.0',
        status: 'failed',
        metrics: {
          cycle_time_ms: 1400,
          manual_takeover_rate: 0.2,
          policy_violation_count: 1,
          node_failure_count: 1
        }
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        return normalizedPath === '/workspace/.kiro/specs/37-00-scene-runtime-execution-pilot/tasks.md';
      }),
      readFile: jest.fn().mockResolvedValue(`# Implementation Plan: Demo

## Tasks

- [x] 1 Baseline task
`),
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/results/run-result-robot.json') {
          return runResultPayload;
        }

        throw new Error(`unexpected readJson path: ${normalizedPath}`);
      }),
      writeFile: jest.fn().mockResolvedValue(),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const report = await runSceneEvalCommand({
      result: '.kiro/results/run-result-robot.json',
      spec: '37-00-scene-runtime-execution-pilot',
      syncSpecTasks: true,
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader: {
        loadFromSpec: jest.fn().mockResolvedValue({
          spec: {
            domain: 'robot'
          }
        })
      },
      fileSystem
    });

    expect(report.inputs).toMatchObject({
      profile: 'robot',
      profile_source: 'spec:37-00-scene-runtime-execution-pilot'
    });
    expect(report.task_sync.policy_source).toBe('profile:robot:spec:37-00-scene-runtime-execution-pilot');

    const syncedTasks = fileSystem.writeFile.mock.calls[fileSystem.writeFile.mock.calls.length - 1][1];
    expect(syncedTasks).toContain('[critical] Investigate failed runtime nodes and compensation logs.');
    expect(syncedTasks).toContain('policy_source=profile:robot:spec:37-00-scene-runtime-execution-pilot');
  });

  test('runSceneEvalCommand falls back to result scene_ref profile when spec manifest is missing', async () => {
    const runResultPayload = {
      scene_ref: 'scene.robot.pick',
      scene_version: '0.2.0',
      trace_id: 'trace-run-robot-fallback',
      run_mode: 'commit',
      run_result: {
        status: 'failed',
        run_mode: 'commit'
      },
      eval_payload: {
        trace_id: 'trace-run-robot-fallback',
        scene_ref: 'scene.robot.pick',
        scene_version: '0.2.0',
        status: 'failed',
        metrics: {
          cycle_time_ms: 1300,
          manual_takeover_rate: 0.22,
          policy_violation_count: 1,
          node_failure_count: 1
        }
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        return normalizedPath === '/workspace/.kiro/specs/37-00-scene-runtime-execution-pilot/tasks.md';
      }),
      readFile: jest.fn().mockResolvedValue(`# Implementation Plan: Demo

## Tasks

- [x] 1 Baseline task
`),
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/results/run-result-robot-fallback.json') {
          return runResultPayload;
        }

        throw new Error(`unexpected readJson path: ${normalizedPath}`);
      }),
      writeFile: jest.fn().mockResolvedValue(),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const sceneLoader = {
      loadFromSpec: jest.fn().mockRejectedValue(new Error('scene manifest not found'))
    };

    const report = await runSceneEvalCommand({
      result: '.kiro/results/run-result-robot-fallback.json',
      spec: '37-00-scene-runtime-execution-pilot',
      syncSpecTasks: true,
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader,
      fileSystem
    });

    expect(sceneLoader.loadFromSpec).toHaveBeenCalledWith('37-00-scene-runtime-execution-pilot', 'custom/scene.yaml');
    expect(report.inputs).toMatchObject({
      profile: 'robot',
      profile_source: 'result:scene_ref'
    });
    expect(report.task_sync.policy_source).toBe('profile:robot:result:scene_ref');

    const syncedTasks = fileSystem.writeFile.mock.calls[fileSystem.writeFile.mock.calls.length - 1][1];
    expect(syncedTasks).toContain('policy_source=profile:robot:result:scene_ref');
  });

  test('runSceneEvalCommand auto-discovers spec manifest path for profile inference', async () => {
    const runResultPayload = {
      scene_ref: 'scene.ops.incident',
      scene_version: '0.2.0',
      trace_id: 'trace-run-ops-manifest',
      run_mode: 'commit',
      run_result: {
        status: 'failed',
        run_mode: 'commit'
      },
      eval_payload: {
        trace_id: 'trace-run-ops-manifest',
        scene_ref: 'scene.ops.incident',
        scene_version: '0.2.0',
        status: 'failed',
        metrics: {
          cycle_time_ms: 1200,
          manual_takeover_rate: 0.2,
          policy_violation_count: 1,
          node_failure_count: 1
        }
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        return normalizedPath === '/workspace/.kiro/specs/37-00-scene-runtime-execution-pilot/scene.yaml';
      }),
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/results/run-result-ops-manifest.json') {
          return runResultPayload;
        }

        throw new Error(`unexpected readJson path: ${normalizedPath}`);
      }),
      writeFile: jest.fn().mockResolvedValue(),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const sceneLoader = {
      loadFromSpec: jest.fn().mockImplementation(async (specName, manifestPath) => {
        if (manifestPath === 'custom/scene.yaml') {
          throw new Error('ENOENT');
        }

        if (manifestPath === 'scene.yaml') {
          return {
            spec: {
              domain: 'ops'
            }
          };
        }

        throw new Error(`unexpected manifest path: ${manifestPath}`);
      })
    };

    const report = await runSceneEvalCommand({
      result: '.kiro/results/run-result-ops-manifest.json',
      spec: '37-00-scene-runtime-execution-pilot',
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader,
      fileSystem
    });

    expect(sceneLoader.loadFromSpec).toHaveBeenCalledTimes(2);
    expect(sceneLoader.loadFromSpec).toHaveBeenNthCalledWith(1, '37-00-scene-runtime-execution-pilot', 'custom/scene.yaml');
    expect(sceneLoader.loadFromSpec).toHaveBeenNthCalledWith(2, '37-00-scene-runtime-execution-pilot', 'scene.yaml');
    expect(report.inputs).toMatchObject({
      profile: 'ops',
      profile_source: 'spec:37-00-scene-runtime-execution-pilot',
      profile_manifest: 'scene.yaml',
      profile_manifest_source: 'auto-discovered'
    });
    expect(report.inputs.profile_warnings).toContain('requested manifest unavailable: custom/scene.yaml');
    expect(report.inputs.profile_warnings).toContain('profile manifest auto-discovery selected: scene.yaml');
  });

  test('runSceneEvalCommand strict profile inference fails on unresolved default', async () => {
    const fileSystem = {
      readJson: jest.fn().mockResolvedValue({
        trace_id: 'trace-run-strict',
        run_mode: 'commit',
        run_result: {
          status: 'failed',
          run_mode: 'commit'
        },
        eval_payload: {
          trace_id: 'trace-run-strict',
          status: 'failed',
          metrics: {
            cycle_time_ms: 1400,
            manual_takeover_rate: 0.2,
            policy_violation_count: 1,
            node_failure_count: 1
          }
        }
      }),
      writeFile: jest.fn().mockResolvedValue(),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const report = await runSceneEvalCommand({
      result: '.kiro/results/run-result-strict.json',
      profileInferStrict: true,
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(report).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Scene eval failed:'), expect.stringContaining('profile inference strict mode failed'));
  });

  test('runSceneEvalCommand applies explicit profile rules file for scene_ref inference', async () => {
    const runResultPayload = {
      scene_ref: 'scene.warehouse.pick',
      scene_version: '0.2.0',
      trace_id: 'trace-run-rules',
      run_mode: 'commit',
      run_result: {
        status: 'failed',
        run_mode: 'commit'
      },
      eval_payload: {
        trace_id: 'trace-run-rules',
        scene_ref: 'scene.warehouse.pick',
        scene_version: '0.2.0',
        status: 'failed',
        metrics: {
          cycle_time_ms: 1600,
          manual_takeover_rate: 0.22,
          policy_violation_count: 1,
          node_failure_count: 1
        }
      }
    };

    const fileSystem = {
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/results/run-result-rules.json') {
          return runResultPayload;
        }

        if (normalizedPath === '/workspace/.kiro/config/custom-profile-rules.json') {
          return {
            domain_aliases: {
              warehouse: 'erp'
            }
          };
        }

        throw new Error(`unexpected readJson path: ${normalizedPath}`);
      }),
      writeFile: jest.fn().mockResolvedValue(),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const report = await runSceneEvalCommand({
      result: '.kiro/results/run-result-rules.json',
      profileRules: '.kiro/config/custom-profile-rules.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(report.inputs).toMatchObject({
      profile: 'erp',
      profile_source: 'result:scene_ref',
      profile_rules: '.kiro/config/custom-profile-rules.json',
      profile_rules_source: '.kiro/config/custom-profile-rules.json'
    });
    expect(report.inputs.profile_warnings).toEqual([]);
  });

  test('runSceneEvalCommand applies unified eval config with env profile', async () => {
    const runResultPayload = {
      scene_ref: 'scene.hybrid.pick',
      scene_version: '0.2.0',
      trace_id: 'trace-run-3',
      run_mode: 'commit',
      run_result: {
        status: 'failed',
        run_mode: 'commit'
      },
      eval_payload: {
        trace_id: 'trace-run-3',
        scene_ref: 'scene.hybrid.pick',
        scene_version: '0.2.0',
        status: 'failed',
        metrics: {
          cycle_time_ms: 2200,
          manual_takeover_rate: 0.3,
          policy_violation_count: 1,
          node_failure_count: 1
        }
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        return normalizedPath === '/workspace/.kiro/specs/37-00-scene-runtime-execution-pilot/tasks.md';
      }),
      readFile: jest.fn().mockResolvedValue(`# Implementation Plan: Demo

## Tasks

- [x] 1 Baseline task
`),
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/results/run-result-failed-env.json') {
          return runResultPayload;
        }

        if (normalizedPath === '/workspace/.kiro/results/eval-config.json') {
          return {
            target: {
              max_cycle_time_ms: 2600,
              max_manual_takeover_rate: 0.35
            },
            task_sync_policy: {
              default_priority: 'medium'
            },
            envs: {
              prod: {
                target: {
                  max_cycle_time_ms: 1600,
                  max_manual_takeover_rate: 0.15
                },
                task_sync_policy: {
                  default_priority: 'high',
                  priority_by_grade: {
                    critical: 'critical'
                  },
                  keyword_priority_overrides: [
                    {
                      pattern: 'failed runtime nodes',
                      priority: 'critical'
                    }
                  ]
                }
              }
            }
          };
        }

        throw new Error(`unexpected readJson path: ${normalizedPath}`);
      }),
      writeFile: jest.fn().mockResolvedValue(),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const report = await runSceneEvalCommand({
      result: '.kiro/results/run-result-failed-env.json',
      evalConfig: '.kiro/results/eval-config.json',
      env: 'prod',
      spec: '37-00-scene-runtime-execution-pilot',
      syncSpecTasks: true,
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(report.target).toMatchObject({
      max_cycle_time_ms: 1600,
      max_manual_takeover_rate: 0.15
    });
    expect(report.inputs).toMatchObject({
      eval_config: '.kiro/results/eval-config.json',
      env: 'prod',
      profile: 'robot',
      profile_source: 'result:scene_ref'
    });
    expect(report.task_sync.policy_source).toBe('eval-config:eval-config.json#prod');

    const syncedTasks = fileSystem.writeFile.mock.calls[fileSystem.writeFile.mock.calls.length - 1][1];
    expect(syncedTasks).toContain('[critical] Investigate failed runtime nodes and compensation logs.');
    expect(syncedTasks).toContain('policy_source=eval-config:eval-config.json#prod');
  });

  test('runSceneEvalPolicyTemplateCommand writes default policy template', async () => {
    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const summary = await runSceneEvalPolicyTemplateCommand({
      out: '.kiro/results/eval-policy-template.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(summary).toMatchObject({
      created: true,
      overwritten: false,
      output_path: '.kiro/results/eval-policy-template.json'
    });

    expect(fileSystem.writeJson).toHaveBeenCalledTimes(1);
    const policyPayload = fileSystem.writeJson.mock.calls[0][1];
    expect(policyPayload).toHaveProperty('default_priority');
    expect(policyPayload).toHaveProperty('priority_by_grade');
    expect(policyPayload).toHaveProperty('keyword_priority_overrides');
  });

  test('runSceneEvalConfigTemplateCommand writes unified config template', async () => {
    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const summary = await runSceneEvalConfigTemplateCommand({
      out: '.kiro/results/eval-config-template.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(summary).toMatchObject({
      created: true,
      overwritten: false,
      profile: 'default',
      output_path: '.kiro/results/eval-config-template.json'
    });

    expect(fileSystem.writeJson).toHaveBeenCalledTimes(1);
    const configPayload = fileSystem.writeJson.mock.calls[0][1];
    expect(configPayload).toHaveProperty('target');
    expect(configPayload).toHaveProperty('task_sync_policy');
    expect(configPayload).toHaveProperty('envs');
    expect(configPayload.envs).toHaveProperty('dev');
    expect(configPayload.envs).toHaveProperty('staging');
    expect(configPayload.envs).toHaveProperty('prod');
  });

  test('runSceneEvalConfigTemplateCommand applies ops profile template', async () => {
    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const summary = await runSceneEvalConfigTemplateCommand({
      out: '.kiro/results/eval-config-ops-template.json',
      profile: 'ops',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(summary.profile).toBe('ops');

    const configPayload = fileSystem.writeJson.mock.calls[0][1];
    expect(configPayload.target.max_cycle_time_ms).toBe(1800);
    expect(configPayload.task_sync_policy.default_priority).toBe('high');

    const overrides = configPayload.task_sync_policy.keyword_priority_overrides || [];
    expect(overrides.some((item) => item.pattern.includes('incident'))).toBe(true);
  });

  test('runSceneEvalConfigTemplateCommand rejects unsupported profile', async () => {
    const result = await runSceneEvalConfigTemplateCommand({
      out: '.kiro/results/eval-config-bad-template.json',
      profile: 'finance',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem: {
        pathExists: jest.fn(),
        ensureDir: jest.fn(),
        writeJson: jest.fn()
      }
    });

    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  test('runSceneEvalProfileRulesTemplateCommand writes profile rules template', async () => {
    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const summary = await runSceneEvalProfileRulesTemplateCommand({
      out: '.kiro/results/eval-profile-rules-template.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(summary).toMatchObject({
      created: true,
      overwritten: false,
      output_path: '.kiro/results/eval-profile-rules-template.json'
    });
    expect(summary.rules).toMatchObject({
      domain_aliases: {
        hybrid: 'robot'
      }
    });

    expect(normalizePath(fileSystem.ensureDir.mock.calls[0][0])).toBe('/workspace/.kiro/results');

    const writeCall = fileSystem.writeJson.mock.calls[0];
    expect(normalizePath(writeCall[0])).toBe('/workspace/.kiro/results/eval-profile-rules-template.json');
    expect(writeCall[1]).toEqual(expect.objectContaining({
      domain_aliases: expect.objectContaining({
        erp: 'erp',
        ops: 'ops',
        robot: 'robot'
      })
    }));
    expect(writeCall[2]).toEqual({ spaces: 2 });
  });

  test('runSceneRoutePolicyTemplateCommand writes profile-based route policy template', async () => {
    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const summary = await runSceneRoutePolicyTemplateCommand({
      out: '.kiro/results/route-policy-template.json',
      profile: 'hybrid',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(summary).toMatchObject({
      created: true,
      overwritten: false,
      profile: 'hybrid',
      output_path: '.kiro/results/route-policy-template.json'
    });

    const routePolicy = fileSystem.writeJson.mock.calls[0][1];
    expect(routePolicy).toMatchObject({
      weights: {
        query_token_match: 10
      },
      mode_bias: {
        commit: {
          high: -8
        }
      },
      max_alternatives: 6
    });
  });

  test('runSceneCatalogCommand builds filtered catalog and writes output', async () => {
    const dirent = (name, type) => ({
      name,
      isDirectory: () => type === 'dir',
      isFile: () => type === 'file'
    });

    const fileSystem = {
      readdir: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/specs') {
          return [
            dirent('36-00-scene-contract-kind-model', 'dir'),
            dirent('37-00-scene-runtime-execution-pilot', 'dir'),
            dirent('SPEC_WORKFLOW_GUIDE.md', 'file')
          ];
        }

        throw new Error(`unexpected readdir path: ${normalizedPath}`);
      }),
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath.endsWith('/36-00-scene-contract-kind-model/custom/scene.yaml')) {
          return true;
        }

        if (normalizedPath.endsWith('/37-00-scene-runtime-execution-pilot/custom/scene.yaml')) {
          return true;
        }

        return false;
      }),
      readFile: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);

        if (normalizedPath.endsWith('/36-00-scene-contract-kind-model/custom/scene.yaml')) {
          return [
            'apiVersion: kse.scene/v0.2',
            'kind: scene',
            'metadata:',
            '  obj_id: scene.erp.order.query',
            '  obj_version: 0.2.0',
            '  title: ERP Order Query',
            'spec:',
            '  domain: erp',
            '  intent:',
            '    goal: Query ERP order',
            '  capability_contract:',
            '    bindings:',
            '      - type: query',
            '        ref: spec.erp.order-query',
            '  governance_contract:',
            '    risk_level: low'
          ].join('\n');
        }

        if (normalizedPath.endsWith('/37-00-scene-runtime-execution-pilot/custom/scene.yaml')) {
          return [
            'apiVersion: kse.scene/v0.2',
            'kind: scene',
            'metadata:',
            '  obj_id: scene.robot.shadow.run',
            '  obj_version: 0.2.0',
            '  title: Robot Shadow Run',
            'spec:',
            '  domain: robot',
            '  intent:',
            '    goal: Simulate robot path',
            '  capability_contract:',
            '    bindings:',
            '      - type: command',
            '        ref: spec.robot.shadow',
            '  governance_contract:',
            '    risk_level: medium'
          ].join('\n');
        }

        throw new Error(`unexpected readFile path: ${normalizedPath}`);
      }),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const catalog = await runSceneCatalogCommand({
      domain: 'erp',
      out: '.kiro/results/scene-catalog.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(catalog.summary).toMatchObject({
      specs_scanned: 2,
      manifests_discovered: 2,
      entries_returned: 1,
      valid_entries: 1,
      invalid_entries: 0
    });
    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0]).toMatchObject({
      spec: '36-00-scene-contract-kind-model',
      scene_ref: 'scene.erp.order.query',
      domain: 'erp',
      valid: true
    });

    expect(normalizePath(fileSystem.ensureDir.mock.calls[0][0])).toBe('/workspace/.kiro/results');
    expect(normalizePath(fileSystem.writeJson.mock.calls[0][0])).toBe('/workspace/.kiro/results/scene-catalog.json');
  });

  test('runSceneCatalogCommand includes invalid entries when requested', async () => {
    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);

        if (normalizedPath === '/workspace/.kiro/specs/37-00-scene-runtime-execution-pilot') {
          return true;
        }

        if (normalizedPath.endsWith('/37-00-scene-runtime-execution-pilot/custom/scene.yaml')) {
          return true;
        }

        return false;
      }),
      readFile: jest.fn().mockResolvedValue([
        'apiVersion: bad',
        'kind: scene',
        'metadata: {}',
        'spec:',
        '  domain: unknown'
      ].join('\n')),
      readdir: jest.fn().mockResolvedValue([]),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const catalog = await runSceneCatalogCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      includeInvalid: true,
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(catalog.summary).toMatchObject({
      specs_scanned: 1,
      manifests_discovered: 1,
      entries_returned: 1,
      valid_entries: 0,
      invalid_entries: 1
    });
    expect(catalog.entries[0].valid).toBe(false);
    expect(catalog.entries[0].errors.length).toBeGreaterThan(0);
  });

  test('runSceneRouteCommand selects exact scene_ref and emits commands', async () => {
    const dirent = (name, type) => ({
      name,
      isDirectory: () => type === 'dir',
      isFile: () => type === 'file'
    });

    const fileSystem = {
      readdir: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/specs') {
          return [
            dirent('36-00-scene-contract-kind-model', 'dir'),
            dirent('37-00-scene-runtime-execution-pilot', 'dir')
          ];
        }

        throw new Error(`unexpected readdir path: ${normalizedPath}`);
      }),
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath.endsWith('/36-00-scene-contract-kind-model/custom/scene.yaml')) {
          return true;
        }

        if (normalizedPath.endsWith('/37-00-scene-runtime-execution-pilot/custom/scene.yaml')) {
          return true;
        }

        return false;
      }),
      readFile: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath.endsWith('/36-00-scene-contract-kind-model/custom/scene.yaml')) {
          return [
            'apiVersion: kse.scene/v0.2',
            'kind: scene',
            'metadata:',
            '  obj_id: scene.erp.order.query',
            '  obj_version: 0.2.0',
            '  title: ERP Order Query',
            'spec:',
            '  domain: erp',
            '  intent:',
            '    goal: Query ERP order',
            '  capability_contract:',
            '    bindings:',
            '      - type: query',
            '        ref: spec.erp.order-query',
            '  governance_contract:',
            '    risk_level: low'
          ].join('\n');
        }

        if (normalizedPath.endsWith('/37-00-scene-runtime-execution-pilot/custom/scene.yaml')) {
          return [
            'apiVersion: kse.scene/v0.2',
            'kind: scene',
            'metadata:',
            '  obj_id: scene.hybrid.pick.shadow',
            '  obj_version: 0.2.0',
            '  title: Hybrid Pick Shadow',
            'spec:',
            '  domain: hybrid',
            '  intent:',
            '    goal: Simulate hybrid pick',
            '  capability_contract:',
            '    bindings:',
            '      - type: adapter',
            '        ref: spec.robot.shadow',
            '  governance_contract:',
            '    risk_level: high'
          ].join('\n');
        }

        throw new Error(`unexpected readFile path: ${normalizedPath}`);
      }),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const route = await runSceneRouteCommand({
      sceneRef: 'scene.erp.order.query',
      mode: 'dry_run',
      out: '.kiro/results/scene-route.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(route.summary).toMatchObject({
      candidates_scored: 2,
      selected_scene_ref: 'scene.erp.order.query',
      tie_detected: false
    });
    expect(route.selected).toMatchObject({
      scene_ref: 'scene.erp.order.query',
      spec: '36-00-scene-contract-kind-model'
    });
    expect(route.selected.commands).toMatchObject({
      validate: 'kse scene validate --spec 36-00-scene-contract-kind-model --spec-manifest custom/scene.yaml',
      doctor: 'kse scene doctor --spec 36-00-scene-contract-kind-model --spec-manifest custom/scene.yaml --mode dry_run',
      run: 'kse scene run --spec 36-00-scene-contract-kind-model --spec-manifest custom/scene.yaml --mode dry_run'
    });
    expect(normalizePath(fileSystem.writeJson.mock.calls[0][0])).toBe('/workspace/.kiro/results/scene-route.json');
  });

  test('runSceneRouteCommand applies custom route policy file', async () => {
    const dirent = (name, type) => ({
      name,
      isDirectory: () => type === 'dir',
      isFile: () => type === 'file'
    });

    const fileSystem = {
      readdir: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/specs') {
          return [
            dirent('61-00-scene-catalog-discovery-and-routing', 'dir'),
            dirent('63-00-scene-routing-decision-layer', 'dir')
          ];
        }

        throw new Error(`unexpected readdir path: ${normalizedPath}`);
      }),
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        return normalizedPath.endsWith('/custom/scene.yaml');
      }),
      readFile: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        const isCatalog = normalizedPath.includes('61-00-scene-catalog-discovery-and-routing');
        return [
          'apiVersion: kse.scene/v0.2',
          'kind: scene',
          'metadata:',
          `  obj_id: ${isCatalog ? 'scene.erp.catalog.routing' : 'scene.erp.routing.layer'}`,
          '  obj_version: 0.2.0',
          `  title: ${isCatalog ? 'Catalog Routing' : 'Routing Layer'}`,
          'spec:',
          '  domain: erp',
          '  intent:',
          '    goal: Route scene',
          '  capability_contract:',
          '    bindings:',
          '      - type: query',
          '        ref: spec.erp.query',
          '  governance_contract:',
          '    risk_level: low'
        ].join('\n');
      }),
      readJson: jest.fn().mockResolvedValue({
        weights: {
          query_token_match: 0
        },
        max_alternatives: 1
      }),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const route = await runSceneRouteCommand({
      query: 'routing',
      routePolicy: '.kiro/config/scene-route-policy.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(route.route_policy_source).toBe('.kiro/config/scene-route-policy.json');
    expect(route.route_policy).toMatchObject({
      weights: {
        query_token_match: 0
      },
      max_alternatives: 1
    });
    expect(route.alternatives.length).toBeLessThanOrEqual(1);
    expect(normalizePath(fileSystem.readJson.mock.calls[0][0])).toBe('/workspace/.kiro/config/scene-route-policy.json');
  });

  test('runSceneRouteCommand fails when top candidates tie and requireUnique is true', async () => {
    const dirent = (name, type) => ({
      name,
      isDirectory: () => type === 'dir',
      isFile: () => type === 'file'
    });

    const fileSystem = {
      readdir: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/specs') {
          return [
            dirent('36-00-scene-contract-kind-model', 'dir'),
            dirent('38-00-scene-runtime-cli-integration', 'dir')
          ];
        }

        throw new Error(`unexpected readdir path: ${normalizedPath}`);
      }),
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        return normalizedPath.endsWith('/custom/scene.yaml');
      }),
      readFile: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        const isFirst = normalizedPath.includes('36-00-scene-contract-kind-model');
        return [
          'apiVersion: kse.scene/v0.2',
          'kind: scene',
          'metadata:',
          `  obj_id: ${isFirst ? 'scene.erp.order.one' : 'scene.erp.order.two'}`,
          '  obj_version: 0.2.0',
          `  title: ${isFirst ? 'Order One' : 'Order Two'}`,
          'spec:',
          '  domain: erp',
          '  intent:',
          '    goal: Query order',
          '  capability_contract:',
          '    bindings:',
          '      - type: query',
          '        ref: spec.erp.order-query',
          '  governance_contract:',
          '    risk_level: low'
        ].join('\n');
      }),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const route = await runSceneRouteCommand({
      query: 'order',
      requireUnique: true,
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(route).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  test('runSceneRoutePolicySuggestCommand tunes policy from eval reports and writes outputs', async () => {
    const fileSystem = {
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);

        if (normalizedPath === '/workspace/.kiro/config/scene-route-policy.json') {
          return {
            weights: {
              scene_ref_mismatch: -12,
              invalid_manifest: -8
            },
            mode_bias: {
              commit: {
                high: -4,
                critical: -6
              }
            },
            max_alternatives: 4
          };
        }

        if (normalizedPath === '/workspace/.kiro/results/eval-critical.json') {
          return {
            scene_ref: 'scene.hybrid.pick.critical',
            run_evaluation: {
              status: 'failed'
            },
            overall: {
              grade: 'critical',
              recommendations: [
                'Resolve policy denial causes before commit rerun.',
                'Investigate failed runtime nodes and compensation logs.'
              ]
            },
            inputs: {
              profile: 'hybrid'
            }
          };
        }

        if (normalizedPath === '/workspace/.kiro/results/eval-at-risk.json') {
          return {
            scene_ref: 'scene.hybrid.pick.watch',
            run_evaluation: {
              status: 'denied'
            },
            overall: {
              grade: 'at_risk',
              recommendations: [
                'Resolve policy denial causes before commit rerun.'
              ]
            },
            inputs: {
              profile: 'hybrid'
            }
          };
        }

        throw new Error(`unexpected readJson path: ${normalizedPath}`);
      }),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const payload = await runSceneRoutePolicySuggestCommand({
      eval: ['.kiro/results/eval-critical.json', '.kiro/results/eval-at-risk.json'],
      routePolicy: '.kiro/config/scene-route-policy.json',
      maxAdjustment: 6,
      out: '.kiro/results/route-policy-suggest.json',
      policyOut: '.kiro/results/route-policy-suggested.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.baseline.source).toBe('.kiro/config/scene-route-policy.json');
    expect(payload.adjustments.length).toBeGreaterThan(0);
    expect(payload.suggested_policy.mode_bias.commit.high).toBeLessThan(-4);
    expect(payload.suggested_policy.weights.scene_ref_mismatch).toBeLessThan(-12);

    expect(normalizePath(fileSystem.writeJson.mock.calls[0][0])).toBe('/workspace/.kiro/results/route-policy-suggest.json');
    expect(normalizePath(fileSystem.writeJson.mock.calls[1][0])).toBe('/workspace/.kiro/results/route-policy-suggested.json');
  });

  test('runSceneRoutePolicySuggestCommand discovers eval reports from directory and infers baseline profile', async () => {
    const dirent = (name, type) => ({
      name,
      isDirectory: () => type === 'dir',
      isFile: () => type === 'file'
    });

    const fileSystem = {
      readdir: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);

        if (normalizedPath === '/workspace/.kiro/results') {
          return [
            dirent('eval-hybrid-1.json', 'file'),
            dirent('eval-hybrid-2.json', 'file'),
            dirent('notes.md', 'file'),
            dirent('archive', 'dir')
          ];
        }

        throw new Error(`unexpected readdir path: ${normalizedPath}`);
      }),
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);

        if (normalizedPath === '/workspace/.kiro/results/eval-hybrid-1.json') {
          return {
            scene_ref: 'scene.hybrid.pick.route-one',
            run_evaluation: {
              status: 'success'
            },
            overall: {
              grade: 'insufficient_data',
              recommendations: []
            },
            inputs: {
              profile: 'hybrid'
            }
          };
        }

        if (normalizedPath === '/workspace/.kiro/results/eval-hybrid-2.json') {
          return {
            scene_ref: 'scene.hybrid.pick.route-two',
            run_evaluation: {
              status: 'success'
            },
            overall: {
              grade: 'watch',
              recommendations: ['Manual takeover observed in shadow run']
            },
            inputs: {
              profile: 'hybrid'
            }
          };
        }

        throw new Error(`unexpected readJson path: ${normalizedPath}`);
      }),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const payload = await runSceneRoutePolicySuggestCommand({
      evalDir: '.kiro/results',
      maxAdjustment: 4,
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.analysis.total_reports).toBe(2);
    expect(payload.baseline.source).toBe('profile:auto:hybrid');
    expect(payload.suggested_policy.weights.query_token_match).toBeGreaterThan(10);
    expect(payload.eval_reports).toHaveLength(2);
    expect(payload.eval_reports[0].source_path).toContain('.kiro/results/');
  });

  test('runSceneRoutePolicySuggestCommand fails when eval directory resolves no JSON reports', async () => {
    const dirent = (name, type) => ({
      name,
      isDirectory: () => type === 'dir',
      isFile: () => type === 'file'
    });

    const fileSystem = {
      readdir: jest.fn().mockResolvedValue([
        dirent('notes.md', 'file'),
        dirent('archive', 'dir')
      ]),
      readJson: jest.fn(),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const payload = await runSceneRoutePolicySuggestCommand({
      evalDir: '.kiro/results',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  test('runSceneRoutePolicyRolloutCommand builds rollout package from suggestion payload', async () => {
    const fileSystem = {
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);

        if (normalizedPath === '/workspace/.kiro/results/route-policy-suggest.json') {
          return {
            baseline: {
              source: '.kiro/config/scene-route-policy.json',
              policy: {
                weights: {
                  scene_ref_mismatch: -12
                },
                mode_bias: {
                  commit: {
                    high: -4
                  }
                },
                max_alternatives: 4
              }
            },
            suggested_policy: {
              weights: {
                scene_ref_mismatch: -18
              },
              mode_bias: {
                commit: {
                  high: -9
                }
              },
              max_alternatives: 5
            },
            analysis: {
              total_reports: 3
            },
            adjustments: [
              { path: 'mode_bias.commit.high', from: -4, to: -9, delta: -5 }
            ]
          };
        }

        throw new Error(`unexpected readJson path: ${normalizedPath}`);
      }),
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue(),
      writeFile: jest.fn().mockResolvedValue()
    };

    const payload = await runSceneRoutePolicyRolloutCommand({
      suggestion: '.kiro/results/route-policy-suggest.json',
      targetPolicy: '.kiro/config/scene-route-policy.json',
      outDir: '.kiro/releases/scene-route-policy',
      name: 'Wave 01',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.rollout_name).toBe('wave-01');
    expect(payload.summary).toMatchObject({
      changed_fields: 3
    });
    expect(payload.files.next_policy).toContain('route-policy.next.json');
    expect(payload.files.rollback_policy).toContain('route-policy.rollback.json');
    expect(payload.files.plan).toContain('rollout-plan.json');
    expect(payload.files.runbook).toContain('runbook.md');

    const writeJsonTargets = fileSystem.writeJson.mock.calls.map((call) => normalizePath(call[0]));
    expect(writeJsonTargets).toContain('/workspace/.kiro/releases/scene-route-policy/wave-01/route-policy.next.json');
    expect(writeJsonTargets).toContain('/workspace/.kiro/releases/scene-route-policy/wave-01/route-policy.rollback.json');
    expect(writeJsonTargets).toContain('/workspace/.kiro/releases/scene-route-policy/wave-01/rollout-plan.json');

    expect(normalizePath(fileSystem.writeFile.mock.calls[0][0]))
      .toBe('/workspace/.kiro/releases/scene-route-policy/wave-01/runbook.md');
  });

  test('runSceneRoutePolicyRolloutCommand fails when suggestion payload misses policies', async () => {
    const fileSystem = {
      readJson: jest.fn().mockResolvedValue({ baseline: { source: 'x' } }),
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn(),
      writeJson: jest.fn(),
      writeFile: jest.fn()
    };

    const payload = await runSceneRoutePolicyRolloutCommand({
      suggestion: '.kiro/results/route-policy-suggest.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  test('runScenePackageTemplateCommand creates contract in spec context', async () => {
    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const payload = await runScenePackageTemplateCommand({
      spec: '67-00-scene-package-contract-declaration',
      kind: 'scene-domain-profile',
      group: 'kse.scene',
      pkgVersion: '0.2.0',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.output_path).toBe('.kiro/specs/67-00-scene-package-contract-declaration/custom/scene-package.json');
    expect(payload.summary).toMatchObject({
      kind: 'scene-domain-profile'
    });

    const writeCall = fileSystem.writeJson.mock.calls[0];
    expect(normalizePath(writeCall[0]))
      .toBe('/workspace/.kiro/specs/67-00-scene-package-contract-declaration/custom/scene-package.json');
    expect(writeCall[1]).toMatchObject({
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-domain-profile',
      metadata: {
        group: 'kse.scene',
        version: '0.2.0'
      }
    });
  });

  test('runScenePackageValidateCommand reports invalid contract with non-zero exit code', async () => {
    const fileSystem = {
      readJson: jest.fn().mockResolvedValue({
        apiVersion: 'kse.scene.package/v0.1',
        kind: 'scene-template'
      })
    };

    const payload = await runScenePackageValidateCommand({
      package: '.kiro/templates/scene-package.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.valid).toBe(false);
    expect(payload.errors.length).toBeGreaterThan(0);
    expect(process.exitCode).toBe(1);
  });

  test('runScenePackagePublishCommand publishes template assets', async () => {
    const contract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'erp-order-query',
        version: '0.2.0'
      },
      compatibility: {
        kse_version: '>=1.24.0',
        scene_api_version: 'kse.scene/v0.2'
      },
      capabilities: {
        provides: ['scene.erp.query'],
        requires: ['binding:http']
      },
      parameters: [
        { id: 'entity_name', type: 'string', required: true },
        { id: 'service_name', type: 'string', required: false, default: 'queryService' }
      ],
      artifacts: {
        entry_scene: 'custom/scene.yaml',
        generates: ['requirements.md', 'design.md', 'tasks.md', 'custom/scene.yaml']
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized === '/workspace/.kiro/specs/67-00-scene-package-contract-declaration') {
          return true;
        }
        if (normalized === '/workspace/.kiro/specs/67-00-scene-package-contract-declaration/custom/scene.yaml') {
          return true;
        }
        if (normalized === '/workspace/.kiro/templates/scene-packages/kse.scene--erp-order-query--0.2.0') {
          return false;
        }
        return false;
      }),
      readJson: jest.fn().mockResolvedValue(contract),
      readFile: jest.fn().mockResolvedValue('apiVersion: kse.scene/v0.2\nmetadata:\n  obj_id: scene.erp.{{entity_name}}\n'),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue(),
      writeFile: jest.fn().mockResolvedValue()
    };

    const payload = await runScenePackagePublishCommand({
      spec: '67-00-scene-package-contract-declaration',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.template.id).toBe('kse.scene--erp-order-query--0.2.0');
    expect(payload.template.output_dir).toBe('.kiro/templates/scene-packages/kse.scene--erp-order-query--0.2.0');

    const writeJsonTargets = fileSystem.writeJson.mock.calls.map((call) => normalizePath(call[0]));
    expect(writeJsonTargets).toContain('/workspace/.kiro/templates/scene-packages/kse.scene--erp-order-query--0.2.0/template.manifest.json');
    expect(writeJsonTargets).toContain('/workspace/.kiro/templates/scene-packages/kse.scene--erp-order-query--0.2.0/scene-package.json');

    expect(normalizePath(fileSystem.writeFile.mock.calls[0][0]))
      .toBe('/workspace/.kiro/templates/scene-packages/kse.scene--erp-order-query--0.2.0/scene.template.yaml');
  });

  test('runScenePackageInstantiateCommand instantiates spec from template', async () => {
    const contract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'erp-order-query',
        version: '0.2.0'
      },
      compatibility: {
        kse_version: '>=1.24.0',
        scene_api_version: 'kse.scene/v0.2'
      },
      capabilities: {
        provides: ['scene.erp.query'],
        requires: ['binding:http']
      },
      parameters: [
        { id: 'entity_name', type: 'string', required: true },
        { id: 'service_name', type: 'string', required: false, default: 'queryService' }
      ],
      artifacts: {
        entry_scene: 'custom/scene.yaml',
        generates: ['requirements.md', 'design.md', 'tasks.md', 'custom/scene.yaml']
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const fileSystem = {
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized.endsWith('/template.manifest.json')) {
          return {
            apiVersion: 'kse.scene.template/v0.1',
            kind: 'scene-package-template',
            metadata: {
              template_id: 'kse.scene--erp-order-query--0.2.0'
            },
            template: {
              package_contract: 'scene-package.json',
              scene_manifest: 'scene.template.yaml'
            }
          };
        }
        if (normalized.endsWith('/scene-package.json')) {
          return contract;
        }
        if (normalized.endsWith('/values.json')) {
          return { entity_name: 'Project' };
        }

        throw new Error(`unexpected readJson path: ${targetPath}`);
      }),
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized.endsWith('/scene.template.yaml')) {
          return true;
        }
        if (normalized.endsWith('/.kiro/specs/68-00-scene-package-template-publish-and-instantiate/custom/scene.yaml')) {
          return false;
        }
        if (normalized.endsWith('/.kiro/specs/68-00-scene-package-template-publish-and-instantiate/custom/scene-package.json')) {
          return false;
        }

        return false;
      }),
      readFile: jest.fn().mockResolvedValue('apiVersion: kse.scene/v0.2\nmetadata:\n  obj_id: scene.erp.{{ entity_name }}\nspec:\n  service: ${service_name}\n'),
      ensureDir: jest.fn().mockResolvedValue(),
      writeFile: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const payload = await runScenePackageInstantiateCommand({
      template: '.kiro/templates/scene-packages/kse.scene--erp-order-query--0.2.0/template.manifest.json',
      targetSpec: '68-00-scene-package-template-publish-and-instantiate',
      values: '.kiro/templates/scene-packages/kse.scene--erp-order-query--0.2.0/values.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.instantiated).toBe(true);
    expect(payload.parameters).toMatchObject({
      entity_name: 'Project',
      service_name: 'queryService'
    });

    expect(normalizePath(fileSystem.writeFile.mock.calls[0][0]))
      .toBe('/workspace/.kiro/specs/68-00-scene-package-template-publish-and-instantiate/custom/scene.yaml');
    expect(fileSystem.writeFile.mock.calls[0][1]).toContain('scene.erp.Project');
    expect(fileSystem.writeFile.mock.calls[0][1]).toContain('queryService');

    expect(normalizePath(fileSystem.writeJson.mock.calls[0][0]))
      .toBe('/workspace/.kiro/specs/68-00-scene-package-template-publish-and-instantiate/custom/scene-package.json');
    expect(fileSystem.writeJson.mock.calls[0][1].metadata.name)
      .toBe('scene-package-template-publish-and-instantiate');
  });

  test('runScenePackageInstantiateCommand fails when required parameter is missing', async () => {
    const contract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'erp-order-query',
        version: '0.2.0'
      },
      compatibility: {
        kse_version: '>=1.24.0',
        scene_api_version: 'kse.scene/v0.2'
      },
      capabilities: {
        provides: ['scene.erp.query'],
        requires: ['binding:http']
      },
      parameters: [
        { id: 'entity_name', type: 'string', required: true }
      ],
      artifacts: {
        entry_scene: 'custom/scene.yaml',
        generates: ['custom/scene.yaml']
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const fileSystem = {
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized.endsWith('/template.manifest.json')) {
          return {
            apiVersion: 'kse.scene.template/v0.1',
            template: {
              package_contract: 'scene-package.json',
              scene_manifest: 'scene.template.yaml'
            }
          };
        }
        if (normalized.endsWith('/scene-package.json')) {
          return contract;
        }
        throw new Error(`unexpected readJson path: ${targetPath}`);
      }),
      pathExists: jest.fn().mockResolvedValue(false),
      readFile: jest.fn(),
      ensureDir: jest.fn(),
      writeFile: jest.fn(),
      writeJson: jest.fn()
    };

    const payload = await runScenePackageInstantiateCommand({
      template: '.kiro/templates/scene-packages/kse.scene--erp-order-query--0.2.0/template.manifest.json',
      targetSpec: '68-00-scene-package-template-publish-and-instantiate',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
    expect(fileSystem.writeJson).not.toHaveBeenCalled();
  });

  test('runScenePackageRegistryCommand builds template registry with layer summary', async () => {
    const validTemplateManifest = {
      apiVersion: 'kse.scene.template/v0.1',
      kind: 'scene-package-template',
      metadata: {
        template_id: 'kse.scene--erp-order-query--0.2.0',
        source_spec: '67-00-scene-package-contract-declaration',
        package_coordinate: 'kse.scene/erp-order-query@0.2.0',
        package_kind: 'scene-template'
      },
      template: {
        package_contract: 'scene-package.json',
        scene_manifest: 'scene.template.yaml'
      },
      parameters: []
    };

    const validContract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'erp-order-query',
        version: '0.2.0'
      },
      compatibility: {
        kse_version: '>=1.24.0',
        scene_api_version: 'kse.scene/v0.2'
      },
      capabilities: {
        provides: ['scene.erp.query'],
        requires: ['binding:http']
      },
      parameters: [],
      artifacts: {
        entry_scene: 'custom/scene.yaml',
        generates: ['custom/scene.yaml']
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized === '/workspace/.kiro/templates/scene-packages') {
          return true;
        }
        if (normalized.endsWith('/kse.scene--erp-order-query--0.2.0/template.manifest.json')) {
          return true;
        }
        if (normalized.endsWith('/kse.scene--erp-order-query--0.2.0/scene-package.json')) {
          return true;
        }
        if (normalized.endsWith('/broken-template/template.manifest.json')) {
          return true;
        }
        if (normalized.endsWith('/broken-template/scene-package.json')) {
          return false;
        }
        return false;
      }),
      readdir: jest.fn().mockResolvedValue(['kse.scene--erp-order-query--0.2.0', 'broken-template']),
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized.endsWith('/kse.scene--erp-order-query--0.2.0/template.manifest.json')) {
          return validTemplateManifest;
        }
        if (normalized.endsWith('/kse.scene--erp-order-query--0.2.0/scene-package.json')) {
          return validContract;
        }
        if (normalized.endsWith('/broken-template/template.manifest.json')) {
          return {
            apiVersion: 'kse.scene.template/v0.0',
            kind: 'bad-kind',
            metadata: {},
            template: {}
          };
        }

        throw new Error(`unexpected readJson path: ${targetPath}`);
      }),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const payload = await runScenePackageRegistryCommand({
      templateDir: '.kiro/templates/scene-packages',
      out: '.kiro/reports/scene-package-registry.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.summary).toMatchObject({
      total_templates: 2,
      valid_templates: 1,
      invalid_templates: 1
    });
    expect(payload.summary.layer_counts.l3_instance).toBe(1);
    expect(payload.templates[0].template_id).toBe('broken-template');
    expect(payload.output_path).toBe('.kiro/reports/scene-package-registry.json');
    expect(normalizePath(fileSystem.writeJson.mock.calls[0][0]))
      .toBe('/workspace/.kiro/reports/scene-package-registry.json');
  });

  test('runScenePackageRegistryCommand sets non-zero exit code in strict mode', async () => {
    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized === '/workspace/.kiro/templates/scene-packages') {
          return true;
        }
        if (normalized.endsWith('/broken-template/template.manifest.json')) {
          return true;
        }
        if (normalized.endsWith('/broken-template/scene-package.json')) {
          return false;
        }
        return false;
      }),
      readdir: jest.fn().mockResolvedValue(['broken-template']),
      readJson: jest.fn().mockResolvedValue({
        apiVersion: 'kse.scene.template/v0.0',
        kind: 'bad-kind',
        metadata: {},
        template: {}
      }),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const payload = await runScenePackageRegistryCommand({
      templateDir: '.kiro/templates/scene-packages',
      strict: true,
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.summary.invalid_templates).toBe(1);
    expect(process.exitCode).toBe(1);
  });

  test('runScenePackageGateTemplateCommand writes three-layer policy template', async () => {
    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const payload = await runScenePackageGateTemplateCommand({
      out: '.kiro/templates/scene-package-gate-policy.json',
      profile: 'three-layer',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.profile).toBe('three-layer');
    expect(payload.policy.rules.required_layers).toEqual(['l1-capability', 'l2-domain', 'l3-instance']);
    expect(normalizePath(fileSystem.writeJson.mock.calls[0][0]))
      .toBe('/workspace/.kiro/templates/scene-package-gate-policy.json');
  });

  test('runScenePackageGateCommand evaluates pass result and writes output', async () => {
    const registryPayload = {
      summary: {
        total_templates: 3,
        valid_templates: 3,
        invalid_templates: 0,
        layer_counts: {
          l1_capability: 1,
          l2_domain: 1,
          l3_instance: 1,
          unknown: 0
        }
      }
    };

    const policyPayload = {
      apiVersion: 'kse.scene.package-gate/v0.1',
      profile: 'three-layer',
      rules: {
        max_invalid_templates: 0,
        min_valid_templates: 3,
        required_layers: ['l1-capability', 'l2-domain', 'l3-instance'],
        forbid_unknown_layer: true
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized.endsWith('/scene-package-registry.json')) {
          return registryPayload;
        }
        if (normalized.endsWith('/scene-package-gate-policy.json')) {
          return policyPayload;
        }
        throw new Error(`unexpected readJson path: ${targetPath}`);
      }),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const payload = await runScenePackageGateCommand({
      registry: '.kiro/reports/scene-package-registry.json',
      policy: '.kiro/templates/scene-package-gate-policy.json',
      out: '.kiro/reports/scene-package-gate-result.json',
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.summary).toMatchObject({
      passed: true,
      failed_checks: 0
    });
    expect(payload.metrics.layer_counts).toMatchObject({
      l1_capability: 1,
      l2_domain: 1,
      l3_instance: 1,
      unknown: 0
    });
    expect(payload.remediation).toMatchObject({
      action_count: 0,
      actions: []
    });
    expect(normalizePath(fileSystem.writeJson.mock.calls[0][0]))
      .toBe('/workspace/.kiro/reports/scene-package-gate-result.json');
  });

  test('runScenePackageGateCommand sets non-zero exit code when strict gate fails', async () => {
    const registryPayload = {
      summary: {
        total_templates: 1,
        valid_templates: 1,
        invalid_templates: 0,
        layer_counts: {
          l1_capability: 0,
          l2_domain: 1,
          l3_instance: 0,
          unknown: 0
        }
      }
    };

    const policyPayload = {
      apiVersion: 'kse.scene.package-gate/v0.1',
      profile: 'three-layer',
      rules: {
        max_invalid_templates: 0,
        min_valid_templates: 3,
        required_layers: ['l1-capability', 'l2-domain', 'l3-instance'],
        forbid_unknown_layer: true
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized.endsWith('/scene-package-registry.json')) {
          return registryPayload;
        }
        if (normalized.endsWith('/scene-package-gate-policy.json')) {
          return policyPayload;
        }
        throw new Error(`unexpected readJson path: ${targetPath}`);
      }),
      ensureDir: jest.fn(),
      writeJson: jest.fn()
    };

    const payload = await runScenePackageGateCommand({
      registry: '.kiro/reports/scene-package-registry.json',
      policy: '.kiro/templates/scene-package-gate-policy.json',
      strict: true,
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.summary.passed).toBe(false);
    expect(payload.remediation.action_count).toBe(3);
    expect(payload.remediation.actions.map((item) => item.id)).toEqual(expect.arrayContaining([
      'increase-valid-templates',
      'cover-l1-capability',
      'cover-l3-instance'
    ]));
    expect(process.exitCode).toBe(1);
  });

  test('runScenePackageGateCommand writes task draft and syncs failed checks to spec tasks', async () => {
    const registryPayload = {
      summary: {
        total_templates: 1,
        valid_templates: 1,
        invalid_templates: 0,
        layer_counts: {
          l1_capability: 0,
          l2_domain: 1,
          l3_instance: 0,
          unknown: 0
        }
      }
    };

    const policyPayload = {
      apiVersion: 'kse.scene.package-gate/v0.1',
      profile: 'three-layer',
      rules: {
        max_invalid_templates: 0,
        min_valid_templates: 3,
        required_layers: ['l1-capability', 'l2-domain', 'l3-instance'],
        forbid_unknown_layer: true
      }
    };

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized.endsWith('/scene-package-gate-policy.json')) {
          return true;
        }
        if (normalized.endsWith('/71-00-scene-package-gate-task-draft-and-sync/tasks.md')) {
          return true;
        }
        return false;
      }),
      readJson: jest.fn().mockImplementation(async (targetPath) => {
        const normalized = normalizePath(targetPath);
        if (normalized.endsWith('/scene-package-registry.json')) {
          return registryPayload;
        }
        if (normalized.endsWith('/scene-package-gate-policy.json')) {
          return policyPayload;
        }
        throw new Error(`unexpected readJson path: ${targetPath}`);
      }),
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue(),
      readFile: jest.fn().mockResolvedValue(`# Implementation Plan\n\n## Tasks\n\n- [x] 1 Existing baseline\n`),
      writeFile: jest.fn().mockResolvedValue()
    };

    const payload = await runScenePackageGateCommand({
      registry: '.kiro/reports/scene-package-registry.json',
      policy: '.kiro/templates/scene-package-gate-policy.json',
      spec: '71-00-scene-package-gate-task-draft-and-sync',
      taskOut: '.kiro/reports/scene-package-gate-task-draft.md',
      runbookOut: '.kiro/reports/scene-package-gate-remediation-runbook.md',
      syncSpecTasks: true,
      json: true
    }, {
      projectRoot: '/workspace',
      fileSystem
    });

    expect(payload).toBeDefined();
    expect(payload.summary.passed).toBe(false);
    expect(payload.remediation.actions.map((item) => item.id)).toEqual(expect.arrayContaining([
      'increase-valid-templates',
      'cover-l1-capability',
      'cover-l3-instance'
    ]));
    const increaseAction = payload.remediation.actions.find((item) => item.id === 'increase-valid-templates');
    expect(increaseAction.source_check_ids).toEqual(['min-valid-templates']);

    expect(payload.task_draft.output_path).toBe('.kiro/reports/scene-package-gate-task-draft.md');
    expect(payload.task_draft.suggested_actions).toBe(3);
    expect(payload.runbook).toMatchObject({
      output_path: '.kiro/reports/scene-package-gate-remediation-runbook.md',
      action_count: 3
    });
    expect(payload.task_sync).toMatchObject({
      added_count: 3,
      skipped_duplicates: 0,
      source_mode: 'remediation'
    });
    expect(payload.task_sync.added_tasks.map((item) => item.action_id)).toEqual(expect.arrayContaining([
      'increase-valid-templates',
      'cover-l1-capability',
      'cover-l3-instance'
    ]));

    expect(fileSystem.writeFile).toHaveBeenCalledTimes(3);
    const taskDraftCall = fileSystem.writeFile.mock.calls.find((call) =>
      normalizePath(call[0]).endsWith('/scene-package-gate-task-draft.md')
    );
    expect(taskDraftCall).toBeDefined();
    expect(taskDraftCall[1]).toContain('action_id=increase-valid-templates');

    const runbookCall = fileSystem.writeFile.mock.calls.find((call) =>
      normalizePath(call[0]).endsWith('/scene-package-gate-remediation-runbook.md')
    );
    expect(runbookCall).toBeDefined();
    expect(runbookCall[1]).toContain('Scene Package Gate Remediation Runbook');
    expect(runbookCall[1]).toContain('### 1. [high] increase-valid-templates');
    expect(runbookCall[1]).toContain('command: `kse scene package-registry --template-dir .kiro/templates/scene-packages --json`');

    const syncedTasksCall = fileSystem.writeFile.mock.calls.find((call) =>
      normalizePath(call[0]).endsWith('/71-00-scene-package-gate-task-draft-and-sync/tasks.md')
    );
    expect(syncedTasksCall).toBeDefined();
    expect(syncedTasksCall[1]).toContain('Scene Package Gate Suggested Tasks');
    expect(syncedTasksCall[1]).toContain('action_id=increase-valid-templates');
  });

  test('runSceneScaffoldCommand supports dry-run preview', async () => {
    const sceneLoader = {
      validateManifest: jest.fn().mockReturnValue({ valid: true, errors: [] })
    };

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/specs/39-00-scene-validation-and-starter-manifests') {
          return true;
        }
        if (normalizedPath.endsWith('custom/scene.yaml')) {
          return false;
        }
        return true;
      }),
      readFile: jest.fn().mockResolvedValue(`apiVersion: kse.scene/v0.2
kind: scene
metadata:
  obj_id: scene.template.erp
  obj_version: 0.2.0
  title: ERP Template
spec:
  domain: erp
  intent:
    goal: Query
  capability_contract:
    bindings:
      - type: query
        ref: spec.erp.query
  governance_contract:
    risk_level: low
`),
      ensureDir: jest.fn(),
      writeFile: jest.fn()
    };

    const summary = await runSceneScaffoldCommand({
      spec: '39-00-scene-validation-and-starter-manifests',
      type: 'erp',
      dryRun: true,
      objId: 'scene.custom.erp-query',
      title: 'ERP Query Custom',
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader,
      fileSystem
    });

    expect(summary).toMatchObject({
      dry_run: true,
      created: false,
      spec: '39-00-scene-validation-and-starter-manifests',
      type: 'erp',
      scene_ref: 'scene.custom.erp-query',
      title: 'ERP Query Custom'
    });
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
    expect(sceneLoader.validateManifest).toHaveBeenCalled();
  });

  test('runSceneScaffoldCommand writes manifest when not dry-run', async () => {
    const sceneLoader = {
      validateManifest: jest.fn().mockReturnValue({ valid: true, errors: [] })
    };

    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/specs/39-00-scene-validation-and-starter-manifests') {
          return true;
        }
        if (normalizedPath === '/workspace/.kiro/specs/39-00-scene-validation-and-starter-manifests/custom/scene.yaml') {
          return false;
        }
        return true;
      }),
      readFile: jest.fn().mockResolvedValue(`apiVersion: kse.scene/v0.2
kind: scene
metadata:
  obj_id: scene.template.hybrid
  obj_version: 0.2.0
  title: Hybrid Template
spec:
  domain: hybrid
  intent:
    goal: Dispatch
  capability_contract:
    bindings:
      - type: service
        ref: spec.erp.reserve
  governance_contract:
    risk_level: high
`),
      ensureDir: jest.fn().mockResolvedValue(),
      writeFile: jest.fn().mockResolvedValue()
    };

    const summary = await runSceneScaffoldCommand({
      spec: '39-00-scene-validation-and-starter-manifests',
      type: 'hybrid',
      output: 'custom/scene.yaml',
      json: true
    }, {
      projectRoot: '/workspace',
      sceneLoader,
      fileSystem
    });

    expect(summary).toMatchObject({
      dry_run: false,
      created: true,
      type: 'hybrid'
    });
    expect(fileSystem.ensureDir).toHaveBeenCalled();
    expect(fileSystem.writeFile).toHaveBeenCalledTimes(1);
  });

  test('runSceneScaffoldCommand blocks overwrite without force', async () => {
    const fileSystem = {
      pathExists: jest.fn().mockImplementation(async (targetPath) => {
        const normalizedPath = normalizePath(targetPath);
        if (normalizedPath === '/workspace/.kiro/specs/39-00-scene-validation-and-starter-manifests') {
          return true;
        }
        if (normalizedPath === '/workspace/.kiro/specs/39-00-scene-validation-and-starter-manifests/custom/scene.yaml') {
          return true;
        }
        return true;
      }),
      readFile: jest.fn().mockResolvedValue(`apiVersion: kse.scene/v0.2
kind: scene
metadata:
  obj_id: scene.template.erp
  obj_version: 0.2.0
  title: ERP Template
spec:
  domain: erp
  intent:
    goal: Query
  capability_contract:
    bindings:
      - type: query
        ref: spec.erp.query
  governance_contract:
    risk_level: low
`),
      ensureDir: jest.fn(),
      writeFile: jest.fn()
    };

    const sceneLoader = {
      validateManifest: jest.fn().mockReturnValue({ valid: true, errors: [] })
    };

    const result = await runSceneScaffoldCommand({
      spec: '39-00-scene-validation-and-starter-manifests',
      type: 'erp'
    }, {
      projectRoot: '/workspace',
      sceneLoader,
      fileSystem
    });

    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  test('runSceneCommand executes using spec source and writes outputs', async () => {
    const manifest = {
      metadata: {
        obj_id: 'scene.order.query',
        obj_version: '0.2.0'
      }
    };

    const execution = {
      plan: {
        plan_id: 'plan-1',
        nodes: [{ node_id: 'n-01' }, { node_id: 'n-02' }]
      },
      run_result: {
        status: 'success',
        trace_id: 'trace-1',
        run_mode: 'dry_run',
        evidence: []
      },
      eval_payload: {
        status: 'success'
      }
    };

    const sceneLoader = {
      loadFromSpec: jest.fn().mockResolvedValue(manifest),
      loadFromFile: jest.fn()
    };

    const runtimeExecutor = {
      execute: jest.fn().mockResolvedValue(execution)
    };

    const fileSystem = {
      ensureDir: jest.fn().mockResolvedValue(),
      writeJson: jest.fn().mockResolvedValue()
    };

    const result = await runSceneCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'dry_run',
      planOut: '.kiro/tmp/plan.json',
      resultOut: '.kiro/tmp/result.json'
    }, {
      projectRoot: '/workspace',
      sceneLoader,
      runtimeExecutor,
      fileSystem
    });

    expect(sceneLoader.loadFromSpec).toHaveBeenCalledWith('37-00-scene-runtime-execution-pilot', 'custom/scene.yaml');
    expect(runtimeExecutor.execute).toHaveBeenCalledWith(manifest, {
      runMode: 'dry_run',
      traceId: undefined,
      context: {}
    });
    expect(fileSystem.ensureDir).toHaveBeenCalledTimes(2);
    expect(fileSystem.writeJson).toHaveBeenCalledTimes(2);
    expect(result).toEqual(execution);
    expect(process.exitCode).toBeUndefined();
  });

  test('runSceneCommand prints binding plugin manifest status in summary output', async () => {
    const sceneLoader = {
      loadFromSpec: jest.fn().mockResolvedValue({
        metadata: {
          obj_id: 'scene.order.query',
          obj_version: '0.2.0'
        }
      })
    };

    const runtimeExecutor = {
      execute: jest.fn().mockResolvedValue({
        plan: { plan_id: 'plan-manifest', nodes: [{ node_id: 'n-01' }] },
        run_result: {
          status: 'success',
          trace_id: 'trace-manifest',
          run_mode: 'dry_run',
          evidence: [],
          binding_plugins: {
            handlers_loaded: 0,
            plugin_dirs: [],
            plugin_files: [],
            manifest_path: '/workspace/.kiro/config/scene-binding-plugins.json',
            manifest_loaded: false,
            warnings: ['binding plugin manifest not found: /workspace/.kiro/config/scene-binding-plugins.json']
          }
        },
        eval_payload: { status: 'success' }
      })
    };

    await runSceneCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'dry_run'
    }, {
      projectRoot: '/workspace',
      sceneLoader,
      runtimeExecutor,
      fileSystem: {
        ensureDir: jest.fn(),
        writeJson: jest.fn()
      }
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Manifest:'));
  });

  test('runSceneCommand marks denied runs with non-zero exit code', async () => {
    const sceneLoader = {
      loadFromSpec: jest.fn().mockResolvedValue({
        metadata: {
          obj_id: 'scene.fulfillment.robot-pick-confirm',
          obj_version: '0.2.0'
        }
      })
    };

    const runtimeExecutor = {
      execute: jest.fn().mockResolvedValue({
        plan: { plan_id: 'plan-hybrid', nodes: [] },
        run_result: {
          status: 'denied',
          trace_id: 'trace-hybrid',
          run_mode: 'commit',
          policy: {
            allowed: false,
            reasons: ['hybrid commit is disabled in runtime pilot']
          },
          evidence: []
        },
        eval_payload: { status: 'denied' }
      })
    };

    await runSceneCommand({
      spec: '37-00-scene-runtime-execution-pilot',
      mode: 'commit'
    }, {
      projectRoot: '/workspace',
      sceneLoader,
      runtimeExecutor,
      fileSystem: {
        ensureDir: jest.fn(),
        writeJson: jest.fn()
      }
    });

    expect(process.exitCode).toBe(1);
  });

  test('runSceneCommand rejects invalid command options', async () => {
    const result = await runSceneCommand({ mode: 'dry_run' }, {
      projectRoot: '/workspace'
    });

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // createTarBuffer / extractTarBuffer / bundlePackageTarball (Spec 77-00)
  // ---------------------------------------------------------------------------

  test('createTarBuffer creates valid tar with single file', () => {
    const files = [
      { relativePath: 'hello.txt', content: Buffer.from('Hello, world!') }
    ];
    const tarBuffer = createTarBuffer(files);

    // Must be multiple of 512
    expect(tarBuffer.length % 512).toBe(0);

    // Check ustar magic at offset 257
    const magic = tarBuffer.slice(257, 263).toString('utf8');
    expect(magic).toBe('ustar\0');

    // Check file name at offset 0
    const name = tarBuffer.slice(0, 9).toString('utf8');
    expect(name).toBe('hello.txt');

    // Check type flag at offset 156
    expect(tarBuffer[156]).toBe(0x30); // '0'

    // Minimum size: 1 header (512) + 1 content block (512) + 2 end blocks (1024) = 2048
    expect(tarBuffer.length).toBe(2048);
  });

  test('createTarBuffer creates valid tar with empty file', () => {
    const files = [
      { relativePath: 'empty.txt', content: Buffer.alloc(0) }
    ];
    const tarBuffer = createTarBuffer(files);

    // 1 header (512) + 0 content + 2 end blocks (1024) = 1536
    expect(tarBuffer.length).toBe(1536);
    expect(tarBuffer.length % 512).toBe(0);
  });

  test('createTarBuffer creates valid tar with multiple files', () => {
    const files = [
      { relativePath: 'a.txt', content: Buffer.from('AAA') },
      { relativePath: 'b.txt', content: Buffer.from('BBB') }
    ];
    const tarBuffer = createTarBuffer(files);

    // 2 headers (1024) + 2 content blocks (1024) + 2 end blocks (1024) = 3072
    expect(tarBuffer.length).toBe(3072);
  });

  test('createTarBuffer handles content larger than 512 bytes', () => {
    const largeContent = Buffer.alloc(1000, 0x41); // 1000 bytes of 'A'
    const files = [
      { relativePath: 'large.bin', content: largeContent }
    ];
    const tarBuffer = createTarBuffer(files);

    // 1 header (512) + 2 content blocks (1024, padded from 1000) + 2 end blocks (1024) = 2560
    expect(tarBuffer.length).toBe(2560);
  });

  test('createTarBuffer with no files produces only end-of-archive markers', () => {
    const tarBuffer = createTarBuffer([]);

    // 2 end blocks (1024)
    expect(tarBuffer.length).toBe(1024);

    // All zeros
    for (let i = 0; i < tarBuffer.length; i++) {
      expect(tarBuffer[i]).toBe(0);
    }
  });

  test('extractTarBuffer extracts single file correctly', () => {
    const originalContent = Buffer.from('Hello, world!');
    const files = [
      { relativePath: 'hello.txt', content: originalContent }
    ];
    const tarBuffer = createTarBuffer(files);
    const extracted = extractTarBuffer(tarBuffer);

    expect(extracted).toHaveLength(1);
    expect(extracted[0].relativePath).toBe('hello.txt');
    expect(Buffer.compare(extracted[0].content, originalContent)).toBe(0);
  });

  test('extractTarBuffer extracts multiple files correctly', () => {
    const files = [
      { relativePath: 'a.txt', content: Buffer.from('AAA') },
      { relativePath: 'b.txt', content: Buffer.from('BBB') }
    ];
    const tarBuffer = createTarBuffer(files);
    const extracted = extractTarBuffer(tarBuffer);

    expect(extracted).toHaveLength(2);
    expect(extracted[0].relativePath).toBe('a.txt');
    expect(extracted[0].content.toString()).toBe('AAA');
    expect(extracted[1].relativePath).toBe('b.txt');
    expect(extracted[1].content.toString()).toBe('BBB');
  });

  test('extractTarBuffer handles empty file', () => {
    const files = [
      { relativePath: 'empty.txt', content: Buffer.alloc(0) }
    ];
    const tarBuffer = createTarBuffer(files);
    const extracted = extractTarBuffer(tarBuffer);

    expect(extracted).toHaveLength(1);
    expect(extracted[0].relativePath).toBe('empty.txt');
    expect(extracted[0].content.length).toBe(0);
  });

  test('extractTarBuffer returns empty array for empty archive', () => {
    const tarBuffer = createTarBuffer([]);
    const extracted = extractTarBuffer(tarBuffer);

    expect(extracted).toHaveLength(0);
  });

  test('extractTarBuffer round-trips content larger than 512 bytes', () => {
    const largeContent = Buffer.alloc(1500, 0x42);
    const files = [
      { relativePath: 'large.bin', content: largeContent }
    ];
    const tarBuffer = createTarBuffer(files);
    const extracted = extractTarBuffer(tarBuffer);

    expect(extracted).toHaveLength(1);
    expect(extracted[0].relativePath).toBe('large.bin');
    expect(Buffer.compare(extracted[0].content, largeContent)).toBe(0);
  });

  test('bundlePackageTarball returns correct structure', () => {
    const files = [
      { relativePath: 'scene-package.json', content: Buffer.from('{"name":"test"}') },
      { relativePath: 'template.yaml', content: Buffer.from('kind: scene') }
    ];
    const result = bundlePackageTarball(files);

    expect(result).toHaveProperty('tarball');
    expect(result).toHaveProperty('integrity');
    expect(result).toHaveProperty('fileCount');
    expect(result).toHaveProperty('size');

    expect(Buffer.isBuffer(result.tarball)).toBe(true);
    expect(result.fileCount).toBe(2);
    expect(result.size).toBe(result.tarball.length);
    expect(result.integrity).toMatch(/^sha256-[0-9a-f]{64}$/);
  });

  test('bundlePackageTarball produces gzip-compressed output', () => {
    const zlib = require('zlib');
    const files = [
      { relativePath: 'test.txt', content: Buffer.from('test content') }
    ];
    const result = bundlePackageTarball(files);

    // Gzip magic bytes: 0x1f 0x8b
    expect(result.tarball[0]).toBe(0x1f);
    expect(result.tarball[1]).toBe(0x8b);

    // Decompress and extract to verify round-trip
    const decompressed = zlib.gunzipSync(result.tarball);
    const extracted = extractTarBuffer(decompressed);

    expect(extracted).toHaveLength(1);
    expect(extracted[0].relativePath).toBe('test.txt');
    expect(extracted[0].content.toString()).toBe('test content');
  });

  test('bundlePackageTarball SHA-256 hash is deterministic', () => {
    const files = [
      { relativePath: 'a.txt', content: Buffer.from('deterministic') }
    ];
    const result1 = bundlePackageTarball(files);
    const result2 = bundlePackageTarball(files);

    expect(result1.integrity).toBe(result2.integrity);
  });

  test('bundlePackageTarball with empty file list', () => {
    const result = bundlePackageTarball([]);

    expect(result.fileCount).toBe(0);
    expect(result.size).toBeGreaterThan(0); // gzip header even for empty tar
    expect(result.integrity).toMatch(/^sha256-[0-9a-f]{64}$/);
  });

  // ---------------------------------------------------------------------------
  // buildRegistryTarballPath / buildTarballFilename / resolveLatestVersion (Spec 77-00)
  // ---------------------------------------------------------------------------

  test('buildRegistryTarballPath returns correct path format', () => {
    const result = buildRegistryTarballPath('my-package', '1.0.0');
    expect(result).toBe('packages/my-package/1.0.0/my-package-1.0.0.tgz');
  });

  test('buildRegistryTarballPath handles scoped-like names', () => {
    const result = buildRegistryTarballPath('cool-scene', '2.3.1');
    expect(result).toBe('packages/cool-scene/2.3.1/cool-scene-2.3.1.tgz');
  });

  test('buildRegistryTarballPath handles pre-release versions', () => {
    const result = buildRegistryTarballPath('pkg', '1.0.0-beta.1');
    expect(result).toBe('packages/pkg/1.0.0-beta.1/pkg-1.0.0-beta.1.tgz');
  });

  test('buildTarballFilename returns correct filename format', () => {
    const result = buildTarballFilename('my-package', '1.0.0');
    expect(result).toBe('my-package-1.0.0.tgz');
  });

  test('buildTarballFilename handles pre-release versions', () => {
    const result = buildTarballFilename('pkg', '2.0.0-alpha.3');
    expect(result).toBe('pkg-2.0.0-alpha.3.tgz');
  });

  test('buildTarballFilename consistency with buildRegistryTarballPath', () => {
    const name = 'test-pkg';
    const version = '3.2.1';
    const filename = buildTarballFilename(name, version);
    const fullPath = buildRegistryTarballPath(name, version);
    expect(fullPath.endsWith(filename)).toBe(true);
  });

  test('resolveLatestVersion returns highest semver from multiple versions', () => {
    const versions = {
      '1.0.0': { published_at: '2025-01-01' },
      '2.0.0': { published_at: '2025-01-02' },
      '1.5.0': { published_at: '2025-01-03' }
    };
    expect(resolveLatestVersion(versions)).toBe('2.0.0');
  });

  test('resolveLatestVersion returns null for empty object', () => {
    expect(resolveLatestVersion({})).toBeNull();
  });

  test('resolveLatestVersion returns null for null/undefined', () => {
    expect(resolveLatestVersion(null)).toBeNull();
    expect(resolveLatestVersion(undefined)).toBeNull();
  });

  test('resolveLatestVersion returns single version when only one exists', () => {
    const versions = { '1.0.0': { published_at: '2025-01-01' } };
    expect(resolveLatestVersion(versions)).toBe('1.0.0');
  });

  test('resolveLatestVersion handles pre-release versions correctly', () => {
    const versions = {
      '1.0.0': {},
      '1.1.0-beta.1': {},
      '1.0.1': {}
    };
    // 1.1.0-beta.1 < 1.1.0 but > 1.0.1 per semver
    expect(resolveLatestVersion(versions)).toBe('1.1.0-beta.1');
  });

  test('resolveLatestVersion sorts by semver not lexicographic order', () => {
    const versions = {
      '1.9.0': {},
      '1.10.0': {},
      '1.2.0': {}
    };
    // Lexicographic: 1.9.0 > 1.2.0 > 1.10.0, but semver: 1.10.0 > 1.9.0 > 1.2.0
    expect(resolveLatestVersion(versions)).toBe('1.10.0');
  });

  // ---------------------------------------------------------------------------
  // validatePackageForPublish (Spec 77-00, Task 3.1)
  // ---------------------------------------------------------------------------

  test('validatePackageForPublish returns valid result for well-formed package', async () => {
    const mockContract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'test-pkg',
        version: '1.0.0',
        description: 'A test package'
      },
      compatibility: {
        kse_version: '>=1.0.0',
        scene_api_version: 'v0.1'
      },
      capabilities: {
        provides: ['test-capability'],
        requires: []
      },
      parameters: [],
      artifacts: {
        entry_scene: 'scene.yaml',
        generates: ['output.txt']
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(mockContract),
      pathExists: jest.fn().mockResolvedValue(true)
    };

    const result = await validatePackageForPublish('/fake/dir', mockFileSystem);

    expect(result.valid).toBe(true);
    expect(result.contract).toEqual(mockContract);
    expect(result.errors).toEqual([]);
    expect(result.files).toHaveLength(2); // entry_scene + 1 generates
    expect(result.files[0].relativePath).toBe('scene.yaml');
    expect(result.files[1].relativePath).toBe('output.txt');
  });

  test('validatePackageForPublish returns errors when scene-package.json cannot be read', async () => {
    const mockFileSystem = {
      readJson: jest.fn().mockRejectedValue(new Error('ENOENT: no such file')),
      pathExists: jest.fn().mockResolvedValue(false)
    };

    const result = await validatePackageForPublish('/missing/dir', mockFileSystem);

    expect(result.valid).toBe(false);
    expect(result.contract).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/failed to read scene-package.json/);
    expect(result.files).toEqual([]);
  });

  test('validatePackageForPublish reports contract validation errors', async () => {
    const invalidContract = {
      apiVersion: 'wrong-version',
      kind: 'invalid-kind'
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(invalidContract),
      pathExists: jest.fn().mockResolvedValue(true)
    };

    const result = await validatePackageForPublish('/fake/dir', mockFileSystem);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('apiVersion'))).toBe(true);
  });

  test('validatePackageForPublish reports invalid semver version', async () => {
    const mockContract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'test-pkg',
        version: 'not-a-version',
        description: 'A test package'
      },
      compatibility: {
        kse_version: '>=1.0.0',
        scene_api_version: 'v0.1'
      },
      capabilities: {
        provides: ['test'],
        requires: []
      },
      parameters: [],
      artifacts: {
        entry_scene: 'scene.yaml',
        generates: ['output.txt']
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(mockContract),
      pathExists: jest.fn().mockResolvedValue(true)
    };

    const result = await validatePackageForPublish('/fake/dir', mockFileSystem);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not valid semver'))).toBe(true);
  });

  test('validatePackageForPublish reports missing entry_scene file', async () => {
    const mockContract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'test-pkg',
        version: '1.0.0',
        description: 'A test package'
      },
      compatibility: {
        kse_version: '>=1.0.0',
        scene_api_version: 'v0.1'
      },
      capabilities: {
        provides: ['test'],
        requires: []
      },
      parameters: [],
      artifacts: {
        entry_scene: 'missing-scene.yaml',
        generates: ['output.txt']
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(mockContract),
      pathExists: jest.fn().mockImplementation(async (filePath) => {
        return !filePath.includes('missing-scene.yaml');
      })
    };

    const result = await validatePackageForPublish('/fake/dir', mockFileSystem);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('entry_scene file not found'))).toBe(true);
  });

  test('validatePackageForPublish reports missing generates files', async () => {
    const mockContract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'test-pkg',
        version: '1.0.0',
        description: 'A test package'
      },
      compatibility: {
        kse_version: '>=1.0.0',
        scene_api_version: 'v0.1'
      },
      capabilities: {
        provides: ['test'],
        requires: []
      },
      parameters: [],
      artifacts: {
        entry_scene: 'scene.yaml',
        generates: ['exists.txt', 'missing.txt']
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(mockContract),
      pathExists: jest.fn().mockImplementation(async (filePath) => {
        return !filePath.includes('missing.txt');
      })
    };

    const result = await validatePackageForPublish('/fake/dir', mockFileSystem);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('generates file not found: missing.txt'))).toBe(true);
    // entry_scene + exists.txt should be in files
    expect(result.files).toHaveLength(2);
  });

  test('validatePackageForPublish handles empty generates array', async () => {
    const mockContract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'test-pkg',
        version: '1.0.0',
        description: 'A test package'
      },
      compatibility: {
        kse_version: '>=1.0.0',
        scene_api_version: 'v0.1'
      },
      capabilities: {
        provides: ['test'],
        requires: []
      },
      parameters: [],
      artifacts: {
        entry_scene: 'scene.yaml',
        generates: []
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(mockContract),
      pathExists: jest.fn().mockResolvedValue(true)
    };

    const result = await validatePackageForPublish('/fake/dir', mockFileSystem);

    // Contract validation will report generates must contain at least one output path
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('generates must contain at least one output path'))).toBe(true);
    // Only entry_scene in files
    expect(result.files).toHaveLength(1);
  });

  test('validatePackageForPublish accepts pre-release semver versions', async () => {
    const mockContract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'test-pkg',
        version: '1.0.0-beta.1',
        description: 'A test package'
      },
      compatibility: {
        kse_version: '>=1.0.0',
        scene_api_version: 'v0.1'
      },
      capabilities: {
        provides: ['test'],
        requires: []
      },
      parameters: [],
      artifacts: {
        entry_scene: 'scene.yaml',
        generates: ['output.txt']
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(mockContract),
      pathExists: jest.fn().mockResolvedValue(true)
    };

    const result = await validatePackageForPublish('/fake/dir', mockFileSystem);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.errors.some(e => e.includes('semver'))).toBe(false);
  });

  test('validatePackageForPublish uses default fs when no fileSystem provided', async () => {
    // Calling with a non-existent directory should fail gracefully
    const result = await validatePackageForPublish('/definitely/not/a/real/path/12345');

    expect(result.valid).toBe(false);
    expect(result.contract).toBeNull();
    expect(result.errors[0]).toMatch(/failed to read scene-package.json/);
  });

  test('validatePackageForPublish collects files with correct absolutePath', async () => {
    const mockContract = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: {
        group: 'kse.scene',
        name: 'test-pkg',
        version: '2.0.0',
        description: 'A test package'
      },
      compatibility: {
        kse_version: '>=1.0.0',
        scene_api_version: 'v0.1'
      },
      capabilities: {
        provides: ['test'],
        requires: []
      },
      parameters: [],
      artifacts: {
        entry_scene: 'templates/scene.yaml',
        generates: ['templates/a.txt', 'templates/b.txt']
      },
      governance: {
        risk_level: 'low',
        approval_required: false,
        rollback_supported: true
      }
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(mockContract),
      pathExists: jest.fn().mockResolvedValue(true)
    };

    const packageDir = '/my/package';
    const result = await validatePackageForPublish(packageDir, mockFileSystem);

    expect(result.valid).toBe(true);
    expect(result.files).toHaveLength(3);
    for (const file of result.files) {
      expect(normalizePath(file.absolutePath)).toContain(normalizePath(packageDir));
      expect(normalizePath(file.absolutePath)).toContain(normalizePath(file.relativePath));
    }
  });

  // ---------------------------------------------------------------------------
  // loadRegistryIndex (Spec 77-00, Task 5.1)
  // ---------------------------------------------------------------------------

  test('loadRegistryIndex returns default index when file does not exist', async () => {
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(false),
      readJson: jest.fn()
    };

    const result = await loadRegistryIndex('/fake/registry', mockFileSystem);

    expect(result).toEqual({ apiVersion: 'kse.scene.registry/v0.1', packages: {} });
    expect(mockFileSystem.readJson).not.toHaveBeenCalled();
  });

  test('loadRegistryIndex returns parsed index when file exists', async () => {
    const existingIndex = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {
        'my-pkg': { name: 'my-pkg', latest: '1.0.0', versions: { '1.0.0': {} } }
      }
    };
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      readJson: jest.fn().mockResolvedValue(existingIndex)
    };

    const result = await loadRegistryIndex('/fake/registry', mockFileSystem);

    expect(result).toEqual(existingIndex);
    expect(mockFileSystem.readJson).toHaveBeenCalledWith(
      expect.stringContaining('registry-index.json')
    );
  });

  test('loadRegistryIndex throws on invalid JSON', async () => {
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      readJson: jest.fn().mockRejectedValue(new Error('Unexpected token'))
    };

    await expect(loadRegistryIndex('/fake/registry', mockFileSystem))
      .rejects.toThrow('failed to parse registry-index.json');
  });

  test('loadRegistryIndex throws when packages object is missing', async () => {
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      readJson: jest.fn().mockResolvedValue({ apiVersion: 'kse.scene.registry/v0.1' })
    };

    await expect(loadRegistryIndex('/fake/registry', mockFileSystem))
      .rejects.toThrow('missing required "packages" object');
  });

  test('loadRegistryIndex throws when index is null', async () => {
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      readJson: jest.fn().mockResolvedValue(null)
    };

    await expect(loadRegistryIndex('/fake/registry', mockFileSystem))
      .rejects.toThrow('missing required "packages" object');
  });

  // ---------------------------------------------------------------------------
  // saveRegistryIndex (Spec 77-00, Task 5.2)
  // ---------------------------------------------------------------------------

  test('saveRegistryIndex writes index with 2-space indentation', async () => {
    const index = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: { 'test-pkg': { name: 'test-pkg' } }
    };
    const mockFileSystem = {
      writeJson: jest.fn().mockResolvedValue(undefined)
    };

    await saveRegistryIndex('/fake/registry', index, mockFileSystem);

    expect(mockFileSystem.writeJson).toHaveBeenCalledWith(
      expect.stringContaining('registry-index.json'),
      index,
      { spaces: 2 }
    );
  });

  test('saveRegistryIndex writes to correct path', async () => {
    const mockFileSystem = {
      writeJson: jest.fn().mockResolvedValue(undefined)
    };

    await saveRegistryIndex('/my/registry', { packages: {} }, mockFileSystem);

    const calledPath = mockFileSystem.writeJson.mock.calls[0][0];
    expect(normalizePath(calledPath)).toBe(normalizePath('/my/registry/registry-index.json'));
  });

  // ---------------------------------------------------------------------------
  // addVersionToIndex (Spec 77-00, Task 5.3)
  // ---------------------------------------------------------------------------

  test('addVersionToIndex adds new package entry to empty index', () => {
    const index = { apiVersion: 'kse.scene.registry/v0.1', packages: {} };
    const contract = {
      metadata: {
        name: 'my-scene',
        group: 'kse.scene',
        description: 'A test scene',
        version: '1.0.0'
      }
    };

    const result = addVersionToIndex(index, contract, 'sha256-abc123', '2025-01-01T00:00:00.000Z');

    expect(result.packages['my-scene']).toBeDefined();
    expect(result.packages['my-scene'].name).toBe('my-scene');
    expect(result.packages['my-scene'].group).toBe('kse.scene');
    expect(result.packages['my-scene'].description).toBe('A test scene');
    expect(result.packages['my-scene'].latest).toBe('1.0.0');
    expect(result.packages['my-scene'].versions['1.0.0']).toEqual({
      published_at: '2025-01-01T00:00:00.000Z',
      integrity: 'sha256-abc123',
      tarball: 'packages/my-scene/1.0.0/my-scene-1.0.0.tgz'
    });
  });

  test('addVersionToIndex adds second version and updates latest', () => {
    const index = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {
        'my-scene': {
          name: 'my-scene',
          group: 'kse.scene',
          description: 'A test scene',
          latest: '1.0.0',
          versions: {
            '1.0.0': {
              published_at: '2025-01-01T00:00:00.000Z',
              integrity: 'sha256-old',
              tarball: 'packages/my-scene/1.0.0/my-scene-1.0.0.tgz'
            }
          }
        }
      }
    };
    const contract = {
      metadata: {
        name: 'my-scene',
        group: 'kse.scene',
        description: 'A test scene updated',
        version: '2.0.0'
      }
    };

    const result = addVersionToIndex(index, contract, 'sha256-new', '2025-02-01T00:00:00.000Z');

    expect(result.packages['my-scene'].latest).toBe('2.0.0');
    expect(Object.keys(result.packages['my-scene'].versions)).toHaveLength(2);
    expect(result.packages['my-scene'].versions['2.0.0']).toEqual({
      published_at: '2025-02-01T00:00:00.000Z',
      integrity: 'sha256-new',
      tarball: 'packages/my-scene/2.0.0/my-scene-2.0.0.tgz'
    });
    // Old version still present
    expect(result.packages['my-scene'].versions['1.0.0']).toBeDefined();
  });

  test('addVersionToIndex sets latest to highest semver not latest published', () => {
    const index = { apiVersion: 'kse.scene.registry/v0.1', packages: {} };
    const contract1 = {
      metadata: { name: 'pkg', group: 'g', description: 'd', version: '2.0.0' }
    };
    const contract2 = {
      metadata: { name: 'pkg', group: 'g', description: 'd', version: '1.5.0' }
    };

    addVersionToIndex(index, contract1, 'sha256-a', '2025-01-01T00:00:00.000Z');
    const result = addVersionToIndex(index, contract2, 'sha256-b', '2025-02-01T00:00:00.000Z');

    // latest should still be 2.0.0 even though 1.5.0 was published later
    expect(result.packages['pkg'].latest).toBe('2.0.0');
  });

  test('addVersionToIndex overwrites existing version entry', () => {
    const index = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {
        'pkg': {
          name: 'pkg', group: 'g', description: 'd', latest: '1.0.0',
          versions: {
            '1.0.0': { published_at: '2025-01-01T00:00:00.000Z', integrity: 'sha256-old', tarball: 'packages/pkg/1.0.0/pkg-1.0.0.tgz' }
          }
        }
      }
    };
    const contract = {
      metadata: { name: 'pkg', group: 'g', description: 'd', version: '1.0.0' }
    };

    const result = addVersionToIndex(index, contract, 'sha256-new', '2025-03-01T00:00:00.000Z');

    expect(result.packages['pkg'].versions['1.0.0'].integrity).toBe('sha256-new');
    expect(result.packages['pkg'].versions['1.0.0'].published_at).toBe('2025-03-01T00:00:00.000Z');
  });

  // ---------------------------------------------------------------------------
  // removeVersionFromIndex (Spec 77-00, Task 5.4)
  // ---------------------------------------------------------------------------

  test('removeVersionFromIndex removes version and updates latest', () => {
    const index = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {
        'pkg': {
          name: 'pkg', group: 'g', description: 'd', latest: '2.0.0',
          versions: {
            '1.0.0': { published_at: '2025-01-01T00:00:00.000Z', integrity: 'sha256-a' },
            '2.0.0': { published_at: '2025-02-01T00:00:00.000Z', integrity: 'sha256-b' }
          }
        }
      }
    };

    const result = removeVersionFromIndex(index, 'pkg', '2.0.0');

    expect(result.removed).toBe(true);
    expect(result.index.packages['pkg'].versions['2.0.0']).toBeUndefined();
    expect(result.index.packages['pkg'].latest).toBe('1.0.0');
    expect(Object.keys(result.index.packages['pkg'].versions)).toHaveLength(1);
  });

  test('removeVersionFromIndex deletes package entry when last version removed', () => {
    const index = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {
        'pkg': {
          name: 'pkg', group: 'g', description: 'd', latest: '1.0.0',
          versions: {
            '1.0.0': { published_at: '2025-01-01T00:00:00.000Z', integrity: 'sha256-a' }
          }
        }
      }
    };

    const result = removeVersionFromIndex(index, 'pkg', '1.0.0');

    expect(result.removed).toBe(true);
    expect(result.index.packages['pkg']).toBeUndefined();
  });

  test('removeVersionFromIndex returns removed false for non-existent package', () => {
    const index = { apiVersion: 'kse.scene.registry/v0.1', packages: {} };

    const result = removeVersionFromIndex(index, 'no-such-pkg', '1.0.0');

    expect(result.removed).toBe(false);
    expect(result.index).toBe(index);
  });

  test('removeVersionFromIndex returns removed false for non-existent version', () => {
    const index = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {
        'pkg': {
          name: 'pkg', group: 'g', description: 'd', latest: '1.0.0',
          versions: {
            '1.0.0': { published_at: '2025-01-01T00:00:00.000Z', integrity: 'sha256-a' }
          }
        }
      }
    };

    const result = removeVersionFromIndex(index, 'pkg', '9.9.9');

    expect(result.removed).toBe(false);
    expect(result.index.packages['pkg'].versions['1.0.0']).toBeDefined();
  });

  test('removeVersionFromIndex updates latest to next highest semver', () => {
    const index = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {
        'pkg': {
          name: 'pkg', group: 'g', description: 'd', latest: '3.0.0',
          versions: {
            '1.0.0': { published_at: '2025-01-01T00:00:00.000Z', integrity: 'sha256-a' },
            '2.5.0': { published_at: '2025-02-01T00:00:00.000Z', integrity: 'sha256-b' },
            '3.0.0': { published_at: '2025-03-01T00:00:00.000Z', integrity: 'sha256-c' }
          }
        }
      }
    };

    const result = removeVersionFromIndex(index, 'pkg', '3.0.0');

    expect(result.removed).toBe(true);
    expect(result.index.packages['pkg'].latest).toBe('2.5.0');
  });

  // ---------------------------------------------------------------------------
  // storeToRegistry (Spec 77-00, Task 6.1)
  // ---------------------------------------------------------------------------

  test('storeToRegistry writes tarball to correct path', async () => {
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined)
    };
    const tarball = Buffer.from('fake-tarball-data');

    const result = await storeToRegistry('my-pkg', '1.0.0', tarball, '/registry', {}, mockFileSystem);

    expect(normalizePath(result.path)).toContain('packages/my-pkg/1.0.0/my-pkg-1.0.0.tgz');
    expect(result.overwritten).toBe(false);
    expect(mockFileSystem.ensureDir).toHaveBeenCalledTimes(1);
    expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('my-pkg-1.0.0.tgz'),
      tarball
    );
  });

  test('storeToRegistry throws duplicate error when version exists and force is false', async () => {
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      ensureDir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined)
    };
    const tarball = Buffer.from('fake-tarball-data');

    await expect(storeToRegistry('my-pkg', '1.0.0', tarball, '/registry', {}, mockFileSystem))
      .rejects.toThrow('already exists in registry');
    expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
  });

  test('storeToRegistry throws duplicate error when options is undefined (no force)', async () => {
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      ensureDir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined)
    };
    const tarball = Buffer.from('fake-tarball-data');

    await expect(storeToRegistry('my-pkg', '1.0.0', tarball, '/registry', undefined, mockFileSystem))
      .rejects.toThrow('already exists in registry');
  });

  test('storeToRegistry overwrites when force is true and version exists', async () => {
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      ensureDir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined)
    };
    const tarball = Buffer.from('new-tarball-data');

    const result = await storeToRegistry('my-pkg', '1.0.0', tarball, '/registry', { force: true }, mockFileSystem);

    expect(result.overwritten).toBe(true);
    expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('my-pkg-1.0.0.tgz'),
      tarball
    );
  });

  test('storeToRegistry creates directory structure for new package', async () => {
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(false),
      ensureDir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined)
    };
    const tarball = Buffer.from('data');

    await storeToRegistry('new-pkg', '0.1.0', tarball, '/my/registry', {}, mockFileSystem);

    const ensuredDir = normalizePath(mockFileSystem.ensureDir.mock.calls[0][0]);
    expect(ensuredDir).toContain('packages/new-pkg/0.1.0');
  });

  // ---------------------------------------------------------------------------
  // removeFromRegistry (Spec 77-00, Task 6.2)
  // ---------------------------------------------------------------------------

  test('removeFromRegistry removes tarball and cleans empty directories', async () => {
    const mockFileSystem = {
      remove: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue([])
    };

    const result = await removeFromRegistry('my-pkg', '1.0.0', '/registry', mockFileSystem);

    expect(result.removed).toBe(true);
    // Should have called remove 3 times: tarball file, empty version dir, empty package dir
    expect(mockFileSystem.remove).toHaveBeenCalledTimes(3);
    expect(normalizePath(mockFileSystem.remove.mock.calls[0][0])).toContain('my-pkg-1.0.0.tgz');
  });

  test('removeFromRegistry does not remove non-empty directories', async () => {
    const mockFileSystem = {
      remove: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue(['other-file.txt'])
    };

    const result = await removeFromRegistry('my-pkg', '1.0.0', '/registry', mockFileSystem);

    expect(result.removed).toBe(true);
    // Should only remove the tarball file, not the directories (they have entries)
    expect(mockFileSystem.remove).toHaveBeenCalledTimes(1);
  });

  test('removeFromRegistry returns removed false when file removal fails', async () => {
    const mockFileSystem = {
      remove: jest.fn().mockRejectedValue(new Error('ENOENT')),
      readdir: jest.fn().mockResolvedValue([])
    };

    const result = await removeFromRegistry('no-pkg', '9.9.9', '/registry', mockFileSystem);

    expect(result.removed).toBe(false);
  });

  test('removeFromRegistry handles readdir failure gracefully', async () => {
    const mockFileSystem = {
      remove: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockRejectedValue(new Error('ENOENT'))
    };

    const result = await removeFromRegistry('my-pkg', '1.0.0', '/registry', mockFileSystem);

    expect(result.removed).toBe(true);
    // Only the tarball remove should succeed, readdir failures are caught
    expect(mockFileSystem.remove).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Registry Publish Command (Spec 77-00, Task 8)
  // ---------------------------------------------------------------------------

  test('normalizeScenePackageRegistryPublishOptions returns defaults', () => {
    const result = normalizeScenePackageRegistryPublishOptions({});
    expect(result).toEqual({
      package: undefined,
      registry: '.kiro/registry',
      dryRun: false,
      force: false,
      json: false
    });
  });

  test('normalizeScenePackageRegistryPublishOptions trims and converts values', () => {
    const result = normalizeScenePackageRegistryPublishOptions({
      package: '  my-pkg  ',
      registry: '  custom/registry  ',
      dryRun: true,
      force: true,
      json: true
    });
    expect(result).toEqual({
      package: 'my-pkg',
      registry: 'custom/registry',
      dryRun: true,
      force: true,
      json: true
    });
  });

  test('normalizeScenePackageRegistryPublishOptions coerces non-boolean flags to false', () => {
    const result = normalizeScenePackageRegistryPublishOptions({
      package: 'pkg',
      dryRun: 'yes',
      force: 1,
      json: 'true'
    });
    expect(result.dryRun).toBe(false);
    expect(result.force).toBe(false);
    expect(result.json).toBe(false);
  });

  test('validateScenePackageRegistryPublishOptions returns error when package is missing', () => {
    expect(validateScenePackageRegistryPublishOptions({})).toBe('--package is required');
    expect(validateScenePackageRegistryPublishOptions({ package: '' })).toBe('--package is required');
    expect(validateScenePackageRegistryPublishOptions({ package: 123 })).toBe('--package is required');
  });

  test('validateScenePackageRegistryPublishOptions returns null for valid options', () => {
    expect(validateScenePackageRegistryPublishOptions({ package: 'my-pkg' })).toBeNull();
  });

  test('printScenePackageRegistryPublishSummary outputs JSON in json mode', () => {
    const payload = {
      published: true,
      dry_run: false,
      overwritten: false,
      coordinate: 'kse.scene/test-pkg@1.0.0',
      package: { name: 'test-pkg', group: 'kse.scene', version: '1.0.0', kind: 'scene-template' },
      tarball: { path: '.kiro/registry/packages/test-pkg/1.0.0/test-pkg-1.0.0.tgz', size: 512, file_count: 2, integrity: 'sha256-abc' },
      registry: { index_path: '.kiro/registry/registry-index.json', total_packages: 1, total_versions: 1 }
    };
    printScenePackageRegistryPublishSummary({ json: true }, payload, '/project');
    expect(console.log).toHaveBeenCalled();
    const output = console.log.mock.calls.map(c => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.coordinate).toBe('kse.scene/test-pkg@1.0.0');
  });

  test('printScenePackageRegistryPublishSummary outputs human-readable summary', () => {
    const payload = {
      published: true,
      dry_run: false,
      overwritten: false,
      coordinate: 'kse.scene/test-pkg@1.0.0',
      package: { name: 'test-pkg', group: 'kse.scene', version: '1.0.0', kind: 'scene-template' },
      tarball: { path: '.kiro/registry/packages/test-pkg/1.0.0/test-pkg-1.0.0.tgz', size: 512, file_count: 2, integrity: 'sha256-abc' },
      registry: { index_path: '.kiro/registry/registry-index.json', total_packages: 1, total_versions: 1 }
    };
    printScenePackageRegistryPublishSummary({ json: false }, payload, '/project');
    const output = console.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Scene Package Publish');
    expect(output).toContain('kse.scene/test-pkg@1.0.0');
    expect(output).toContain('512 bytes');
    expect(output).toContain('sha256-abc');
  });

  test('printScenePackageRegistryPublishSummary shows dry-run indicator', () => {
    const payload = {
      published: false,
      dry_run: true,
      overwritten: false,
      coordinate: 'kse.scene/test-pkg@1.0.0',
      package: { name: 'test-pkg', group: 'kse.scene', version: '1.0.0', kind: 'scene-template' },
      tarball: { path: '.kiro/registry/packages/test-pkg/1.0.0/test-pkg-1.0.0.tgz', size: 512, file_count: 2, integrity: 'sha256-abc' },
      registry: { index_path: '.kiro/registry/registry-index.json', total_packages: 0, total_versions: 0 }
    };
    printScenePackageRegistryPublishSummary({ json: false }, payload, '/project');
    const output = console.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('dry-run');
  });

  test('runScenePackageRegistryPublishCommand returns null when --package is missing', async () => {
    const result = await runScenePackageRegistryPublishCommand({}, { projectRoot: '/project' });
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  test('runScenePackageRegistryPublishCommand returns null when package validation fails', async () => {
    const mockFileSystem = {
      readJson: jest.fn().mockRejectedValue(new Error('ENOENT: no such file')),
      pathExists: jest.fn().mockResolvedValue(false)
    };

    const result = await runScenePackageRegistryPublishCommand(
      { package: 'nonexistent-pkg' },
      { projectRoot: '/project', fileSystem: mockFileSystem }
    );

    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  test('runScenePackageRegistryPublishCommand dry-run returns payload without writing', async () => {
    const contractJson = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: { name: 'test-pkg', group: 'kse.scene', version: '1.0.0', description: 'Test' },
      compatibility: { kse_version: '>=1.0.0', scene_api_version: 'kse.scene/v0.2' },
      capabilities: { provides: ['test-cap'], requires: [] },
      artifacts: { entry_scene: 'scene.yaml', generates: ['template.yaml'] },
      governance: { risk_level: 'low', approval_required: false, rollback_supported: true },
      parameters: []
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(contractJson),
      readFile: jest.fn().mockResolvedValue(Buffer.from('file-content')),
      pathExists: jest.fn().mockResolvedValue(true),
      ensureDir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      writeJson: jest.fn().mockResolvedValue(undefined)
    };

    const result = await runScenePackageRegistryPublishCommand(
      { package: 'packages/test-pkg', dryRun: true, json: true },
      { projectRoot: '/project', fileSystem: mockFileSystem }
    );

    expect(result).not.toBeNull();
    expect(result.published).toBe(false);
    expect(result.dry_run).toBe(true);
    expect(result.coordinate).toBe('kse.scene/test-pkg@1.0.0');
    expect(result.tarball.file_count).toBe(3); // scene-package.json + entry_scene + 1 generates
    expect(result.tarball.size).toBeGreaterThan(0);
    expect(result.tarball.integrity).toMatch(/^sha256-/);
    // Verify no writes happened
    expect(mockFileSystem.ensureDir).not.toHaveBeenCalled();
    expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
  });

  test('runScenePackageRegistryPublishCommand full publish stores tarball and updates index', async () => {
    const contractJson = {
      apiVersion: 'kse.scene.package/v0.1',
      kind: 'scene-template',
      metadata: { name: 'my-pkg', group: 'kse.scene', version: '2.0.0', description: 'My package' },
      compatibility: { kse_version: '>=1.0.0', scene_api_version: 'kse.scene/v0.2' },
      capabilities: { provides: ['my-cap'], requires: [] },
      artifacts: { entry_scene: 'scene.yaml', generates: ['output.yaml'] },
      governance: { risk_level: 'low', approval_required: false, rollback_supported: true },
      parameters: []
    };

    const existingIndex = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {}
    };

    let savedIndex = null;
    const mockFileSystem = {
      readJson: jest.fn().mockImplementation((filePath) => {
        if (String(filePath).endsWith('scene-package.json')) {
          return Promise.resolve(contractJson);
        }
        if (String(filePath).endsWith('registry-index.json')) {
          return Promise.resolve(JSON.parse(JSON.stringify(existingIndex)));
        }
        return Promise.reject(new Error('not found'));
      }),
      readFile: jest.fn().mockResolvedValue(Buffer.from('scene-content')),
      pathExists: jest.fn().mockImplementation((filePath) => {
        // registry version dir does not exist yet (no duplicate)
        if (String(filePath).includes('packages') && String(filePath).includes('2.0.0')) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      }),
      ensureDir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      writeJson: jest.fn().mockImplementation((filePath, data) => {
        if (String(filePath).endsWith('registry-index.json')) {
          savedIndex = data;
        }
        return Promise.resolve(undefined);
      })
    };

    const result = await runScenePackageRegistryPublishCommand(
      { package: 'packages/my-pkg', json: true },
      { projectRoot: '/project', fileSystem: mockFileSystem }
    );

    expect(result).not.toBeNull();
    expect(result.published).toBe(true);
    expect(result.dry_run).toBe(false);
    expect(result.coordinate).toBe('kse.scene/my-pkg@2.0.0');
    expect(result.package.name).toBe('my-pkg');
    expect(result.package.version).toBe('2.0.0');
    expect(result.tarball.file_count).toBe(3); // scene-package.json + entry_scene + 1 generates
    expect(result.tarball.integrity).toMatch(/^sha256-/);
    expect(result.registry.total_packages).toBe(1);
    expect(result.registry.total_versions).toBe(1);

    // Verify index was saved with the new package
    expect(savedIndex).not.toBeNull();
    expect(savedIndex.packages['my-pkg']).toBeDefined();
    expect(savedIndex.packages['my-pkg'].latest).toBe('2.0.0');
  });

  // ---------------------------------------------------------------------------
  // Scene Unpublish Command
  // ---------------------------------------------------------------------------

  test('normalizeSceneUnpublishOptions returns defaults', () => {
    const result = normalizeSceneUnpublishOptions({});
    expect(result).toEqual({
      name: undefined,
      version: undefined,
      registry: '.kiro/registry',
      json: false
    });
  });

  test('normalizeSceneUnpublishOptions trims and converts values', () => {
    const result = normalizeSceneUnpublishOptions({
      name: '  my-pkg  ',
      version: '  1.0.0  ',
      registry: '  custom/registry  ',
      json: true
    });
    expect(result).toEqual({
      name: 'my-pkg',
      version: '1.0.0',
      registry: 'custom/registry',
      json: true
    });
  });

  test('normalizeSceneUnpublishOptions coerces non-boolean json to false', () => {
    const result = normalizeSceneUnpublishOptions({
      name: 'pkg',
      version: '1.0.0',
      json: 'true'
    });
    expect(result.json).toBe(false);
  });

  test('validateSceneUnpublishOptions returns error when name is missing', () => {
    expect(validateSceneUnpublishOptions({})).toBe('--name is required');
    expect(validateSceneUnpublishOptions({ name: '' })).toBe('--name is required');
    expect(validateSceneUnpublishOptions({ name: 123 })).toBe('--name is required');
  });

  test('validateSceneUnpublishOptions returns error when version is missing', () => {
    expect(validateSceneUnpublishOptions({ name: 'pkg' })).toBe('--version is required');
    expect(validateSceneUnpublishOptions({ name: 'pkg', version: '' })).toBe('--version is required');
  });

  test('validateSceneUnpublishOptions returns error for invalid semver', () => {
    expect(validateSceneUnpublishOptions({ name: 'pkg', version: 'not-semver' }))
      .toBe('--version "not-semver" is not valid semver');
  });

  test('validateSceneUnpublishOptions returns null for valid options', () => {
    expect(validateSceneUnpublishOptions({ name: 'pkg', version: '1.0.0' })).toBeNull();
    expect(validateSceneUnpublishOptions({ name: 'pkg', version: '1.0.0-beta.1' })).toBeNull();
  });

  test('printSceneUnpublishSummary outputs JSON in json mode', () => {
    const payload = {
      unpublished: true,
      coordinate: 'kse.scene/test-pkg@1.0.0',
      package: { name: 'test-pkg', version: '1.0.0' },
      remaining_versions: 2,
      new_latest: '0.9.0',
      registry: { index_path: '.kiro/registry/registry-index.json' }
    };
    printSceneUnpublishSummary({ json: true }, payload, '/project');
    expect(console.log).toHaveBeenCalled();
    const output = console.log.mock.calls.map(c => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.unpublished).toBe(true);
    expect(parsed.coordinate).toBe('kse.scene/test-pkg@1.0.0');
    expect(parsed.remaining_versions).toBe(2);
  });

  test('printSceneUnpublishSummary outputs human-readable summary', () => {
    const payload = {
      unpublished: true,
      coordinate: 'kse.scene/test-pkg@1.0.0',
      package: { name: 'test-pkg', version: '1.0.0' },
      remaining_versions: 2,
      new_latest: '0.9.0',
      registry: { index_path: '.kiro/registry/registry-index.json' }
    };
    printSceneUnpublishSummary({ json: false }, payload, '/project');
    const output = console.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Scene Package Unpublish');
    expect(output).toContain('kse.scene/test-pkg@1.0.0');
    expect(output).toContain('Remaining versions: 2');
    expect(output).toContain('New latest: 0.9.0');
  });

  test('printSceneUnpublishSummary omits new_latest when null', () => {
    const payload = {
      unpublished: true,
      coordinate: 'kse.scene/test-pkg@1.0.0',
      package: { name: 'test-pkg', version: '1.0.0' },
      remaining_versions: 0,
      new_latest: null,
      registry: { index_path: '.kiro/registry/registry-index.json' }
    };
    printSceneUnpublishSummary({ json: false }, payload, '/project');
    const output = console.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Remaining versions: 0');
    expect(output).not.toContain('New latest');
  });

  test('runSceneUnpublishCommand returns null when --name is missing', async () => {
    const result = await runSceneUnpublishCommand({}, { projectRoot: '/project' });
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  test('runSceneUnpublishCommand returns null when --version is invalid semver', async () => {
    const result = await runSceneUnpublishCommand(
      { name: 'pkg', version: 'bad' },
      { projectRoot: '/project' }
    );
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  test('runSceneUnpublishCommand returns null when package not found in index', async () => {
    const existingIndex = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {}
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(existingIndex),
      writeJson: jest.fn().mockResolvedValue(undefined)
    };

    const result = await runSceneUnpublishCommand(
      { name: 'nonexistent', version: '1.0.0' },
      { projectRoot: '/project', fileSystem: mockFileSystem }
    );

    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  test('runSceneUnpublishCommand returns null when version not found for package', async () => {
    const existingIndex = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {
        'my-pkg': {
          name: 'my-pkg',
          group: 'kse.scene',
          latest: '1.0.0',
          versions: {
            '1.0.0': { published_at: '2025-01-01T00:00:00.000Z', integrity: 'sha256-abc' }
          }
        }
      }
    };

    const mockFileSystem = {
      readJson: jest.fn().mockResolvedValue(JSON.parse(JSON.stringify(existingIndex))),
      writeJson: jest.fn().mockResolvedValue(undefined)
    };

    const result = await runSceneUnpublishCommand(
      { name: 'my-pkg', version: '2.0.0' },
      { projectRoot: '/project', fileSystem: mockFileSystem }
    );

    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  test('runSceneUnpublishCommand successfully removes version and updates index', async () => {
    const existingIndex = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {
        'my-pkg': {
          name: 'my-pkg',
          group: 'kse.scene',
          description: 'Test package',
          latest: '2.0.0',
          versions: {
            '1.0.0': { published_at: '2025-01-01T00:00:00.000Z', integrity: 'sha256-aaa', tarball: 'packages/my-pkg/1.0.0/my-pkg-1.0.0.tgz' },
            '2.0.0': { published_at: '2025-01-15T00:00:00.000Z', integrity: 'sha256-bbb', tarball: 'packages/my-pkg/2.0.0/my-pkg-2.0.0.tgz' }
          }
        }
      }
    };

    let savedIndex = null;
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      readJson: jest.fn().mockResolvedValue(JSON.parse(JSON.stringify(existingIndex))),
      writeJson: jest.fn().mockImplementation((filePath, data) => {
        if (String(filePath).endsWith('registry-index.json')) {
          savedIndex = data;
        }
        return Promise.resolve(undefined);
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue([])
    };

    const result = await runSceneUnpublishCommand(
      { name: 'my-pkg', version: '2.0.0', json: true },
      { projectRoot: '/project', fileSystem: mockFileSystem }
    );

    expect(result).not.toBeNull();
    expect(result.unpublished).toBe(true);
    expect(result.coordinate).toBe('kse.scene/my-pkg@2.0.0');
    expect(result.package.name).toBe('my-pkg');
    expect(result.package.version).toBe('2.0.0');
    expect(result.remaining_versions).toBe(1);
    expect(result.new_latest).toBe('1.0.0');

    // Verify index was saved without the removed version
    expect(savedIndex).not.toBeNull();
    expect(savedIndex.packages['my-pkg']).toBeDefined();
    expect(savedIndex.packages['my-pkg'].versions['2.0.0']).toBeUndefined();
    expect(savedIndex.packages['my-pkg'].versions['1.0.0']).toBeDefined();
    expect(savedIndex.packages['my-pkg'].latest).toBe('1.0.0');
  });

  test('runSceneUnpublishCommand removes package entry when last version is unpublished', async () => {
    const existingIndex = {
      apiVersion: 'kse.scene.registry/v0.1',
      packages: {
        'solo-pkg': {
          name: 'solo-pkg',
          group: 'kse.scene',
          description: 'Solo package',
          latest: '1.0.0',
          versions: {
            '1.0.0': { published_at: '2025-01-01T00:00:00.000Z', integrity: 'sha256-solo', tarball: 'packages/solo-pkg/1.0.0/solo-pkg-1.0.0.tgz' }
          }
        }
      }
    };

    let savedIndex = null;
    const mockFileSystem = {
      pathExists: jest.fn().mockResolvedValue(true),
      readJson: jest.fn().mockResolvedValue(JSON.parse(JSON.stringify(existingIndex))),
      writeJson: jest.fn().mockImplementation((filePath, data) => {
        if (String(filePath).endsWith('registry-index.json')) {
          savedIndex = data;
        }
        return Promise.resolve(undefined);
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue([])
    };

    const result = await runSceneUnpublishCommand(
      { name: 'solo-pkg', version: '1.0.0', json: true },
      { projectRoot: '/project', fileSystem: mockFileSystem }
    );

    expect(result).not.toBeNull();
    expect(result.unpublished).toBe(true);
    expect(result.remaining_versions).toBe(0);
    expect(result.new_latest).toBeNull();

    // Verify package entry was removed entirely
    expect(savedIndex).not.toBeNull();
    expect(savedIndex.packages['solo-pkg']).toBeUndefined();
  });
});

// ─── Scene Extract CLI Tests ──────────────────────────────────────

describe('Scene Extract CLI', () => {
  // ─── normalizeSceneExtractOptions ─────────────────────────────

  test('normalizeSceneExtractOptions returns defaults', () => {
    const result = normalizeSceneExtractOptions({});
    expect(result.config).toBeUndefined();
    expect(result.type).toBeUndefined();
    expect(result.pattern).toBeUndefined();
    expect(result.out).toBe('.kiro/templates/extracted');
    expect(result.dryRun).toBe(false);
    expect(result.json).toBe(false);
  });

  test('normalizeSceneExtractOptions trims and converts values', () => {
    const result = normalizeSceneExtractOptions({
      config: '  my-config.json  ',
      type: '  entities  ',
      pattern: '  crud  ',
      out: '  /custom/out  ',
      dryRun: true,
      json: true
    });
    expect(result.config).toBe('my-config.json');
    expect(result.type).toBe('entities');
    expect(result.pattern).toBe('crud');
    expect(result.out).toBe('/custom/out');
    expect(result.dryRun).toBe(true);
    expect(result.json).toBe(true);
  });

  test('normalizeSceneExtractOptions coerces non-boolean dryRun/json to false', () => {
    const result = normalizeSceneExtractOptions({ dryRun: 'yes', json: 1 });
    expect(result.dryRun).toBe(false);
    expect(result.json).toBe(false);
  });

  // ─── validateSceneExtractOptions ──────────────────────────────

  test('validateSceneExtractOptions returns null for valid options', () => {
    expect(validateSceneExtractOptions({ type: 'entities', pattern: 'crud' })).toBeNull();
    expect(validateSceneExtractOptions({ type: 'services', pattern: 'query' })).toBeNull();
    expect(validateSceneExtractOptions({ type: 'screens', pattern: 'workflow' })).toBeNull();
    expect(validateSceneExtractOptions({})).toBeNull();
  });

  test('validateSceneExtractOptions returns error for invalid type', () => {
    const err = validateSceneExtractOptions({ type: 'invalid' });
    expect(err).not.toBeNull();
    expect(err).toContain('invalid --type');
    expect(err).toContain('invalid');
  });

  test('validateSceneExtractOptions returns error for invalid pattern', () => {
    const err = validateSceneExtractOptions({ pattern: 'unknown' });
    expect(err).not.toBeNull();
    expect(err).toContain('invalid --pattern');
    expect(err).toContain('unknown');
  });

  // ─── printSceneExtractSummary ─────────────────────────────────

  test('printSceneExtractSummary outputs JSON in json mode', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const payload = {
      success: true,
      templates: [],
      summary: { totalTemplates: 2, patterns: { crud: 1, query: 1, workflow: 0 }, outputDir: '/out' },
      warnings: []
    };
    printSceneExtractSummary({ json: true }, payload);
    expect(spy).toHaveBeenCalledWith(JSON.stringify(payload, null, 2));
    spy.mockRestore();
  });

  test('printSceneExtractSummary outputs human-readable summary', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const payload = {
      success: true,
      templates: [],
      summary: { totalTemplates: 3, patterns: { crud: 2, query: 1, workflow: 0 }, outputDir: '/out' },
      warnings: []
    };
    printSceneExtractSummary({ json: false }, payload);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('3');
    expect(output).toContain('CRUD');
    expect(output).toContain('Query');
    spy.mockRestore();
  });

  test('printSceneExtractSummary shows dry-run indicator', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const payload = {
      success: true,
      templates: [],
      summary: { totalTemplates: 0, patterns: { crud: 0, query: 0, workflow: 0 }, outputDir: '/out' },
      warnings: []
    };
    printSceneExtractSummary({ json: false, dryRun: true }, payload);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('dry-run');
    spy.mockRestore();
  });

  test('printSceneExtractSummary shows error on failure', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const payload = {
      success: false,
      error: { code: 'AUTH_FAILED', message: 'Login failed' }
    };
    printSceneExtractSummary({ json: false }, payload);
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Login failed');
    spy.mockRestore();
  });

  // ─── runSceneExtractCommand ───────────────────────────────────

  test('runSceneExtractCommand returns null when --type is invalid', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const result = await runSceneExtractCommand({ type: 'badtype' });
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
    process.exitCode = 0;
  });

  test('runSceneExtractCommand returns null when --pattern is invalid', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const result = await runSceneExtractCommand({ pattern: 'badpattern' });
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
    process.exitCode = 0;
  });
});

// ─── Scene Ontology CLI Tests ──────────────────────────────────────

describe('Scene Ontology CLI', () => {
  // ─── normalizeOntologyOptions ─────────────────────────────────

  test('normalizeOntologyOptions returns defaults for empty input', () => {
    const result = normalizeOntologyOptions();
    expect(result).toEqual({ package: '.', json: false, ref: null });
  });

  test('normalizeOntologyOptions trims and preserves values', () => {
    const result = normalizeOntologyOptions({ package: '  ./pkg  ', json: true, ref: '  moqui.Order.list  ' });
    expect(result).toEqual({ package: './pkg', json: true, ref: 'moqui.Order.list' });
  });

  test('normalizeOntologyOptions handles non-boolean json', () => {
    const result = normalizeOntologyOptions({ json: 'yes' });
    expect(result.json).toBe(false);
  });

  // ─── validateOntologyOptions ──────────────────────────────────

  test('validateOntologyOptions returns null when ref not required', () => {
    expect(validateOntologyOptions({ ref: null }, false)).toBeNull();
  });

  test('validateOntologyOptions returns error when ref required but missing', () => {
    expect(validateOntologyOptions({ ref: null }, true)).toBe('--ref is required');
  });

  test('validateOntologyOptions returns null when ref required and present', () => {
    expect(validateOntologyOptions({ ref: 'a.b.c' }, true)).toBeNull();
  });

  // ─── runSceneOntologyShowCommand ──────────────────────────────

  test('runSceneOntologyShowCommand returns graph payload on success', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const contract = {
      capability_contract: {
        bindings: [
          { ref: 'moqui.Order.list', type: 'query' },
          { ref: 'moqui.Order.update', type: 'mutation' }
        ]
      }
    };
    const mockFs = { readJson: jest.fn().mockResolvedValue(contract) };
    const result = await runSceneOntologyShowCommand(
      { package: '.' },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.graph.nodes.length).toBe(2);
    spy.mockRestore();
  });

  test('runSceneOntologyShowCommand returns null on file read error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const mockFs = { readJson: jest.fn().mockRejectedValue(new Error('ENOENT')) };
    const result = await runSceneOntologyShowCommand(
      { package: './missing' },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
    process.exitCode = 0;
  });

  test('runSceneOntologyShowCommand outputs JSON when --json', async () => {
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    const contract = { capability_contract: { bindings: [{ ref: 'a.b', type: 'query' }] } };
    const mockFs = { readJson: jest.fn().mockResolvedValue(contract) };
    await runSceneOntologyShowCommand(
      { package: '.', json: true },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    const parsed = JSON.parse(logs[0]);
    expect(parsed.success).toBe(true);
    expect(parsed.graph).toBeDefined();
    spy.mockRestore();
  });

  // ─── runSceneOntologyDepsCommand ──────────────────────────────

  test('runSceneOntologyDepsCommand returns null when --ref missing', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const result = await runSceneOntologyDepsCommand({ package: '.' });
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
    process.exitCode = 0;
  });

  test('runSceneOntologyDepsCommand returns dependency chain', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const contract = {
      capability_contract: {
        bindings: [
          { ref: 'a.b.list', type: 'query' },
          { ref: 'a.b.update', type: 'mutation', depends_on: 'a.b.list' }
        ]
      }
    };
    const mockFs = { readJson: jest.fn().mockResolvedValue(contract) };
    const result = await runSceneOntologyDepsCommand(
      { package: '.', ref: 'a.b.update' },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    expect(result).not.toBeNull();
    expect(result.result.chain).toContain('a.b.list');
    spy.mockRestore();
  });

  // ─── runSceneOntologyValidateCommand ──────────────────────────

  test('runSceneOntologyValidateCommand returns valid result for consistent graph', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const contract = {
      capability_contract: {
        bindings: [
          { ref: 'x.y.a', type: 'query' },
          { ref: 'x.y.b', type: 'mutation' }
        ]
      }
    };
    const mockFs = { readJson: jest.fn().mockResolvedValue(contract) };
    const result = await runSceneOntologyValidateCommand(
      { package: '.' },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.result.valid).toBe(true);
    spy.mockRestore();
  });

  test('runSceneOntologyValidateCommand returns null on error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const mockFs = { readJson: jest.fn().mockRejectedValue(new Error('bad')) };
    const result = await runSceneOntologyValidateCommand(
      { package: '.' },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
    process.exitCode = 0;
  });

  // ─── runSceneOntologyActionsCommand ───────────────────────────

  test('runSceneOntologyActionsCommand returns null when --ref missing', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const result = await runSceneOntologyActionsCommand({ package: '.' });
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
    process.exitCode = 0;
  });

  test('runSceneOntologyActionsCommand returns action info', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const contract = {
      capability_contract: {
        bindings: [{
          ref: 'moqui.Order.list',
          type: 'query',
          intent: 'Fetch orders',
          preconditions: ['user.isAuth'],
          postconditions: ['result.length >= 0']
        }]
      }
    };
    const mockFs = { readJson: jest.fn().mockResolvedValue(contract) };
    const result = await runSceneOntologyActionsCommand(
      { package: '.', ref: 'moqui.Order.list' },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    expect(result).not.toBeNull();
    expect(result.result.intent).toBe('Fetch orders');
    expect(result.result.preconditions).toEqual(['user.isAuth']);
    spy.mockRestore();
  });

  // ─── runSceneOntologyLineageCommand ───────────────────────────

  test('runSceneOntologyLineageCommand returns null when --ref missing', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const result = await runSceneOntologyLineageCommand({ package: '.' });
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
    process.exitCode = 0;
  });

  test('runSceneOntologyLineageCommand returns lineage info', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const contract = {
      capability_contract: { bindings: [{ ref: 'a.b', type: 'query' }] },
      governance_contract: {
        data_lineage: {
          sources: [{ ref: 'a.b', fields: ['id'] }],
          transforms: [],
          sinks: []
        }
      }
    };
    const mockFs = { readJson: jest.fn().mockResolvedValue(contract) };
    const result = await runSceneOntologyLineageCommand(
      { package: '.', ref: 'a.b' },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    expect(result).not.toBeNull();
    expect(result.result.asSource.length).toBe(1);
    spy.mockRestore();
  });

  // ─── runSceneOntologyAgentInfoCommand ─────────────────────────

  test('runSceneOntologyAgentInfoCommand returns null agent_hints when not defined', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const contract = { capability_contract: { bindings: [] } };
    const mockFs = { readJson: jest.fn().mockResolvedValue(contract) };
    const result = await runSceneOntologyAgentInfoCommand(
      { package: '.' },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    expect(result).not.toBeNull();
    expect(result.result).toBeNull();
    spy.mockRestore();
  });

  test('runSceneOntologyAgentInfoCommand returns agent hints', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const contract = {
      capability_contract: { bindings: [] },
      agent_hints: {
        summary: 'Order workflow',
        complexity: 'medium',
        estimated_duration_ms: 5000,
        required_permissions: ['order.read'],
        suggested_sequence: ['step1'],
        rollback_strategy: 'reverse'
      }
    };
    const mockFs = { readJson: jest.fn().mockResolvedValue(contract) };
    const result = await runSceneOntologyAgentInfoCommand(
      { package: '.' },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    expect(result).not.toBeNull();
    expect(result.result.summary).toBe('Order workflow');
    expect(result.result.complexity).toBe('medium');
    spy.mockRestore();
  });

  test('runSceneOntologyAgentInfoCommand returns null on file error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const mockFs = { readJson: jest.fn().mockRejectedValue(new Error('ENOENT')) };
    const result = await runSceneOntologyAgentInfoCommand(
      { package: './missing' },
      { fileSystem: mockFs, projectRoot: '/test' }
    );
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
    process.exitCode = 0;
  });

  // ─── print functions ─────────────────────────────────────────

  test('printSceneOntologyShowSummary outputs JSON when json=true', () => {
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    printSceneOntologyShowSummary({ json: true }, { success: true, packageDir: '.', graph: { nodes: [], edges: [] } });
    const parsed = JSON.parse(logs[0]);
    expect(parsed.success).toBe(true);
    spy.mockRestore();
  });

  test('printSceneOntologyDepsSummary shows error message', () => {
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    printSceneOntologyDepsSummary({ json: false }, { result: { error: 'ref not found' } });
    expect(logs.some(l => l.includes('ref not found'))).toBe(true);
    spy.mockRestore();
  });

  test('printSceneOntologyValidateSummary shows valid message', () => {
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    printSceneOntologyValidateSummary({ json: false }, { packageDir: '.', result: { valid: true, errors: [] } });
    expect(logs.some(l => l.includes('consistent'))).toBe(true);
    spy.mockRestore();
  });

  test('printSceneOntologyActionsSummary outputs JSON when json=true', () => {
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    printSceneOntologyActionsSummary({ json: true }, { result: { ref: 'a', intent: null, preconditions: [], postconditions: [] } });
    const parsed = JSON.parse(logs[0]);
    expect(parsed.result.ref).toBe('a');
    spy.mockRestore();
  });

  test('printSceneOntologyLineageSummary shows no lineage message', () => {
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    printSceneOntologyLineageSummary({ json: false }, { result: { ref: 'x', asSource: [], asSink: [] } });
    expect(logs.some(l => l.includes('No lineage'))).toBe(true);
    spy.mockRestore();
  });

  test('printSceneOntologyAgentInfoSummary shows no hints message', () => {
    const logs = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    printSceneOntologyAgentInfoSummary({ json: false }, { packageDir: '.', result: null });
    expect(logs.some(l => l.includes('No agent_hints'))).toBe(true);
    spy.mockRestore();
  });
});
