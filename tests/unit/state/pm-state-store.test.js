const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { SceStateStore } = require('../../../lib/state/sce-state-store');

describe('sce-state-store pm delivery data plane', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-pm-store-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('upserts and reads all five pm registries in memory fallback', async () => {
    const store = new SceStateStore(tempDir, {
      fileSystem: fs,
      env: { NODE_ENV: 'test' },
      sqliteModule: {}
    });

    const requirement = await store.upsertPmRequirement({
      requirement_id: 'REQ-001',
      title: '需求清单字段规范与落库设计',
      source_request: '整理 requirement 对象',
      status: 'clarifying',
      priority: 'P1',
      acceptance_summary: '明确最小字段与契约'
    });
    const tracking = await store.upsertPmTracking({
      tracking_id: 'TRK-001',
      requirement_id: 'REQ-001',
      current_stage: 'designing',
      status: 'normal',
      next_action: '补齐最小 list/show/upsert 命令'
    });
    const plan = await store.upsertPmPlan({
      plan_id: 'PLN-001',
      title: '工程模式数据面一期',
      scope: 'Requirement/Tracking/Plan/Change/Issue 五对象',
      status: 'in_progress'
    });
    const change = await store.upsertPmChange({
      change_id: 'CR-001',
      title: '交付推进采用 sqlite 主链路',
      change_type: 'data',
      impact_scope: '工程模式 / 交付推进',
      status: 'approved'
    });
    const issue = await store.upsertPmIssue({
      issue_id: 'BUG-001',
      title: '工程模式未接入真实主数据',
      source: 'review',
      severity: 'medium',
      status: 'resolved'
    });

    expect(requirement.requirement_id).toBe('REQ-001');
    expect(tracking.tracking_id).toBe('TRK-001');
    expect(plan.plan_id).toBe('PLN-001');
    expect(change.change_id).toBe('CR-001');
    expect(issue.issue_id).toBe('BUG-001');

    expect((await store.listPmRequirements({ limit: 10 }))).toHaveLength(1);
    expect((await store.listPmTracking({ limit: 10 }))).toHaveLength(1);
    expect((await store.listPmPlans({ limit: 10 }))).toHaveLength(1);
    expect((await store.listPmChanges({ limit: 10 }))).toHaveLength(1);
    expect((await store.listPmIssues({ limit: 10 }))).toHaveLength(1);
  });
});
