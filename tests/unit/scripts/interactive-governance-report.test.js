const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('interactive-governance-report script', () => {
  let tempDir;
  let projectRoot;
  let scriptPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-governance-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'interactive-governance-report.js');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  function runScript(workspace, args) {
    return spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: workspace,
      encoding: 'utf8'
    });
  }

  async function writeJsonl(filePath, items) {
    await fs.ensureDir(path.dirname(filePath));
    const text = items.map(item => JSON.stringify(item)).join('\n');
    await fs.writeFile(filePath, `${text}\n`, 'utf8');
  }

  test('computes governance metrics with healthy profile and no breach', async () => {
    const workspace = path.join(tempDir, 'workspace-healthy');
    await fs.ensureDir(workspace);

    const intentAudit = path.join(workspace, 'intent.jsonl');
    const approvalAudit = path.join(workspace, 'approval.jsonl');
    const executionLedger = path.join(workspace, 'execution.jsonl');
    const feedbackFile = path.join(workspace, 'feedback.jsonl');
    const authorizationTierSignals = path.join(workspace, 'authorization-tier-signals.jsonl');
    const thresholdsFile = path.join(workspace, 'thresholds.json');

    const now = new Date().toISOString();

    await writeJsonl(intentAudit, [
      { event_type: 'interactive.intent.generated', intent_id: 'i-1', timestamp: now },
      { event_type: 'interactive.intent.generated', intent_id: 'i-2', timestamp: now },
      { event_type: 'interactive.intent.generated', intent_id: 'i-3', timestamp: now },
      { event_type: 'interactive.intent.generated', intent_id: 'i-4', timestamp: now },
      { event_type: 'interactive.intent.generated', intent_id: 'i-5', timestamp: now }
    ]);

    await writeJsonl(approvalAudit, [
      { action: 'submit', blocked: false, timestamp: now },
      { action: 'approve', blocked: false, timestamp: now }
    ]);

    await writeJsonl(executionLedger, [
      { execution_id: 'e-1', result: 'success', policy_decision: 'allow', executed_at: now },
      { execution_id: 'e-2', result: 'success', policy_decision: 'allow', executed_at: now },
      { execution_id: 'e-3', result: 'success', policy_decision: 'allow', executed_at: now },
      { execution_id: 'e-4', result: 'success', policy_decision: 'allow', executed_at: now }
    ]);

    await writeJsonl(feedbackFile, [
      { satisfaction_score: 5, timestamp: now },
      { satisfaction_score: 4, timestamp: now },
      { satisfaction_score: 5, timestamp: now }
    ]);

    await writeJsonl(authorizationTierSignals, [
      { decision: 'allow', timestamp: now },
      { decision: 'allow', timestamp: now },
      { decision: 'allow', timestamp: now },
      { decision: 'review-required', timestamp: now }
    ]);

    await fs.writeJson(thresholdsFile, {
      adoption_rate_min_percent: 50,
      execution_success_rate_min_percent: 80,
      rollback_rate_max_percent: 30,
      security_intercept_rate_max_percent: 30,
      satisfaction_min_score: 4,
      min_feedback_samples: 2,
      min_authorization_tier_samples: 3,
      authorization_tier_block_rate_max_percent: 40
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--intent-audit', intentAudit,
      '--approval-audit', approvalAudit,
      '--execution-ledger', executionLedger,
      '--feedback-file', feedbackFile,
      '--authorization-tier-signals', authorizationTierSignals,
      '--thresholds', thresholdsFile,
      '--period', 'all',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-governance-report');
    expect(payload.metrics.adoption_rate_percent).toBe(80);
    expect(payload.metrics.execution_success_rate_percent).toBe(100);
    expect(payload.metrics.rollback_rate_percent).toBe(0);
    expect(payload.metrics.security_intercept_rate_percent).toBe(0);
    expect(payload.metrics.authorization_tier_deny_total).toBe(0);
    expect(payload.metrics.authorization_tier_review_required_total).toBe(1);
    expect(payload.metrics.authorization_tier_block_rate_percent).toBe(25);
    expect(payload.metrics.satisfaction_avg_score).toBe(4.67);
    expect(payload.summary.breaches).toBe(0);
  });

  test('emits breaches and exits 2 with --fail-on-alert', async () => {
    const workspace = path.join(tempDir, 'workspace-alert');
    await fs.ensureDir(workspace);

    const intentAudit = path.join(workspace, 'intent.jsonl');
    const approvalAudit = path.join(workspace, 'approval.jsonl');
    const executionLedger = path.join(workspace, 'execution.jsonl');
    const feedbackFile = path.join(workspace, 'feedback.jsonl');
    const authorizationTierSignals = path.join(workspace, 'authorization-tier-signals.jsonl');
    const thresholdsFile = path.join(workspace, 'thresholds.json');

    const now = new Date().toISOString();

    await writeJsonl(intentAudit, Array.from({ length: 10 }, (_, index) => ({
      event_type: 'interactive.intent.generated',
      intent_id: `i-${index + 1}`,
      timestamp: now
    })));

    await writeJsonl(approvalAudit, [
      { action: 'submit', blocked: false, timestamp: now },
      { action: 'approve', blocked: false, timestamp: now },
      { action: 'reject', blocked: false, timestamp: now }
    ]);

    await writeJsonl(executionLedger, [
      { execution_id: 'e-1', result: 'success', policy_decision: 'allow', executed_at: now },
      { execution_id: 'e-2', result: 'success', policy_decision: 'allow', executed_at: now },
      { execution_id: 'e-3', result: 'failed', policy_decision: 'allow', executed_at: now },
      { execution_id: 'e-4', result: 'failed', policy_decision: 'allow', executed_at: now },
      { execution_id: 'e-5', result: 'skipped', policy_decision: 'deny', executed_at: now },
      { execution_id: 'e-6', result: 'skipped', policy_decision: 'review-required', executed_at: now },
      { execution_id: 'e-7', result: 'skipped', policy_decision: 'deny', executed_at: now },
      { execution_id: 'e-8', result: 'skipped', policy_decision: 'deny', executed_at: now },
      { execution_id: 'e-9', result: 'rolled-back', policy_decision: 'allow', executed_at: now }
    ]);

    await writeJsonl(feedbackFile, [
      { satisfaction_score: 2, timestamp: now },
      { satisfaction_score: 3, timestamp: now }
    ]);

    await writeJsonl(authorizationTierSignals, [
      { decision: 'allow', timestamp: now },
      { decision: 'deny', timestamp: now },
      { decision: 'deny', timestamp: now },
      { decision: 'review-required', timestamp: now }
    ]);

    await fs.writeJson(thresholdsFile, {
      adoption_rate_min_percent: 50,
      execution_success_rate_min_percent: 80,
      rollback_rate_max_percent: 20,
      security_intercept_rate_max_percent: 30,
      satisfaction_min_score: 4,
      min_feedback_samples: 2,
      min_authorization_tier_samples: 3,
      authorization_tier_block_rate_max_percent: 40
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--intent-audit', intentAudit,
      '--approval-audit', approvalAudit,
      '--execution-ledger', executionLedger,
      '--feedback-file', feedbackFile,
      '--authorization-tier-signals', authorizationTierSignals,
      '--thresholds', thresholdsFile,
      '--period', 'all',
      '--fail-on-alert',
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.status).toBe('alert');
    expect(payload.summary.breaches).toBeGreaterThanOrEqual(4);
    expect(payload.alerts.map(item => item.id)).toEqual(expect.arrayContaining([
      'adoption-rate-low',
      'execution-success-low',
      'rollback-rate-high',
      'security-intercept-high',
      'satisfaction-low',
      'authorization-tier-block-rate-high'
    ]));
  });

  test('handles missing evidence files without crashing', async () => {
    const workspace = path.join(tempDir, 'workspace-empty');
    await fs.ensureDir(workspace);

    const thresholdsFile = path.join(workspace, 'thresholds.json');
    await fs.writeJson(thresholdsFile, {
      adoption_rate_min_percent: 30,
      execution_success_rate_min_percent: 90,
      rollback_rate_max_percent: 20,
      security_intercept_rate_max_percent: 60,
      satisfaction_min_score: 4,
      min_feedback_samples: 3
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--thresholds', thresholdsFile,
      '--period', 'all',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.metrics.intent_total).toBe(0);
    expect(payload.metrics.apply_total).toBe(0);
    expect(payload.metrics.adoption_rate_percent).toBe(null);
    expect(payload.summary.breaches).toBe(0);
    expect(payload.summary.warnings).toBeGreaterThanOrEqual(1);
  });

  test('consumes matrix signals and emits matrix regression alerts', async () => {
    const workspace = path.join(tempDir, 'workspace-matrix-alert');
    await fs.ensureDir(workspace);

    const intentAudit = path.join(workspace, 'intent.jsonl');
    const approvalAudit = path.join(workspace, 'approval.jsonl');
    const executionLedger = path.join(workspace, 'execution.jsonl');
    const feedbackFile = path.join(workspace, 'feedback.jsonl');
    const matrixSignals = path.join(workspace, 'matrix-signals.jsonl');
    const thresholdsFile = path.join(workspace, 'thresholds.json');

    const now = new Date().toISOString();

    await writeJsonl(intentAudit, [
      { event_type: 'interactive.intent.generated', intent_id: 'i-1', timestamp: now },
      { event_type: 'interactive.intent.generated', intent_id: 'i-2', timestamp: now },
      { event_type: 'interactive.intent.generated', intent_id: 'i-3', timestamp: now },
      { event_type: 'interactive.intent.generated', intent_id: 'i-4', timestamp: now },
      { event_type: 'interactive.intent.generated', intent_id: 'i-5', timestamp: now }
    ]);

    await writeJsonl(approvalAudit, [
      { action: 'submit', blocked: false, timestamp: now },
      { action: 'approve', blocked: false, timestamp: now }
    ]);

    await writeJsonl(executionLedger, [
      { execution_id: 'e-1', result: 'success', policy_decision: 'allow', executed_at: now },
      { execution_id: 'e-2', result: 'success', policy_decision: 'allow', executed_at: now },
      { execution_id: 'e-3', result: 'success', policy_decision: 'allow', executed_at: now },
      { execution_id: 'e-4', result: 'success', policy_decision: 'allow', executed_at: now }
    ]);

    await writeJsonl(feedbackFile, [
      { satisfaction_score: 5, timestamp: now },
      { satisfaction_score: 4, timestamp: now },
      { satisfaction_score: 5, timestamp: now }
    ]);

    await writeJsonl(matrixSignals, [
      {
        generated_at: now,
        matrix: {
          stage_status: 'completed',
          portfolio_passed: false,
          regression_count: 2,
          avg_score: 69,
          valid_rate_percent: 90
        }
      },
      {
        generated_at: now,
        matrix: {
          stage_status: 'non-zero-exit',
          portfolio_passed: false,
          regression_count: 1,
          avg_score: 68,
          valid_rate_percent: 85
        }
      },
      {
        generated_at: now,
        matrix: {
          stage_status: 'completed',
          portfolio_passed: true,
          regression_count: 0,
          avg_score: 75,
          valid_rate_percent: 100
        }
      }
    ]);

    await fs.writeJson(thresholdsFile, {
      adoption_rate_min_percent: 50,
      execution_success_rate_min_percent: 80,
      rollback_rate_max_percent: 30,
      security_intercept_rate_max_percent: 30,
      satisfaction_min_score: 4,
      min_feedback_samples: 2,
      min_matrix_samples: 2,
      matrix_portfolio_pass_rate_min_percent: 80,
      matrix_regression_positive_rate_max_percent: 10,
      matrix_stage_error_rate_max_percent: 10
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--intent-audit', intentAudit,
      '--approval-audit', approvalAudit,
      '--execution-ledger', executionLedger,
      '--feedback-file', feedbackFile,
      '--matrix-signals', matrixSignals,
      '--thresholds', thresholdsFile,
      '--period', 'all',
      '--fail-on-alert',
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.metrics.matrix_signal_total).toBe(3);
    expect(payload.metrics.matrix_portfolio_pass_rate_percent).toBe(33.33);
    expect(payload.metrics.matrix_regression_positive_rate_percent).toBe(66.67);
    expect(payload.metrics.matrix_stage_error_rate_percent).toBe(33.33);
    expect(payload.alerts.map(item => item.id)).toEqual(expect.arrayContaining([
      'matrix-portfolio-pass-rate-low',
      'matrix-regression-rate-high',
      'matrix-stage-error-rate-high'
    ]));
  });

  test('treats low intent sample as warning instead of breach', async () => {
    const workspace = path.join(tempDir, 'workspace-low-intent-sample');
    await fs.ensureDir(workspace);

    const intentAudit = path.join(workspace, 'intent.jsonl');
    const thresholdsFile = path.join(workspace, 'thresholds.json');
    const now = new Date().toISOString();

    await writeJsonl(intentAudit, [
      { event_type: 'interactive.intent.generated', intent_id: 'i-1', timestamp: now },
      { event_type: 'interactive.intent.generated', intent_id: 'i-2', timestamp: now }
    ]);

    await fs.writeJson(thresholdsFile, {
      min_intent_samples: 5,
      adoption_rate_min_percent: 50,
      execution_success_rate_min_percent: 90,
      rollback_rate_max_percent: 20,
      security_intercept_rate_max_percent: 60,
      satisfaction_min_score: 4,
      min_feedback_samples: 3
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--intent-audit', intentAudit,
      '--thresholds', thresholdsFile,
      '--period', 'all',
      '--fail-on-alert',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.breaches).toBe(0);
    expect(payload.alerts.map(item => item.id)).toContain('adoption-sample-insufficient');
    expect(payload.alerts.map(item => item.id)).not.toContain('adoption-rate-low');
  });
});
