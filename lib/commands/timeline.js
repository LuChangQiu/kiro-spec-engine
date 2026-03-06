const { spawnSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs-extra');
const {
  ProjectTimelineStore,
  captureTimelineCheckpoint
} = require('../runtime/project-timeline');

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizePositiveInteger(value, fallback, max = 10000) {
  const parsed = Number.parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalizeText(`${value || ''}`).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function createStore(dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  return dependencies.timelineStore || new ProjectTimelineStore(projectPath, fileSystem);
}

function summarizeTimelineAttention(entry = {}) {
  const trigger = normalizeText(entry.trigger).toLowerCase();
  const git = entry && typeof entry.git === 'object' ? entry.git : {};
  if (trigger === 'restore') {
    return 'high';
  }
  if (trigger === 'push') {
    return 'medium';
  }
  if (Number(git.dirty_count || 0) > 0) {
    return 'medium';
  }
  return 'low';
}

function buildTimelineEntryViewModel(entry = {}) {
  const title = normalizeText(entry.summary) || ((normalizeText(entry.trigger) || 'timeline') + ' checkpoint');
  const subtitleParts = [
    normalizeText(entry.event),
    entry.scene_id ? ('scene=' + entry.scene_id) : '',
    Number.isFinite(Number(entry.file_count)) ? ('files=' + Number(entry.file_count)) : ''
  ].filter(Boolean);
  return {
    snapshot_id: normalizeText(entry.snapshot_id) || null,
    title,
    subtitle: subtitleParts.join(' | '),
    trigger: normalizeText(entry.trigger) || null,
    event: normalizeText(entry.event) || null,
    created_at: normalizeText(entry.created_at) || null,
    scene_id: normalizeText(entry.scene_id) || null,
    session_id: normalizeText(entry.session_id) || null,
    file_count: Number.isFinite(Number(entry.file_count)) ? Number(entry.file_count) : 0,
    branch: entry && entry.git ? normalizeText(entry.git.branch) || null : null,
    head: entry && entry.git ? normalizeText(entry.git.head) || null : null,
    dirty_count: entry && entry.git && Number.isFinite(Number(entry.git.dirty_count)) ? Number(entry.git.dirty_count) : 0,
    attention_level: summarizeTimelineAttention(entry),
    show_command: normalizeText(entry.snapshot_id) ? ('sce timeline show ' + entry.snapshot_id + ' --json') : null,
    restore_command: normalizeText(entry.snapshot_id) ? ('sce timeline restore ' + entry.snapshot_id + ' --json') : null
  };
}

function buildTimelineListViewModel(payload = {}) {
  const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
  const trigger_counts = {};
  let dirty_snapshot_count = 0;
  const sceneIds = new Set();
  for (const item of snapshots) {
    const trigger = normalizeText(item.trigger) || 'unknown';
    trigger_counts[trigger] = Number(trigger_counts[trigger] || 0) + 1;
    if (item.scene_id) {
      sceneIds.add(item.scene_id);
    }
    if (item.git && item.git.dirty) {
      dirty_snapshot_count += 1;
    }
  }
  return {
    summary: {
      total: Number(payload.total || snapshots.length || 0),
      latest_snapshot_id: snapshots[0] ? normalizeText(snapshots[0].snapshot_id) || null : null,
      latest_created_at: snapshots[0] ? normalizeText(snapshots[0].created_at) || null : null,
      dirty_snapshot_count,
      scene_count: sceneIds.size,
      trigger_counts
    },
    entries: snapshots.map((item) => buildTimelineEntryViewModel(item))
  };
}

function buildTimelineShowViewModel(payload = {}) {
  const snapshot = payload.snapshot && typeof payload.snapshot === 'object' ? payload.snapshot : {};
  const filesPayload = payload.files && typeof payload.files === 'object' ? payload.files : {};
  const files = Array.isArray(filesPayload.files) ? filesPayload.files : [];
  return {
    snapshot: buildTimelineEntryViewModel(snapshot),
    files_preview: files.slice(0, 20),
    file_preview_count: Math.min(files.length, 20),
    file_total: Number(filesPayload.file_count || files.length || 0),
    restore_command: snapshot.snapshot_id ? ('sce timeline restore ' + snapshot.snapshot_id + ' --json') : null
  };
}

function printPayload(payload, asJson = false, title = 'Timeline') {
  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(chalk.blue(title));
  if (payload.mode) {
    console.log(`  Mode: ${payload.mode}`);
  }
  if (payload.snapshot && payload.snapshot.snapshot_id) {
    console.log(`  Snapshot: ${payload.snapshot.snapshot_id}`);
  }
  if (payload.snapshot_id) {
    console.log(`  Snapshot: ${payload.snapshot_id}`);
  }
  if (payload.restored_from) {
    console.log(`  Restored From: ${payload.restored_from}`);
  }
  if (typeof payload.total === 'number') {
    console.log(`  Total: ${payload.total}`);
  }
  if (Array.isArray(payload.snapshots)) {
    for (const item of payload.snapshots) {
      console.log(`  - ${item.snapshot_id} | ${item.trigger} | ${item.created_at} | files=${item.file_count}`);
    }
  }
  if (payload.created === false && payload.reason) {
    console.log(`  Skipped: ${payload.reason}`);
  }
}

async function runTimelineSaveCommand(options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const payload = await store.saveSnapshot({
    trigger: normalizeText(options.trigger) || 'manual',
    event: normalizeText(options.event) || 'manual.save',
    summary: normalizeText(options.summary),
    command: normalizeText(options.command)
  });

  const result = {
    mode: 'timeline-save',
    success: true,
    snapshot: payload
  };
  printPayload(result, options.json, 'Timeline Save');
  return result;
}

async function runTimelineAutoCommand(options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const payload = await store.maybeAutoSnapshot({
    event: normalizeText(options.event) || 'auto.tick',
    summary: normalizeText(options.summary),
    intervalMinutes: options.interval
  });

  printPayload(payload, options.json, 'Timeline Auto');
  return payload;
}

async function runTimelineListCommand(options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const payload = await store.listSnapshots({
    limit: normalizePositiveInteger(options.limit, 20, 2000),
    trigger: normalizeText(options.trigger)
  });
  payload.view_model = buildTimelineListViewModel(payload);
  printPayload(payload, options.json, 'Timeline List');
  return payload;
}

async function runTimelineShowCommand(snapshotId, options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const payload = await store.getSnapshot(snapshotId);
  payload.view_model = buildTimelineShowViewModel(payload);
  printPayload(payload, options.json, 'Timeline Show');
  return payload;
}

async function runTimelineRestoreCommand(snapshotId, options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const payload = await store.restoreSnapshot(snapshotId, {
    prune: normalizeBoolean(options.prune, false),
    preSave: options.preSave !== false
  });
  printPayload(payload, options.json, 'Timeline Restore');
  return payload;
}

async function runTimelineConfigCommand(options = {}, dependencies = {}) {
  const store = createStore(dependencies);

  const patch = {};
  if (typeof options.enabled !== 'undefined') {
    patch.enabled = normalizeBoolean(options.enabled, true);
  }
  if (typeof options.interval !== 'undefined') {
    patch.auto_interval_minutes = normalizePositiveInteger(options.interval, 30, 24 * 60);
  }
  if (typeof options.maxEntries !== 'undefined') {
    patch.max_entries = normalizePositiveInteger(options.maxEntries, 120, 10000);
  }

  const hasPatch = Object.keys(patch).length > 0;
  const payload = hasPatch
    ? await store.updateConfig(patch)
    : await store.getConfig();

  const result = {
    mode: 'timeline-config',
    success: true,
    updated: hasPatch,
    config: payload
  };
  printPayload(result, options.json, 'Timeline Config');
  return result;
}

async function runTimelinePushCommand(gitArgs = [], options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();

  const checkpoint = await captureTimelineCheckpoint({
    trigger: 'push',
    event: 'git.push.preflight',
    summary: normalizeText(options.summary) || 'pre-push timeline checkpoint',
    command: `git push ${Array.isArray(gitArgs) ? gitArgs.join(' ') : ''}`.trim()
  }, {
    projectPath,
    fileSystem: dependencies.fileSystem
  });

  const result = spawnSync('git', ['push', ...(Array.isArray(gitArgs) ? gitArgs : [])], {
    cwd: projectPath,
    stdio: 'inherit',
    windowsHide: true
  });

  const statusCode = Number.isInteger(result.status) ? result.status : 1;
  if (statusCode !== 0) {
    const error = new Error(`git push failed with exit code ${statusCode}`);
    error.exitCode = statusCode;
    throw error;
  }

  const payload = {
    mode: 'timeline-push',
    success: true,
    checkpoint,
    command: `git push ${Array.isArray(gitArgs) ? gitArgs.join(' ') : ''}`.trim()
  };

  printPayload(payload, options.json, 'Timeline Push');
  return payload;
}

async function safeRun(handler, options = {}, ...args) {
  try {
    await handler(...args, options);
  } catch (error) {
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
    } else {
      console.error(chalk.red('Timeline command failed:'), error.message);
    }
    process.exitCode = error.exitCode || 1;
  }
}

function registerTimelineCommands(program) {
  const timeline = program
    .command('timeline')
    .description('Project local timeline snapshots (auto/key-event/manual/restore)');

  timeline
    .command('save')
    .description('Create a manual timeline snapshot')
    .option('--trigger <trigger>', 'Trigger label', 'manual')
    .option('--event <event>', 'Event label', 'manual.save')
    .option('--summary <text>', 'Summary for this checkpoint')
    .option('--command <text>', 'Command context label')
    .option('--json', 'Output as JSON')
    .action(async (options) => safeRun(runTimelineSaveCommand, options));

  timeline
    .command('auto')
    .description('Run interval-based auto timeline snapshot check')
    .option('--interval <minutes>', 'Override auto interval minutes')
    .option('--event <event>', 'Event label', 'auto.tick')
    .option('--summary <text>', 'Summary for auto checkpoint')
    .option('--json', 'Output as JSON')
    .action(async (options) => safeRun(runTimelineAutoCommand, options));

  timeline
    .command('list')
    .description('List timeline snapshots')
    .option('--limit <n>', 'Maximum snapshots', '20')
    .option('--trigger <trigger>', 'Filter by trigger')
    .option('--json', 'Output as JSON')
    .action(async (options) => safeRun(runTimelineListCommand, options));

  timeline
    .command('show <snapshotId>')
    .description('Show one timeline snapshot')
    .option('--json', 'Output as JSON')
    .action(async (snapshotId, options) => safeRun(runTimelineShowCommand, options, snapshotId));

  timeline
    .command('restore <snapshotId>')
    .description('Restore workspace from a timeline snapshot')
    .option('--prune', 'Delete files not present in snapshot (dangerous)')
    .option('--no-pre-save', 'Do not create a pre-restore snapshot')
    .option('--json', 'Output as JSON')
    .action(async (snapshotId, options) => safeRun(runTimelineRestoreCommand, options, snapshotId));

  timeline
    .command('config')
    .description('Show/update timeline config')
    .option('--enabled <boolean>', 'Enable timeline (true/false)')
    .option('--interval <minutes>', 'Auto snapshot interval in minutes')
    .option('--max-entries <n>', 'Maximum retained snapshots')
    .option('--json', 'Output as JSON')
    .action(async (options) => safeRun(runTimelineConfigCommand, options));

  timeline
    .command('push [gitArgs...]')
    .description('Create a pre-push timeline snapshot, then run git push')
    .option('--summary <text>', 'Summary for pre-push checkpoint')
    .option('--json', 'Output as JSON')
    .action(async (gitArgs, options) => safeRun(runTimelinePushCommand, options, gitArgs));
}

module.exports = {
  runTimelineSaveCommand,
  runTimelineAutoCommand,
  runTimelineListCommand,
  runTimelineShowCommand,
  runTimelineRestoreCommand,
  runTimelineConfigCommand,
  runTimelinePushCommand,
  registerTimelineCommands
};
