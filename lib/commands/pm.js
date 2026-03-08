const chalk = require('chalk');
const fs = require('fs-extra');
const { ensureWriteAuthorization } = require('../security/write-authorization');
const { getSceStateStore } = require('../state/sce-state-store');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizePositiveInteger(value, fallback = 100, max = 1000) {
  const parsed = Number.parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function createStore(dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const env = dependencies.env || process.env;
  return dependencies.stateStore || getSceStateStore(projectPath, {
    fileSystem,
    env
  });
}

function countBy(items = [], key = 'status') {
  return items.reduce((acc, item) => {
    const value = normalizeString(item && item[key]) || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildStatus(statusLabel, attentionLevel, blockingSummary = '', recommendedAction = '') {
  return {
    attention_level: attentionLevel,
    status_tone: attentionLevel === 'high' ? 'warning' : (attentionLevel === 'medium' ? 'info' : 'success'),
    status_label: statusLabel,
    blocking_summary: blockingSummary,
    recommended_action: recommendedAction
  };
}

function attachRequirementViewModel(items = []) {
  return items.map((item) => ({
    ...item,
    mb_status: buildStatus(
      item.status === 'done' ? '已完成' : '待推进',
      item.issue_count > 0 ? 'high' : (item.priority === 'P0' ? 'medium' : 'low'),
      item.issue_count > 0 ? `关联问题 ${item.issue_count} 个` : '',
      item.acceptance_summary || '继续推进需求澄清与验收标准收敛'
    )
  }));
}

function attachTrackingViewModel(items = []) {
  return items.map((item) => ({
    ...item,
    mb_status: buildStatus(
      item.status === 'blocked' ? '已阻塞' : (item.status === 'done' ? '已完成' : '正常推进'),
      item.status === 'blocked' ? 'high' : (item.status === 'at_risk' ? 'medium' : 'low'),
      item.blocking_summary || '',
      item.next_action || '继续推进'
    )
  }));
}

function attachPlanViewModel(items = []) {
  return items.map((item) => ({
    ...item,
    mb_status: buildStatus(
      item.status === 'blocked' ? '已阻塞' : (item.status === 'done' ? '已完成' : '进行中'),
      item.status === 'blocked' ? 'high' : (item.risk_level === 'high' ? 'medium' : 'low'),
      item.next_checkpoint || '',
      item.progress_summary || '继续推进计划执行'
    )
  }));
}

function attachChangeViewModel(items = []) {
  return items.map((item) => ({
    ...item,
    mb_status: buildStatus(
      item.status === 'done' ? '已实施' : (item.status === 'approved' ? '已同意' : '评估中'),
      item.risk_level === 'high' ? 'high' : 'medium',
      item.impact_scope || '',
      item.decision || '继续评估变更影响'
    )
  }));
}

function attachIssueViewModel(items = []) {
  return items.map((item) => ({
    ...item,
    mb_status: buildStatus(
      item.status === 'closed' ? '已关闭' : (item.status === 'resolved' ? '已修复' : '待处理'),
      item.severity === 'critical' || item.severity === 'high' ? 'high' : 'medium',
      item.actual_result || '',
      item.latest_action || item.verify_result || '继续修复并验证'
    )
  }));
}

function buildTablePayload(mode, query, items, columns) {
  return {
    mode,
    query,
    summary: {
      total: items.length,
      by_status: countBy(items, 'status')
    },
    items,
    filters: [],
    sort: [{ key: 'updated_at', direction: 'desc' }],
    view_model: {
      type: 'table',
      columns
    },
    mb_status: {
      status_label: items.length > 0 ? '有数据' : '空状态',
      attention_level: items.length > 0 ? 'low' : 'medium'
    }
  };
}

function printPayload(payload, options = {}, title = 'PM') {
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(chalk.blue(title));
  if (payload.mode) console.log(`  Mode: ${payload.mode}`);
  if (payload.summary && typeof payload.summary === 'object') {
    for (const [key, value] of Object.entries(payload.summary)) {
      console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
  }
  if (Array.isArray(payload.items)) {
    payload.items.forEach((item) => {
      console.log(`  - ${item.title || item.requirement_id || item.plan_id || item.change_id || item.issue_id}`);
    });
  }
}

async function ensureAuthorized(action, options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const env = dependencies.env || process.env;
  await ensureWriteAuthorization(action, {
    authLease: options.authLease,
    authPassword: options.authPassword,
    actor: options.actor
  }, {
    projectPath,
    fileSystem,
    env
  });
}

async function readInputJson(inputFile, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const resolved = require('path').isAbsolute(inputFile)
    ? inputFile
    : require('path').join(projectPath, inputFile);
  return {
    resolved,
    payload: await fileSystem.readJson(resolved)
  };
}

async function runPmRequirementListCommand(options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const items = attachRequirementViewModel(await store.listPmRequirements({
    limit: normalizePositiveInteger(options.limit, 100, 1000),
    status: options.status,
    priority: options.priority,
    query: options.query
  }) || []);
  const payload = buildTablePayload('pm-requirement-list', {
    space: normalizeString(options.space) || 'engineering',
    resource: 'requirement'
  }, items, ['requirement_id', 'title', 'priority', 'status', 'owner', 'tracking_stage', 'acceptance_summary', 'issue_count', 'updated_at']);
  printPayload(payload, options, 'PM Requirement List');
  return payload;
}

async function runPmRequirementShowCommand(options = {}, dependencies = {}) {
  const id = normalizeString(options.id);
  if (!id) throw new Error('--id is required');
  const store = createStore(dependencies);
  const item = await store.getPmRequirement(id);
  if (!item) throw new Error(`requirement not found: ${id}`);
  const payload = {
    mode: 'pm-requirement-show',
    query: { id },
    item: attachRequirementViewModel([item])[0]
  };
  printPayload(payload, options, 'PM Requirement Show');
  return payload;
}

async function runPmRequirementUpsertCommand(options = {}, dependencies = {}) {
  const input = normalizeString(options.input);
  if (!input) throw new Error('--input is required');
  await ensureAuthorized('pm:requirement:upsert', options, dependencies);
  const { resolved, payload } = await readInputJson(input, dependencies);
  const store = createStore(dependencies);
  const item = await store.upsertPmRequirement(payload);
  const result = { mode: 'pm-requirement-upsert', success: true, input_file: resolved, item: attachRequirementViewModel([item])[0] };
  printPayload(result, options, 'PM Requirement Upsert');
  return result;
}

async function runPmTrackingBoardCommand(options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const items = attachTrackingViewModel(await store.listPmTracking({
    limit: normalizePositiveInteger(options.limit, 100, 1000),
    status: options.status,
    currentStage: options.currentStage,
    query: options.query
  }) || []);
  const payload = buildTablePayload('pm-tracking-board', { space: normalizeString(options.space) || 'engineering', resource: 'tracking' }, items, ['tracking_id', 'requirement_id', 'current_stage', 'status', 'latest_action', 'blocking_summary', 'next_action', 'owner', 'updated_at']);
  printPayload(payload, options, 'PM Tracking Board');
  return payload;
}

async function runPmTrackingShowCommand(options = {}, dependencies = {}) {
  const id = normalizeString(options.id);
  if (!id) throw new Error('--id is required');
  const store = createStore(dependencies);
  const item = await store.getPmTracking(id);
  if (!item) throw new Error(`tracking not found: ${id}`);
  const payload = { mode: 'pm-tracking-show', query: { id }, item: attachTrackingViewModel([item])[0] };
  printPayload(payload, options, 'PM Tracking Show');
  return payload;
}

async function runPmTrackingUpsertCommand(options = {}, dependencies = {}) {
  const input = normalizeString(options.input);
  if (!input) throw new Error('--input is required');
  await ensureAuthorized('pm:tracking:upsert', options, dependencies);
  const { resolved, payload } = await readInputJson(input, dependencies);
  const store = createStore(dependencies);
  const item = await store.upsertPmTracking(payload);
  const result = { mode: 'pm-tracking-upsert', success: true, input_file: resolved, item: attachTrackingViewModel([item])[0] };
  printPayload(result, options, 'PM Tracking Upsert');
  return result;
}

async function runPmPlanningBoardCommand(options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const items = attachPlanViewModel(await store.listPmPlans({
    limit: normalizePositiveInteger(options.limit, 100, 1000),
    status: options.status,
    query: options.query
  }) || []);
  const payload = buildTablePayload('pm-planning-board', { space: normalizeString(options.space) || 'engineering', resource: 'planning' }, items, ['plan_id', 'title', 'scope', 'start_date', 'due_date', 'status', 'owner', 'milestone', 'progress_summary', 'updated_at']);
  printPayload(payload, options, 'PM Planning Board');
  return payload;
}

async function runPmPlanningShowCommand(options = {}, dependencies = {}) {
  const id = normalizeString(options.id);
  if (!id) throw new Error('--id is required');
  const store = createStore(dependencies);
  const item = await store.getPmPlan(id);
  if (!item) throw new Error(`plan not found: ${id}`);
  const payload = { mode: 'pm-planning-show', query: { id }, item: attachPlanViewModel([item])[0] };
  printPayload(payload, options, 'PM Planning Show');
  return payload;
}

async function runPmPlanningUpsertCommand(options = {}, dependencies = {}) {
  const input = normalizeString(options.input);
  if (!input) throw new Error('--input is required');
  await ensureAuthorized('pm:planning:upsert', options, dependencies);
  const { resolved, payload } = await readInputJson(input, dependencies);
  const store = createStore(dependencies);
  const item = await store.upsertPmPlan(payload);
  const result = { mode: 'pm-planning-upsert', success: true, input_file: resolved, item: attachPlanViewModel([item])[0] };
  printPayload(result, options, 'PM Planning Upsert');
  return result;
}

async function runPmChangeListCommand(options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const items = attachChangeViewModel(await store.listPmChanges({
    limit: normalizePositiveInteger(options.limit, 100, 1000),
    status: options.status,
    query: options.query
  }) || []);
  const payload = buildTablePayload('pm-change-list', { space: normalizeString(options.space) || 'engineering', resource: 'change' }, items, ['change_id', 'title', 'change_type', 'impact_scope', 'decision', 'status', 'owner', 'updated_at']);
  printPayload(payload, options, 'PM Change List');
  return payload;
}

async function runPmChangeShowCommand(options = {}, dependencies = {}) {
  const id = normalizeString(options.id);
  if (!id) throw new Error('--id is required');
  const store = createStore(dependencies);
  const item = await store.getPmChange(id);
  if (!item) throw new Error(`change not found: ${id}`);
  const payload = { mode: 'pm-change-show', query: { id }, item: attachChangeViewModel([item])[0] };
  printPayload(payload, options, 'PM Change Show');
  return payload;
}

async function runPmChangeUpsertCommand(options = {}, dependencies = {}) {
  const input = normalizeString(options.input);
  if (!input) throw new Error('--input is required');
  await ensureAuthorized('pm:change:upsert', options, dependencies);
  const { resolved, payload } = await readInputJson(input, dependencies);
  const store = createStore(dependencies);
  const item = await store.upsertPmChange(payload);
  const result = { mode: 'pm-change-upsert', success: true, input_file: resolved, item: attachChangeViewModel([item])[0] };
  printPayload(result, options, 'PM Change Upsert');
  return result;
}

async function runPmIssueBoardCommand(options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const items = attachIssueViewModel(await store.listPmIssues({
    limit: normalizePositiveInteger(options.limit, 100, 1000),
    status: options.status,
    severity: options.severity,
    query: options.query
  }) || []);
  const payload = buildTablePayload('pm-issue-board', { space: normalizeString(options.space) || 'engineering', resource: 'issue' }, items, ['issue_id', 'title', 'source', 'severity', 'status', 'requirement_id', 'latest_action', 'verify_result', 'updated_at']);
  printPayload(payload, options, 'PM Issue Board');
  return payload;
}

async function runPmIssueShowCommand(options = {}, dependencies = {}) {
  const id = normalizeString(options.id);
  if (!id) throw new Error('--id is required');
  const store = createStore(dependencies);
  const item = await store.getPmIssue(id);
  if (!item) throw new Error(`issue not found: ${id}`);
  const payload = { mode: 'pm-issue-show', query: { id }, item: attachIssueViewModel([item])[0] };
  printPayload(payload, options, 'PM Issue Show');
  return payload;
}

async function runPmIssueUpsertCommand(options = {}, dependencies = {}) {
  const input = normalizeString(options.input);
  if (!input) throw new Error('--input is required');
  await ensureAuthorized('pm:issue:upsert', options, dependencies);
  const { resolved, payload } = await readInputJson(input, dependencies);
  const store = createStore(dependencies);
  const item = await store.upsertPmIssue(payload);
  const result = { mode: 'pm-issue-upsert', success: true, input_file: resolved, item: attachIssueViewModel([item])[0] };
  printPayload(result, options, 'PM Issue Upsert');
  return result;
}

function safeRun(handler, options = {}, context = 'pm command') {
  Promise.resolve(handler(options))
    .catch((error) => {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
      } else {
        console.error(chalk.red(`${context} failed:`), error.message);
      }
      process.exitCode = 1;
    });
}

function registerPmCommands(program) {
  const pm = program
    .command('pm')
    .description('Engineering delivery data plane for MagicBall engineering mode');

  const requirement = pm.command('requirement').description('Manage requirements');
  requirement.command('list').option('--space <space>', 'Space name', 'engineering').option('--limit <n>', 'Maximum rows', '100').option('--status <status>', 'Filter by status').option('--priority <priority>', 'Filter by priority').option('--query <text>', 'Free-text query').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmRequirementListCommand, options, 'pm requirement list'));
  requirement.command('show').requiredOption('--id <requirement-id>', 'Requirement id').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmRequirementShowCommand, options, 'pm requirement show'));
  requirement.command('upsert').requiredOption('--input <path>', 'Requirement JSON file').option('--auth-lease <lease-id>', 'Write authorization lease id').option('--auth-password <password>', 'Inline auth password if policy allows').option('--actor <actor>', 'Audit actor override').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmRequirementUpsertCommand, options, 'pm requirement upsert'));

  const tracking = pm.command('tracking').description('Manage tracking board items');
  tracking.command('board').option('--space <space>', 'Space name', 'engineering').option('--limit <n>', 'Maximum rows', '100').option('--status <status>', 'Filter by status').option('--current-stage <stage>', 'Filter by current stage').option('--query <text>', 'Free-text query').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmTrackingBoardCommand, options, 'pm tracking board'));
  tracking.command('show').requiredOption('--id <tracking-id>', 'Tracking id').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmTrackingShowCommand, options, 'pm tracking show'));
  tracking.command('upsert').requiredOption('--input <path>', 'Tracking JSON file').option('--auth-lease <lease-id>', 'Write authorization lease id').option('--auth-password <password>', 'Inline auth password if policy allows').option('--actor <actor>', 'Audit actor override').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmTrackingUpsertCommand, options, 'pm tracking upsert'));

  const planning = pm.command('planning').description('Manage delivery plans');
  planning.command('board').option('--space <space>', 'Space name', 'engineering').option('--limit <n>', 'Maximum rows', '100').option('--status <status>', 'Filter by status').option('--query <text>', 'Free-text query').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmPlanningBoardCommand, options, 'pm planning board'));
  planning.command('show').requiredOption('--id <plan-id>', 'Plan id').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmPlanningShowCommand, options, 'pm planning show'));
  planning.command('upsert').requiredOption('--input <path>', 'Plan JSON file').option('--auth-lease <lease-id>', 'Write authorization lease id').option('--auth-password <password>', 'Inline auth password if policy allows').option('--actor <actor>', 'Audit actor override').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmPlanningUpsertCommand, options, 'pm planning upsert'));

  const change = pm.command('change').description('Manage change requests');
  change.command('list').option('--space <space>', 'Space name', 'engineering').option('--limit <n>', 'Maximum rows', '100').option('--status <status>', 'Filter by status').option('--query <text>', 'Free-text query').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmChangeListCommand, options, 'pm change list'));
  change.command('show').requiredOption('--id <change-id>', 'Change id').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmChangeShowCommand, options, 'pm change show'));
  change.command('upsert').requiredOption('--input <path>', 'Change JSON file').option('--auth-lease <lease-id>', 'Write authorization lease id').option('--auth-password <password>', 'Inline auth password if policy allows').option('--actor <actor>', 'Audit actor override').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmChangeUpsertCommand, options, 'pm change upsert'));

  const issue = pm.command('issue').description('Manage issue board items');
  issue.command('board').option('--space <space>', 'Space name', 'engineering').option('--limit <n>', 'Maximum rows', '100').option('--status <status>', 'Filter by status').option('--severity <severity>', 'Filter by severity').option('--query <text>', 'Free-text query').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmIssueBoardCommand, options, 'pm issue board'));
  issue.command('show').requiredOption('--id <issue-id>', 'Issue id').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmIssueShowCommand, options, 'pm issue show'));
  issue.command('upsert').requiredOption('--input <path>', 'Issue JSON file').option('--auth-lease <lease-id>', 'Write authorization lease id').option('--auth-password <password>', 'Inline auth password if policy allows').option('--actor <actor>', 'Audit actor override').option('--json', 'Print machine-readable JSON output').action((options) => safeRun(runPmIssueUpsertCommand, options, 'pm issue upsert'));
}

module.exports = {
  runPmRequirementListCommand,
  runPmRequirementShowCommand,
  runPmRequirementUpsertCommand,
  runPmTrackingBoardCommand,
  runPmTrackingShowCommand,
  runPmTrackingUpsertCommand,
  runPmPlanningBoardCommand,
  runPmPlanningShowCommand,
  runPmPlanningUpsertCommand,
  runPmChangeListCommand,
  runPmChangeShowCommand,
  runPmChangeUpsertCommand,
  runPmIssueBoardCommand,
  runPmIssueShowCommand,
  runPmIssueUpsertCommand,
  registerPmCommands
};
