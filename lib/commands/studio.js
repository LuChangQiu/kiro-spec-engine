const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const chalk = require('chalk');

const STUDIO_JOB_API_VERSION = 'sce.studio.job/v0.1';
const STAGE_ORDER = ['plan', 'generate', 'apply', 'verify', 'release'];
const RELEASE_CHANNELS = new Set(['dev', 'prod']);
const STUDIO_EVENT_API_VERSION = 'sce.studio.event/v0.1';

function resolveStudioPaths(projectPath = process.cwd()) {
  const studioDir = path.join(projectPath, '.sce', 'studio');
  return {
    projectPath,
    studioDir,
    jobsDir: path.join(studioDir, 'jobs'),
    latestFile: path.join(studioDir, 'latest-job.json'),
    eventsDir: path.join(studioDir, 'events')
  };
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function createJobId(prefix = 'studio') {
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${Date.now()}-${random}`;
}

function createStageState() {
  return {
    plan: { status: 'pending', completed_at: null, metadata: {} },
    generate: { status: 'pending', completed_at: null, metadata: {} },
    apply: { status: 'pending', completed_at: null, metadata: {} },
    verify: { status: 'pending', completed_at: null, metadata: {} },
    release: { status: 'pending', completed_at: null, metadata: {} }
  };
}

async function ensureStudioDirectories(paths, fileSystem = fs) {
  await fileSystem.ensureDir(paths.jobsDir);
  await fileSystem.ensureDir(paths.eventsDir);
}

async function writeLatestJob(paths, jobId, fileSystem = fs) {
  await fileSystem.writeJson(paths.latestFile, {
    job_id: jobId,
    updated_at: nowIso()
  }, { spaces: 2 });
}

async function readLatestJob(paths, fileSystem = fs) {
  const exists = await fileSystem.pathExists(paths.latestFile);
  if (!exists) {
    return null;
  }

  const payload = await fileSystem.readJson(paths.latestFile);
  const jobId = normalizeString(payload.job_id);
  return jobId || null;
}

function getJobFilePath(paths, jobId) {
  return path.join(paths.jobsDir, `${jobId}.json`);
}

function getEventLogFilePath(paths, jobId) {
  return path.join(paths.eventsDir, `${jobId}.jsonl`);
}

async function saveJob(paths, job, fileSystem = fs) {
  const jobFile = getJobFilePath(paths, job.job_id);
  await fileSystem.writeJson(jobFile, job, { spaces: 2 });
}

async function appendStudioEvent(paths, job, eventType, metadata = {}, fileSystem = fs) {
  const event = {
    api_version: STUDIO_EVENT_API_VERSION,
    event_id: `evt-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    job_id: job.job_id,
    event_type: eventType,
    timestamp: nowIso(),
    metadata
  };
  const eventLine = `${JSON.stringify(event)}\n`;
  const eventFile = getEventLogFilePath(paths, job.job_id);
  await fileSystem.appendFile(eventFile, eventLine, 'utf8');
}

async function readStudioEvents(paths, jobId, options = {}, fileSystem = fs) {
  const { limit = 50 } = options;
  const eventFile = getEventLogFilePath(paths, jobId);
  const exists = await fileSystem.pathExists(eventFile);
  if (!exists) {
    return [];
  }

  const content = await fileSystem.readFile(eventFile, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = [];
  for (const line of lines) {
    try {
      const payload = JSON.parse(line);
      parsed.push(payload);
    } catch (_error) {
      // Ignore malformed lines to keep event stream robust.
    }
  }

  if (limit <= 0) {
    return parsed;
  }
  return parsed.slice(-limit);
}

async function loadJob(paths, jobId, fileSystem = fs) {
  const jobFile = getJobFilePath(paths, jobId);
  const exists = await fileSystem.pathExists(jobFile);
  if (!exists) {
    throw new Error(`Studio job not found: ${jobId}`);
  }
  return fileSystem.readJson(jobFile);
}

function resolveRequestedJobId(options, latestJobId) {
  const requested = normalizeString(options.job);
  if (requested) {
    return requested;
  }
  return latestJobId;
}

function buildProgress(job) {
  const completed = STAGE_ORDER.filter((stageName) => {
    const stage = job.stages && job.stages[stageName];
    return stage && stage.status === 'completed';
  }).length;

  return {
    completed,
    total: STAGE_ORDER.length,
    percent: Number(((completed / STAGE_ORDER.length) * 100).toFixed(2))
  };
}

function resolveNextAction(job) {
  if (job.status === 'rolled_back') {
    return 'sce studio plan --from-chat <session>';
  }
  if (!job.stages.plan || job.stages.plan.status !== 'completed') {
    return `sce studio plan --from-chat <session> --job ${job.job_id}`;
  }
  if (!job.stages.generate || job.stages.generate.status !== 'completed') {
    return `sce studio generate --scene <scene-id> --job ${job.job_id}`;
  }
  if (!job.stages.apply || job.stages.apply.status !== 'completed') {
    const patchBundleId = job.artifacts.patch_bundle_id || '<patch-bundle-id>';
    return `sce studio apply --patch-bundle ${patchBundleId} --job ${job.job_id}`;
  }
  if (!job.stages.verify || job.stages.verify.status !== 'completed') {
    return `sce studio verify --profile standard --job ${job.job_id}`;
  }
  if (!job.stages.release || job.stages.release.status !== 'completed') {
    return `sce studio release --channel dev --job ${job.job_id}`;
  }
  return 'complete';
}

function printStudioPayload(payload, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(chalk.blue(`Studio job: ${payload.job_id}`));
  console.log(`  Status: ${payload.status}`);
  console.log(`  Progress: ${payload.progress.completed}/${payload.progress.total} (${payload.progress.percent}%)`);
  console.log(`  Next: ${payload.next_action}`);
}

function ensureStageCompleted(job, stageName, metadata = {}) {
  if (!job.stages || !job.stages[stageName]) {
    job.stages = job.stages || createStageState();
    job.stages[stageName] = { status: 'pending', completed_at: null, metadata: {} };
  }

  job.stages[stageName] = {
    status: 'completed',
    completed_at: nowIso(),
    metadata
  };
}

function isStageCompleted(job, stageName) {
  return Boolean(job && job.stages && job.stages[stageName] && job.stages[stageName].status === 'completed');
}

function ensureStagePrerequisite(job, stageName, prerequisiteStage) {
  if (!isStageCompleted(job, prerequisiteStage)) {
    throw new Error(`Cannot run studio ${stageName}: stage "${prerequisiteStage}" is not completed`);
  }
}

function ensureNotRolledBack(job, stageName) {
  if (job.status === 'rolled_back') {
    throw new Error(`Cannot run studio ${stageName}: job ${job.job_id} is rolled back`);
  }
}

function buildCommandPayload(mode, job) {
  return {
    mode,
    success: true,
    job_id: job.job_id,
    status: job.status,
    progress: buildProgress(job),
    next_action: resolveNextAction(job),
    artifacts: { ...job.artifacts }
  };
}

async function runStudioPlanCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const fromChat = normalizeString(options.fromChat);

  if (!fromChat) {
    throw new Error('--from-chat is required');
  }

  const paths = resolveStudioPaths(projectPath);
  await ensureStudioDirectories(paths, fileSystem);

  const jobId = normalizeString(options.job) || createJobId();
  const now = nowIso();
  const stages = createStageState();
  stages.plan = {
    status: 'completed',
    completed_at: now,
    metadata: {
      from_chat: fromChat
    }
  };

  const job = {
    api_version: STUDIO_JOB_API_VERSION,
    job_id: jobId,
    created_at: now,
    updated_at: now,
    status: 'planned',
    source: {
      from_chat: fromChat,
      goal: normalizeString(options.goal) || null
    },
    scene: {
      id: null
    },
    target: normalizeString(options.target) || 'default',
    stages,
    artifacts: {
      patch_bundle_id: null,
      verify_report: null,
      release_ref: null
    }
  };

  await saveJob(paths, job, fileSystem);
  await appendStudioEvent(paths, job, 'stage.plan.completed', {
    from_chat: fromChat,
    target: job.target
  }, fileSystem);
  await writeLatestJob(paths, jobId, fileSystem);

  const payload = buildCommandPayload('studio-plan', job);
  printStudioPayload(payload, options);
  return payload;
}

async function runStudioGenerateCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const sceneId = normalizeString(options.scene);
  if (!sceneId) {
    throw new Error('--scene is required');
  }

  const paths = resolveStudioPaths(projectPath);
  await ensureStudioDirectories(paths, fileSystem);
  const latestJobId = await readLatestJob(paths, fileSystem);
  const jobId = resolveRequestedJobId(options, latestJobId);
  if (!jobId) {
    throw new Error('No studio job found. Run: sce studio plan --from-chat <session>');
  }

  const job = await loadJob(paths, jobId, fileSystem);
  ensureNotRolledBack(job, 'generate');
  ensureStagePrerequisite(job, 'generate', 'plan');
  const patchBundleId = normalizeString(options.patchBundle) || `patch-${sceneId}-${Date.now()}`;

  job.scene = job.scene || {};
  job.scene.id = sceneId;
  job.target = normalizeString(options.target) || job.target || 'default';
  job.status = 'generated';
  job.artifacts = job.artifacts || {};
  job.artifacts.patch_bundle_id = patchBundleId;
  job.updated_at = nowIso();

  ensureStageCompleted(job, 'generate', {
    scene_id: sceneId,
    target: job.target,
    patch_bundle_id: patchBundleId
  });

  await saveJob(paths, job, fileSystem);
  await appendStudioEvent(paths, job, 'stage.generate.completed', {
    scene_id: sceneId,
    target: job.target,
    patch_bundle_id: patchBundleId
  }, fileSystem);
  await writeLatestJob(paths, jobId, fileSystem);

  const payload = buildCommandPayload('studio-generate', job);
  printStudioPayload(payload, options);
  return payload;
}

async function runStudioApplyCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveStudioPaths(projectPath);
  await ensureStudioDirectories(paths, fileSystem);

  const latestJobId = await readLatestJob(paths, fileSystem);
  const jobId = resolveRequestedJobId(options, latestJobId);
  if (!jobId) {
    throw new Error('No studio job found. Run: sce studio plan --from-chat <session>');
  }

  const job = await loadJob(paths, jobId, fileSystem);
  ensureNotRolledBack(job, 'apply');
  ensureStagePrerequisite(job, 'apply', 'generate');
  const patchBundleId = normalizeString(options.patchBundle) || normalizeString(job.artifacts.patch_bundle_id);
  if (!patchBundleId) {
    throw new Error('--patch-bundle is required (or generate stage must provide one)');
  }

  job.status = 'applied';
  job.artifacts = job.artifacts || {};
  job.artifacts.patch_bundle_id = patchBundleId;
  job.updated_at = nowIso();

  ensureStageCompleted(job, 'apply', {
    patch_bundle_id: patchBundleId
  });

  await saveJob(paths, job, fileSystem);
  await appendStudioEvent(paths, job, 'stage.apply.completed', {
    patch_bundle_id: patchBundleId
  }, fileSystem);
  await writeLatestJob(paths, jobId, fileSystem);

  const payload = buildCommandPayload('studio-apply', job);
  printStudioPayload(payload, options);
  return payload;
}

async function runStudioVerifyCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveStudioPaths(projectPath);
  await ensureStudioDirectories(paths, fileSystem);

  const latestJobId = await readLatestJob(paths, fileSystem);
  const jobId = resolveRequestedJobId(options, latestJobId);
  if (!jobId) {
    throw new Error('No studio job found. Run: sce studio plan --from-chat <session>');
  }

  const profile = normalizeString(options.profile) || 'standard';
  const job = await loadJob(paths, jobId, fileSystem);
  ensureNotRolledBack(job, 'verify');
  ensureStagePrerequisite(job, 'verify', 'apply');

  job.status = 'verified';
  job.artifacts = job.artifacts || {};
  job.artifacts.verify_report = `.sce/reports/studio/verify-${job.job_id}.json`;
  job.updated_at = nowIso();

  ensureStageCompleted(job, 'verify', {
    profile,
    passed: true
  });

  await saveJob(paths, job, fileSystem);
  await appendStudioEvent(paths, job, 'stage.verify.completed', {
    profile,
    passed: true
  }, fileSystem);
  await writeLatestJob(paths, jobId, fileSystem);

  const payload = buildCommandPayload('studio-verify', job);
  printStudioPayload(payload, options);
  return payload;
}

async function runStudioReleaseCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveStudioPaths(projectPath);
  await ensureStudioDirectories(paths, fileSystem);

  const latestJobId = await readLatestJob(paths, fileSystem);
  const jobId = resolveRequestedJobId(options, latestJobId);
  if (!jobId) {
    throw new Error('No studio job found. Run: sce studio plan --from-chat <session>');
  }

  const channel = normalizeString(options.channel) || 'dev';
  if (!RELEASE_CHANNELS.has(channel)) {
    throw new Error(`Invalid --channel "${channel}". Expected one of: ${Array.from(RELEASE_CHANNELS).join(', ')}`);
  }

  const job = await loadJob(paths, jobId, fileSystem);
  ensureNotRolledBack(job, 'release');
  ensureStagePrerequisite(job, 'release', 'verify');
  const releaseRef = normalizeString(options.releaseRef) || `${channel}-${Date.now()}`;

  job.status = 'released';
  job.artifacts = job.artifacts || {};
  job.artifacts.release_ref = releaseRef;
  job.updated_at = nowIso();

  ensureStageCompleted(job, 'release', {
    channel,
    release_ref: releaseRef
  });

  await saveJob(paths, job, fileSystem);
  await appendStudioEvent(paths, job, 'stage.release.completed', {
    channel,
    release_ref: releaseRef
  }, fileSystem);
  await writeLatestJob(paths, jobId, fileSystem);

  const payload = buildCommandPayload('studio-release', job);
  printStudioPayload(payload, options);
  return payload;
}

async function runStudioResumeCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveStudioPaths(projectPath);
  await ensureStudioDirectories(paths, fileSystem);

  const latestJobId = await readLatestJob(paths, fileSystem);
  const jobId = resolveRequestedJobId(options, latestJobId);
  if (!jobId) {
    throw new Error('No studio job found. Run: sce studio plan --from-chat <session>');
  }

  const job = await loadJob(paths, jobId, fileSystem);
  const payload = buildCommandPayload('studio-resume', job);
  payload.success = true;
  printStudioPayload(payload, options);
  return payload;
}

async function runStudioRollbackCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveStudioPaths(projectPath);
  await ensureStudioDirectories(paths, fileSystem);

  const latestJobId = await readLatestJob(paths, fileSystem);
  const jobId = resolveRequestedJobId(options, latestJobId);
  if (!jobId) {
    throw new Error('No studio job found. Run: sce studio plan --from-chat <session>');
  }

  const reason = normalizeString(options.reason) || 'manual-rollback';
  const job = await loadJob(paths, jobId, fileSystem);
  if (!isStageCompleted(job, 'apply')) {
    throw new Error(`Cannot rollback studio job ${job.job_id}: apply stage is not completed`);
  }

  job.status = 'rolled_back';
  job.updated_at = nowIso();
  job.rollback = {
    reason,
    rolled_back_at: job.updated_at
  };

  await saveJob(paths, job, fileSystem);
  await appendStudioEvent(paths, job, 'job.rolled_back', {
    reason
  }, fileSystem);
  await writeLatestJob(paths, jobId, fileSystem);

  const payload = buildCommandPayload('studio-rollback', job);
  payload.rollback = { ...job.rollback };
  printStudioPayload(payload, options);
  return payload;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function printStudioEventsPayload(payload, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(chalk.blue(`Studio events: ${payload.job_id}`));
  console.log(`  Count: ${payload.events.length}`);
  for (const event of payload.events) {
    console.log(`  - ${event.timestamp} ${event.event_type}`);
  }
}

async function runStudioEventsCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveStudioPaths(projectPath);
  await ensureStudioDirectories(paths, fileSystem);

  const latestJobId = await readLatestJob(paths, fileSystem);
  const jobId = resolveRequestedJobId(options, latestJobId);
  if (!jobId) {
    throw new Error('No studio job found. Run: sce studio plan --from-chat <session>');
  }

  const limit = normalizePositiveInteger(options.limit, 50);
  const events = await readStudioEvents(paths, jobId, { limit }, fileSystem);

  const payload = {
    mode: 'studio-events',
    success: true,
    job_id: jobId,
    limit,
    events
  };
  printStudioEventsPayload(payload, options);
  return payload;
}

async function runStudioCommand(handler, options) {
  try {
    await handler(options);
  } catch (error) {
    console.error(chalk.red(`Studio command failed: ${error.message}`));
    process.exitCode = 1;
  }
}

function registerStudioCommands(program) {
  const studio = program
    .command('studio')
    .description('Run studio chat-to-release orchestration workflow');

  studio
    .command('plan')
    .description('Create/refresh a studio plan job from chat context')
    .requiredOption('--from-chat <session>', 'Chat session identifier or transcript reference')
    .option('--goal <goal>', 'Optional goal summary')
    .option('--target <target>', 'Target integration profile', 'default')
    .option('--job <job-id>', 'Reuse an explicit studio job id')
    .option('--json', 'Print machine-readable JSON output')
    .action(async (options) => runStudioCommand(runStudioPlanCommand, options));

  studio
    .command('generate')
    .description('Generate patch bundle metadata for a planned studio job')
    .requiredOption('--scene <scene-id>', 'Scene identifier to generate')
    .option('--target <target>', 'Target integration profile override')
    .option('--patch-bundle <id>', 'Explicit patch bundle id')
    .option('--job <job-id>', 'Studio job id (defaults to latest)')
    .option('--json', 'Print machine-readable JSON output')
    .action(async (options) => runStudioCommand(runStudioGenerateCommand, options));

  studio
    .command('apply')
    .description('Apply generated patch bundle metadata to studio job')
    .option('--patch-bundle <id>', 'Patch bundle identifier (defaults to generated artifact)')
    .option('--job <job-id>', 'Studio job id (defaults to latest)')
    .option('--json', 'Print machine-readable JSON output')
    .action(async (options) => runStudioCommand(runStudioApplyCommand, options));

  studio
    .command('verify')
    .description('Record verification stage for studio job')
    .option('--profile <profile>', 'Verification profile', 'standard')
    .option('--job <job-id>', 'Studio job id (defaults to latest)')
    .option('--json', 'Print machine-readable JSON output')
    .action(async (options) => runStudioCommand(runStudioVerifyCommand, options));

  studio
    .command('release')
    .description('Record release stage for studio job')
    .option('--channel <channel>', 'Release channel (dev|prod)', 'dev')
    .option('--release-ref <ref>', 'Explicit release reference/tag')
    .option('--job <job-id>', 'Studio job id (defaults to latest)')
    .option('--json', 'Print machine-readable JSON output')
    .action(async (options) => runStudioCommand(runStudioReleaseCommand, options));

  studio
    .command('resume')
    .description('Inspect current studio job and next action')
    .option('--job <job-id>', 'Studio job id (defaults to latest)')
    .option('--json', 'Print machine-readable JSON output')
    .action(async (options) => runStudioCommand(runStudioResumeCommand, options));

  studio
    .command('events')
    .description('Show studio job event stream')
    .option('--job <job-id>', 'Studio job id (defaults to latest)')
    .option('--limit <number>', 'Maximum number of recent events to return', '50')
    .option('--json', 'Print machine-readable JSON output')
    .action(async (options) => runStudioCommand(runStudioEventsCommand, options));

  studio
    .command('rollback')
    .description('Rollback a studio job after apply/release')
    .option('--job <job-id>', 'Studio job id (defaults to latest)')
    .option('--reason <reason>', 'Rollback reason')
    .option('--json', 'Print machine-readable JSON output')
    .action(async (options) => runStudioCommand(runStudioRollbackCommand, options));
}

module.exports = {
  STUDIO_JOB_API_VERSION,
  STUDIO_EVENT_API_VERSION,
  STAGE_ORDER,
  RELEASE_CHANNELS,
  resolveStudioPaths,
  createJobId,
  createStageState,
  readStudioEvents,
  readLatestJob,
  resolveNextAction,
  buildProgress,
  runStudioPlanCommand,
  runStudioGenerateCommand,
  runStudioApplyCommand,
  runStudioVerifyCommand,
  runStudioReleaseCommand,
  runStudioRollbackCommand,
  runStudioEventsCommand,
  runStudioResumeCommand,
  registerStudioCommands
};
