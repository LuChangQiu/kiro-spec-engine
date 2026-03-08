const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { SceStateStore } = require('../../../lib/state/sce-state-store');
const {
  runPmRequirementListCommand,
  runPmRequirementShowCommand,
  runPmRequirementUpsertCommand,
  runPmTrackingBoardCommand,
  runPmPlanningBoardCommand,
  runPmChangeListCommand,
  runPmIssueBoardCommand
} = require('../../../lib/commands/pm');

describe('pm commands', () => {
  let tempDir;
  let originalLog;
  let stateStore;
  const testEnv = { NODE_ENV: 'test' };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-pm-command-'));
    originalLog = console.log;
    console.log = jest.fn();
    stateStore = new SceStateStore(tempDir, {
      fileSystem: fs,
      env: testEnv,
      sqliteModule: {}
    });
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('upserts requirement and returns delivery tables with view_model', async () => {
    const requirementFile = path.join(tempDir, 'requirement.json');
    await fs.writeJson(requirementFile, {
      requirement_id: 'REQ-001',
      title: '需求清单字段规范与落库设计',
      source_request: '整理 requirement 对象',
      status: 'clarifying',
      priority: 'P1',
      acceptance_summary: '明确最小字段与契约'
    }, { spaces: 2 });

    const requirement = await runPmRequirementUpsertCommand({ input: requirementFile, json: true }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });
    expect(requirement.item.requirement_id).toBe('REQ-001');
    expect(requirement.item.mb_status).toBeDefined();

    await stateStore.upsertPmTracking({
      tracking_id: 'TRK-001',
      requirement_id: 'REQ-001',
      current_stage: 'designing',
      status: 'normal',
      next_action: '补齐最小 list/show/upsert 命令'
    });
    await stateStore.upsertPmPlan({
      plan_id: 'PLN-001',
      title: '工程模式数据面一期',
      scope: 'Requirement/Tracking/Plan/Change/Issue 五对象',
      status: 'in_progress',
      progress_summary: '已完成 state store，继续做命令层'
    });
    await stateStore.upsertPmChange({
      change_id: 'CR-001',
      title: '交付推进采用 sqlite 主链路',
      change_type: 'data',
      impact_scope: '工程模式 / 交付推进',
      status: 'approved'
    });
    await stateStore.upsertPmIssue({
      issue_id: 'BUG-001',
      title: '工程模式未接入真实主数据',
      source: 'review',
      severity: 'medium',
      status: 'resolved',
      requirement_id: 'REQ-001'
    });

    const requirementList = await runPmRequirementListCommand({ json: true }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });
    expect(requirementList.view_model.type).toBe('table');
    expect(requirementList.items[0].requirement_id).toBe('REQ-001');

    const requirementShow = await runPmRequirementShowCommand({ id: 'REQ-001', json: true }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });
    expect(requirementShow.item.title).toBe('需求清单字段规范与落库设计');

    const trackingBoard = await runPmTrackingBoardCommand({ json: true }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });
    expect(trackingBoard.items[0].tracking_id).toBe('TRK-001');
    expect(trackingBoard.view_model.columns).toContain('next_action');

    const planningBoard = await runPmPlanningBoardCommand({ json: true }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });
    expect(planningBoard.items[0].plan_id).toBe('PLN-001');

    const changeList = await runPmChangeListCommand({ json: true }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });
    expect(changeList.items[0].change_id).toBe('CR-001');

    const issueBoard = await runPmIssueBoardCommand({ json: true }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });
    expect(issueBoard.items[0].issue_id).toBe('BUG-001');
    expect(issueBoard.items[0].mb_status.status_label).toBe('已修复');
  });
});
