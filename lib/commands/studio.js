const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs-extra');
const chalk = require('chalk');

const STUDIO_JOB_API_VERSION = 'sce.studio.job/v0.1';
const STAGE_ORDER = ['plan', 'generate', 'apply', 'verify', 'release'];
const RELEASE_CHANNELS = new Set(['dev', 'prod']);
const STUDIO_EVENT_API_VERSION = 'sce.studio.event/v0.1';
const VERIFY_PROFILES = new Set(['fast', 'standard', 'strict']);
const RELEASE_PROFILES = new Set(['standard', 'strict']);
const STUDIO_REPORTS_DIR = '.sce/reports/studio';
const MAX_OUTPUT_PREVIEW_LENGTH = 2000;
const DEFAULT_STUDIO_SECURITY_POLICY = Object.freeze({
  enabled: false,
  require_auth_for: ['apply', 'release', 'rollback'],
  password_env: 'SCE_STUDIO_AUTH_PASSWORD'
});

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

function clipOutput(value) {
  if (typeof value !== 'string') {
    return '';
  }
  if (value.length <= MAX_OUTPUT_PREVIEW_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_OUTPUT_PREVIEW_LENGTH)}...[truncated]`;
}

function defaultCommandRunner(command, args = [], options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10,
    windowsHide: true
  });

  return {
    status: Number.isInteger(result.status) ? result.status : 1,
    stdout: `${result.stdout || ''}`,
    stderr: `${result.stderr || ''}`,
    error: result.error ? `${result.error.message || result.error}` : null,
    duration_ms: Date.now() - startedAt
  };
}

function buildCommandString(command, args = []) {
  return [command, ...args].join(' ').trim();
}

function normalizeGateStep(step) {
  return {
    id: normalizeString(step.id),
    name: normalizeString(step.name) || normalizeString(step.id),
    command: normalizeString(step.command),
    args: Array.isArray(step.args) ? step.args.map((item) => `${item}`) : [],
    cwd: normalizeString(step.cwd) || null,
    enabled: step.enabled !== false,
    skip_reason: normalizeString(step.skip_reason),
    required: step.required !== false
  };
}

function createGateFailureFingerprint(failure = {}, context = {}) {
  const basis = JSON.stringify({
    stage: normalizeString(context.stage),
    profile: normalizeString(context.profile),
    job_id: normalizeString(context.job_id),
    step_id: normalizeString(failure.id),
    command: normalizeString(failure.command),
    exit_code: Number.isFinite(Number(failure.exit_code)) ? Number(failure.exit_code) : null,
    skip_reason: normalizeString(failure.skip_reason),
    stderr: normalizeString(failure?.output?.stderr || '').slice(0, 400)
  });
  const digest = crypto.createHash('sha1').update(basis).digest('hex').slice(0, 16);
  return `studio-gate-${digest}`;
}

async function autoRecordGateFailure(failure = {}, context = {}, dependencies = {}) {
  if (dependencies.autoRecordFailures === false) {
    return null;
  }

  try {
    const { runErrorbookRecordCommand } = require('./errorbook');
    const stage = normalizeString(context.stage) || 'verify';
    const profile = normalizeString(context.profile) || 'standard';
    const jobId = normalizeString(context.job_id);
    const stepId = normalizeString(failure.id) || normalizeString(failure.name) || 'unknown-step';
    const commandText = normalizeString(failure.command) || 'n/a';
    const skipReason = normalizeString(failure.skip_reason);
    const stderr = normalizeString(failure?.output?.stderr || '');
    const errorText = normalizeString(failure?.output?.error || '');
    const symptom = skipReason
      ? `Required studio ${stage} gate step "${stepId}" is unavailable: ${skipReason}.`
      : `Required studio ${stage} gate step "${stepId}" failed (exit=${failure.exit_code ?? 'n/a'}).`;
    const rootCause = skipReason
      ? `Gate dependency missing or disabled for studio ${stage} profile ${profile}; remediation required before release.`
      : `Gate command execution failure in studio ${stage} profile ${profile}; root cause analysis pending.`;
    const fixActions = [
      `Inspect failed gate step ${stepId} in studio ${stage} stage.`,
      `Rerun gate command: ${commandText}`
    ];
    if (stderr) {
      fixActions.push(`Analyze stderr signal: ${stderr.slice(0, 200)}`);
    } else if (errorText) {
      fixActions.push(`Analyze runtime error signal: ${errorText.slice(0, 200)}`);
    }

    const title = `[studio:${stage}] gate failure: ${stepId}`;
    const tags = ['studio', 'gate-failure', 'release-blocker', `stage-${stage}`];
    const fingerprint = createGateFailureFingerprint(failure, context);
    const specRef = normalizeString(context.scene_id) || jobId;

    const result = await runErrorbookRecordCommand({
      title,
      symptom,
      rootCause,
      fixAction: fixActions,
      tags: tags.join(','),
      ontology: 'execution_flow,decision_policy',
      status: 'candidate',
      fingerprint,
      spec: specRef,
      notes: `auto-captured from studio ${stage} gate`
    }, {
      projectPath: dependencies.projectPath || process.cwd(),
      fileSystem: dependencies.fileSystem || fs
    });

    return {
      errorbook_entry_id: result && result.entry ? result.entry.id : null,
      fingerprint
    };
  } catch (_error) {
    return null;
  }
}

async function executeGateSteps(steps, dependencies = {}) {
  const runner = dependencies.commandRunner || defaultCommandRunner;
  const projectPath = dependencies.projectPath || process.cwd();
  const env = dependencies.env || process.env;
  const failOnRequiredSkip = dependencies.failOnRequiredSkip === true;
  const onFailure = typeof dependencies.onFailure === 'function'
    ? dependencies.onFailure
    : null;

  const normalizedSteps = Array.isArray(steps) ? steps.map((step) => normalizeGateStep(step)) : [];
  const results = [];
  let hasFailure = false;

  for (const step of normalizedSteps) {
    if (!step.enabled) {
      const skippedAsFailure = failOnRequiredSkip && step.required;
      if (skippedAsFailure) {
        hasFailure = true;
      }
      results.push({
        id: step.id,
        name: step.name,
        status: skippedAsFailure ? 'failed' : 'skipped',
        required: step.required,
        command: buildCommandString(step.command, step.args),
        skip_reason: step.skip_reason || 'disabled',
        output: skippedAsFailure
          ? { stdout: '', stderr: '', error: 'required gate step disabled under strict profile' }
          : undefined
      });
      if (skippedAsFailure && onFailure) {
        const failure = results[results.length - 1];
        await Promise.resolve(onFailure({
          reason: 'required_skip',
          step,
          failure
        })).catch(() => {});
      }
      continue;
    }

    const startedAt = nowIso();
    const raw = await Promise.resolve(runner(step.command, step.args, {
      cwd: step.cwd || projectPath,
      env
    }));
    const statusCode = Number.isInteger(raw && raw.status) ? raw.status : 1;
    const passed = statusCode === 0;
    const endedAt = nowIso();
    const output = {
      stdout: clipOutput(raw && raw.stdout ? `${raw.stdout}` : ''),
      stderr: clipOutput(raw && raw.stderr ? `${raw.stderr}` : ''),
      error: raw && raw.error ? `${raw.error}` : null
    };
    const durationMs = Number.isFinite(Number(raw && raw.duration_ms))
      ? Number(raw.duration_ms)
      : null;

    results.push({
      id: step.id,
      name: step.name,
      status: passed ? 'passed' : 'failed',
      required: step.required,
      command: buildCommandString(step.command, step.args),
      exit_code: statusCode,
      started_at: startedAt,
      completed_at: endedAt,
      duration_ms: durationMs,
      output
    });

    if (!passed && step.required) {
      hasFailure = true;
      if (onFailure) {
        const failure = results[results.length - 1];
        await Promise.resolve(onFailure({
          reason: 'command_failed',
          step,
          failure
        })).catch(() => {});
      }
    }
  }

  return {
    passed: !hasFailure,
    steps: results
  };
}

async function readPackageJson(projectPath, fileSystem = fs) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const exists = await fileSystem.pathExists(packageJsonPath);
  if (!exists) {
    return null;
  }

  try {
    return await fileSystem.readJson(packageJsonPath);
  } catch (_error) {
    return null;
  }
}

function normalizeSecurityPolicy(policy) {
  const normalized = {
    enabled: policy && policy.enabled === true,
    require_auth_for: Array.isArray(policy && policy.require_auth_for)
      ? policy.require_auth_for
        .map((item) => normalizeString(item))
        .filter(Boolean)
      : [...DEFAULT_STUDIO_SECURITY_POLICY.require_auth_for],
    password_env: normalizeString(policy && policy.password_env) || DEFAULT_STUDIO_SECURITY_POLICY.password_env
  };
  return normalized;
}

async function loadStudioSecurityPolicy(projectPath, fileSystem = fs, env = process.env) {
  const policyPath = path.join(projectPath, '.sce', 'config', 'studio-security.json');
  let filePolicy = {};

  if (await fileSystem.pathExists(policyPath)) {
    try {
      filePolicy = await fileSystem.readJson(policyPath);
    } catch (error) {
      throw new Error(`Failed to read studio security policy: ${error.message}`);
    }
  }

  const envEnabled = `${env.SCE_STUDIO_REQUIRE_AUTH || ''}`.trim() === '1';
  const envPasswordVar = normalizeString(env.SCE_STUDIO_PASSWORD_ENV);

  return normalizeSecurityPolicy({
    ...DEFAULT_STUDIO_SECURITY_POLICY,
    ...filePolicy,
    enabled: envEnabled || filePolicy.enabled === true,
    password_env: envPasswordVar || filePolicy.password_env || DEFAULT_STUDIO_SECURITY_POLICY.password_env
  });
}

async function ensureStudioAuthorization(action, options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const env = dependencies.env || process.env;
  const policy = await loadStudioSecurityPolicy(projectPath, fileSystem, env);
  const requiredActions = new Set(policy.require_auth_for);
  const requiresAuth = options.requireAuth === true || (policy.enabled && requiredActions.has(action));

  if (!requiresAuth) {
    return {
      required: false,
      passed: true,
      policy
    };
  }

  const passwordEnv = normalizeString(policy.password_env) || DEFAULT_STUDIO_SECURITY_POLICY.password_env;
  const expectedPassword = normalizeString(dependencies.authSecret || env[passwordEnv]);
  if (!expectedPassword) {
    throw new Error(`Authorization required for studio ${action}, but ${passwordEnv} is not configured`);
  }

  const providedPassword = normalizeString(options.authPassword);
  if (!providedPassword) {
    throw new Error(`Authorization required for studio ${action}. Provide --auth-password`);
  }

  if (providedPassword !== expectedPassword) {
    throw new Error(`Authorization failed for studio ${action}: invalid password`);
  }

  return {
    required: true,
    passed: true,
    policy,
    password_env: passwordEnv
  };
}

async function buildVerifyGateSteps(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const profile = normalizeString(options.profile) || 'standard';

  if (!VERIFY_PROFILES.has(profile)) {
    throw new Error(`Invalid verify profile "${profile}". Expected one of: ${Array.from(VERIFY_PROFILES).join(', ')}`);
  }

  const packageJson = await readPackageJson(projectPath, fileSystem);
  const scripts = packageJson && packageJson.scripts ? packageJson.scripts : {};
  const hasUnit = typeof scripts['test:unit'] === 'string';
  const hasTest = typeof scripts.test === 'string';

  const steps = [];
  if (hasUnit || hasTest) {
    const npmCommand = hasUnit
      ? { args: ['run', 'test:unit', '--', '--runInBand'], name: 'npm run test:unit -- --runInBand', id: 'unit-tests' }
      : { args: ['test', '--', '--runInBand'], name: 'npm test -- --runInBand', id: 'tests' };
    steps.push({
      id: npmCommand.id,
      name: npmCommand.name,
      command: 'npm',
      args: npmCommand.args,
      required: true
    });
  } else {
    steps.push({
      id: 'tests',
      name: 'No npm test script',
      command: 'npm',
      args: ['test', '--', '--runInBand'],
      enabled: false,
      required: profile === 'strict',
      skip_reason: 'package.json test script not found'
    });
  }

  if (profile === 'standard' || profile === 'strict') {
    const governanceScript = path.join(projectPath, 'scripts', 'interactive-governance-report.js');
    const hasGovernanceScript = await fileSystem.pathExists(governanceScript);
    steps.push({
      id: 'interactive-governance-report',
      name: 'interactive-governance-report',
      command: 'node',
      args: ['scripts/interactive-governance-report.js', '--period', 'weekly', '--json'],
      required: true,
      enabled: hasGovernanceScript,
      skip_reason: hasGovernanceScript ? '' : 'scripts/interactive-governance-report.js not found'
    });

    const handoffManifest = path.join(projectPath, 'docs', 'handoffs', 'handoff-manifest.json');
    const hasHandoffManifest = await fileSystem.pathExists(handoffManifest);
    steps.push({
      id: 'scene-package-publish-batch-dry-run',
      name: 'scene package publish-batch dry-run',
      command: 'node',
      args: ['bin/sce.js', 'scene', 'package-publish-batch', '--manifest', 'docs/handoffs/handoff-manifest.json', '--dry-run', '--json'],
      required: true,
      enabled: hasHandoffManifest,
      skip_reason: hasHandoffManifest ? '' : 'docs/handoffs/handoff-manifest.json not found'
    });
  }

  return steps;
}

async function buildReleaseGateSteps(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const profile = normalizeString(options.profile) || 'standard';
  if (!RELEASE_PROFILES.has(profile)) {
    throw new Error(`Invalid release profile "${profile}". Expected one of: ${Array.from(RELEASE_PROFILES).join(', ')}`);
  }

  const steps = [];
  steps.push({
    id: 'npm-pack-dry-run',
    name: 'npm pack --dry-run',
    command: 'npm',
    args: ['pack', '--dry-run'],
    required: true
  });

  const errorbookReleaseGateScript = path.join(projectPath, 'scripts', 'errorbook-release-gate.js');
  const hasErrorbookReleaseGateScript = await fileSystem.pathExists(errorbookReleaseGateScript);
  steps.push({
    id: 'errorbook-release-gate',
    name: 'errorbook release gate',
    command: 'node',
    args: ['scripts/errorbook-release-gate.js', '--fail-on-block', '--json'],
    required: true,
    enabled: hasErrorbookReleaseGateScript,
    skip_reason: hasErrorbookReleaseGateScript ? '' : 'scripts/errorbook-release-gate.js not found'
  });

  const weeklySummaryPath = path.join(projectPath, '.sce', 'reports', 'release-evidence', 'release-ops-weekly-summary.json');
  const hasWeeklySummary = await fileSystem.pathExists(weeklySummaryPath);
  steps.push({
    id: 'release-weekly-ops-gate',
    name: 'release weekly ops gate',
    command: 'node',
    args: ['scripts/release-weekly-ops-gate.js'],
    required: true,
    enabled: hasWeeklySummary,
    skip_reason: hasWeeklySummary ? '' : '.sce/reports/release-evidence/release-ops-weekly-summary.json not found'
  });

  const releaseEvidenceDir = path.join(projectPath, '.sce', 'reports', 'release-evidence');
  const hasReleaseEvidenceDir = await fileSystem.pathExists(releaseEvidenceDir);
  steps.push({
    id: 'release-asset-integrity',
    name: 'release asset integrity',
    command: 'node',
    args: ['scripts/release-asset-integrity-check.js'],
    required: true,
    enabled: hasReleaseEvidenceDir,
    skip_reason: hasReleaseEvidenceDir ? '' : '.sce/reports/release-evidence directory not found'
  });

  const handoffManifest = path.join(projectPath, 'docs', 'handoffs', 'handoff-manifest.json');
  const hasHandoffManifest = await fileSystem.pathExists(handoffManifest);
  steps.push({
    id: 'scene-package-publish-batch-dry-run',
    name: 'scene package publish-batch dry-run (ontology gate)',
    command: 'node',
    args: [
      'bin/sce.js',
      'scene',
      'package-publish-batch',
      '--manifest',
      'docs/handoffs/handoff-manifest.json',
      '--dry-run',
      '--ontology-min-average-score',
      '70',
      '--ontology-min-valid-rate',
      '100',
      '--json'
    ],
    required: true,
    enabled: hasHandoffManifest,
    skip_reason: hasHandoffManifest ? '' : 'docs/handoffs/handoff-manifest.json not found'
  });

  steps.push({
    id: 'handoff-capability-matrix-gate',
    name: 'handoff capability matrix gate',
    command: 'node',
    args: [
      'bin/sce.js',
      'auto',
      'handoff',
      'capability-matrix',
      '--manifest',
      'docs/handoffs/handoff-manifest.json',
      '--profile',
      'moqui',
      '--fail-on-gap',
      '--json'
    ],
    required: true,
    enabled: hasHandoffManifest,
    skip_reason: hasHandoffManifest ? '' : 'docs/handoffs/handoff-manifest.json not found'
  });

  return steps;
}

async function writeStudioReport(projectPath, relativePath, payload, fileSystem = fs) {
  const absolutePath = path.join(projectPath, relativePath);
  await fileSystem.ensureDir(path.dirname(absolutePath));
  await fileSystem.writeJson(absolutePath, payload, { spaces: 2 });
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
  const authResult = await ensureStudioAuthorization('apply', options, {
    projectPath,
    fileSystem,
    env: dependencies.env,
    authSecret: dependencies.authSecret
  });
  const patchBundleId = normalizeString(options.patchBundle) || normalizeString(job.artifacts.patch_bundle_id);
  if (!patchBundleId) {
    throw new Error('--patch-bundle is required (or generate stage must provide one)');
  }

  job.status = 'applied';
  job.artifacts = job.artifacts || {};
  job.artifacts.patch_bundle_id = patchBundleId;
  job.updated_at = nowIso();

  ensureStageCompleted(job, 'apply', {
    patch_bundle_id: patchBundleId,
    auth_required: authResult.required
  });

  await saveJob(paths, job, fileSystem);
  await appendStudioEvent(paths, job, 'stage.apply.completed', {
    patch_bundle_id: patchBundleId,
    auth_required: authResult.required
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

  const verifyReportPath = `${STUDIO_REPORTS_DIR}/verify-${job.job_id}.json`;
  const verifyStartedAt = nowIso();
  const autoErrorbookRecords = [];
  const gateSteps = await buildVerifyGateSteps({ profile }, {
    projectPath,
    fileSystem
  });
  const gateResult = await executeGateSteps(gateSteps, {
    projectPath,
    commandRunner: dependencies.commandRunner,
    env: dependencies.env,
    failOnRequiredSkip: profile === 'strict',
    onFailure: async ({ failure }) => {
      const captured = await autoRecordGateFailure(failure, {
        stage: 'verify',
        profile,
        job_id: job.job_id,
        scene_id: job?.scene?.id
      }, {
        projectPath,
        fileSystem,
        autoRecordFailures: dependencies.autoRecordFailures
      });
      if (captured && captured.errorbook_entry_id) {
        autoErrorbookRecords.push({
          step_id: failure.id,
          entry_id: captured.errorbook_entry_id,
          fingerprint: captured.fingerprint
        });
      }
    }
  });
  const verifyCompletedAt = nowIso();
  const verifyReport = {
    mode: 'studio-verify',
    api_version: STUDIO_JOB_API_VERSION,
    job_id: job.job_id,
    profile,
    started_at: verifyStartedAt,
    completed_at: verifyCompletedAt,
    passed: gateResult.passed,
    steps: gateResult.steps,
    auto_errorbook_records: autoErrorbookRecords
  };

  await writeStudioReport(projectPath, verifyReportPath, verifyReport, fileSystem);

  job.artifacts = job.artifacts || {};
  job.artifacts.verify_report = verifyReportPath;
  job.updated_at = verifyCompletedAt;

  if (!gateResult.passed) {
    job.status = 'verify_failed';
    job.stages.verify = {
      status: 'failed',
      completed_at: null,
      metadata: {
        profile,
        passed: false,
        report: verifyReportPath,
        auto_errorbook_records: autoErrorbookRecords
      }
    };
    await saveJob(paths, job, fileSystem);
    await appendStudioEvent(paths, job, 'stage.verify.failed', {
      profile,
      report: verifyReportPath,
      auto_errorbook_records: autoErrorbookRecords
    }, fileSystem);
    await writeLatestJob(paths, jobId, fileSystem);
    throw new Error(`studio verify failed: ${gateResult.steps.filter((step) => step.status === 'failed').map((step) => step.id).join(', ')}`);
  }

  job.status = 'verified';
  ensureStageCompleted(job, 'verify', {
    profile,
    passed: true,
    report: verifyReportPath,
    auto_errorbook_records: autoErrorbookRecords
  });

  await saveJob(paths, job, fileSystem);
  await appendStudioEvent(paths, job, 'stage.verify.completed', {
    profile,
    passed: true,
    report: verifyReportPath,
    auto_errorbook_records: autoErrorbookRecords
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
  const authResult = await ensureStudioAuthorization('release', options, {
    projectPath,
    fileSystem,
    env: dependencies.env,
    authSecret: dependencies.authSecret
  });
  const releaseRef = normalizeString(options.releaseRef) || `${channel}-${Date.now()}`;

  const profile = normalizeString(options.profile) || 'standard';
  const releaseReportPath = `${STUDIO_REPORTS_DIR}/release-${job.job_id}.json`;
  const releaseStartedAt = nowIso();
  const autoErrorbookRecords = [];
  const gateSteps = await buildReleaseGateSteps({ profile }, {
    projectPath,
    fileSystem
  });
  const gateResult = await executeGateSteps(gateSteps, {
    projectPath,
    commandRunner: dependencies.commandRunner,
    env: dependencies.env,
    failOnRequiredSkip: profile === 'strict',
    onFailure: async ({ failure }) => {
      const captured = await autoRecordGateFailure(failure, {
        stage: 'release',
        profile,
        job_id: job.job_id,
        scene_id: job?.scene?.id
      }, {
        projectPath,
        fileSystem,
        autoRecordFailures: dependencies.autoRecordFailures
      });
      if (captured && captured.errorbook_entry_id) {
        autoErrorbookRecords.push({
          step_id: failure.id,
          entry_id: captured.errorbook_entry_id,
          fingerprint: captured.fingerprint
        });
      }
    }
  });
  const releaseCompletedAt = nowIso();
  const releaseReport = {
    mode: 'studio-release',
    api_version: STUDIO_JOB_API_VERSION,
    job_id: job.job_id,
    profile,
    channel,
    release_ref: releaseRef,
    started_at: releaseStartedAt,
    completed_at: releaseCompletedAt,
    passed: gateResult.passed,
    steps: gateResult.steps,
    auto_errorbook_records: autoErrorbookRecords
  };

  await writeStudioReport(projectPath, releaseReportPath, releaseReport, fileSystem);

  job.artifacts = job.artifacts || {};
  job.artifacts.release_ref = releaseRef;
  job.artifacts.release_report = releaseReportPath;
  job.updated_at = releaseCompletedAt;

  if (!gateResult.passed) {
    job.status = 'release_failed';
    job.stages.release = {
      status: 'failed',
      completed_at: null,
      metadata: {
        channel,
        release_ref: releaseRef,
        passed: false,
        report: releaseReportPath,
        auth_required: authResult.required,
        auto_errorbook_records: autoErrorbookRecords
      }
    };
    await saveJob(paths, job, fileSystem);
    await appendStudioEvent(paths, job, 'stage.release.failed', {
      channel,
      release_ref: releaseRef,
      report: releaseReportPath,
      auth_required: authResult.required,
      auto_errorbook_records: autoErrorbookRecords
    }, fileSystem);
    await writeLatestJob(paths, jobId, fileSystem);
    throw new Error(`studio release failed: ${gateResult.steps.filter((step) => step.status === 'failed').map((step) => step.id).join(', ')}`);
  }

  job.status = 'released';
  ensureStageCompleted(job, 'release', {
    channel,
    release_ref: releaseRef,
    report: releaseReportPath,
    auth_required: authResult.required,
    auto_errorbook_records: autoErrorbookRecords
  });

  await saveJob(paths, job, fileSystem);
  await appendStudioEvent(paths, job, 'stage.release.completed', {
    channel,
    release_ref: releaseRef,
    report: releaseReportPath,
    auth_required: authResult.required,
    auto_errorbook_records: autoErrorbookRecords
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
  const authResult = await ensureStudioAuthorization('rollback', options, {
    projectPath,
    fileSystem,
    env: dependencies.env,
    authSecret: dependencies.authSecret
  });
  if (!isStageCompleted(job, 'apply')) {
    throw new Error(`Cannot rollback studio job ${job.job_id}: apply stage is not completed`);
  }

  job.status = 'rolled_back';
  job.updated_at = nowIso();
  job.rollback = {
    reason,
    rolled_back_at: job.updated_at,
    auth_required: authResult.required
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
    .option('--auth-password <password>', 'Authorization password for protected apply action')
    .option('--require-auth', 'Require authorization even when policy is advisory')
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
    .option('--profile <profile>', 'Release gate profile', 'standard')
    .option('--auth-password <password>', 'Authorization password for protected release action')
    .option('--require-auth', 'Require authorization even when policy is advisory')
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
    .option('--auth-password <password>', 'Authorization password for protected rollback action')
    .option('--require-auth', 'Require authorization even when policy is advisory')
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
  executeGateSteps,
  loadStudioSecurityPolicy,
  ensureStudioAuthorization,
  buildVerifyGateSteps,
  buildReleaseGateSteps,
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
