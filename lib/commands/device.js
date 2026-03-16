const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { ensureWriteAuthorization } = require('../security/write-authorization');
const { getCurrentDeviceProfile } = require('../device/current-device');
const { loadDeviceOverride, upsertDeviceOverride } = require('../device/device-override-store');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function printDevicePayload(payload, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(chalk.blue('Current Device'));
  console.log(`  ID: ${payload.summary.device_id}`);
  console.log(`  Label: ${payload.summary.label}`);
  console.log(`  Hostname: ${payload.summary.hostname}`);
  console.log(`  Platform: ${payload.summary.platform}`);
  console.log(`  Arch: ${payload.summary.arch}`);
  console.log(`  User: ${payload.summary.user}`);
  console.log(`  Capability Tags: ${payload.summary.capability_tag_count}`);
  console.log(`  Identity Source: ${payload.summary.identity_source}`);
}

function printDeviceOverridePayload(payload, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(chalk.blue('Device Override'));
  console.log(`  Source File: ${payload.summary.source_file || '(not created)'}`);
  console.log(`  Removed Apps: ${payload.summary.removed_app_count}`);
  console.log(`  Added Apps: ${payload.summary.added_app_count}`);
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

async function runDeviceCurrentCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const device = await getCurrentDeviceProfile(projectPath, {
    fileSystem,
    persistIfMissing: false
  });

  const payload = {
    mode: 'device-current',
    generated_at: new Date().toISOString(),
    summary: {
      device_id: device.device_id,
      label: device.label,
      hostname: device.hostname,
      platform: device.platform,
      arch: device.arch,
      user: device.user,
      capability_tag_count: Array.isArray(device.capability_tags) ? device.capability_tags.length : 0,
      identity_source: device.identity_source
    },
    device
  };
  printDevicePayload(payload, options);
  return payload;
}

async function runDeviceOverrideShowCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const override = await loadDeviceOverride(projectPath, { fileSystem });
  const payload = {
    mode: 'device-override-show',
    generated_at: new Date().toISOString(),
    summary: {
      source_file: override.source_file,
      removed_app_count: Array.isArray(override.removed_apps) ? override.removed_apps.length : 0,
      added_app_count: Array.isArray(override.added_apps) ? override.added_apps.length : 0
    },
    override
  };
  printDeviceOverridePayload(payload, options);
  return payload;
}

async function runDeviceOverrideUpsertCommand(options = {}, dependencies = {}) {
  const inputFile = normalizeString(options.input);
  if (!inputFile) {
    throw new Error('--input is required');
  }

  await ensureAuthorized('device:override:upsert', options, dependencies);
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const resolvedInput = path.isAbsolute(inputFile)
    ? inputFile
    : path.join(projectPath, inputFile);
  const patch = await fileSystem.readJson(resolvedInput);
  const override = await upsertDeviceOverride(projectPath, patch, { fileSystem });
  const payload = {
    mode: 'device-override-upsert',
    success: true,
    generated_at: new Date().toISOString(),
    input_file: resolvedInput,
    summary: {
      source_file: override.source_file,
      removed_app_count: Array.isArray(override.removed_apps) ? override.removed_apps.length : 0,
      added_app_count: Array.isArray(override.added_apps) ? override.added_apps.length : 0
    },
    override
  };
  printDeviceOverridePayload(payload, options);
  return payload;
}

function safeRun(handler, options = {}, context = 'device command') {
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

function registerDeviceCommands(program) {
  const device = program
    .command('device')
    .description('Inspect current device identity, capability tags, and local override state');

  device
    .command('current')
    .description('Show current device identity and capability tags')
    .option('--json', 'Print machine-readable JSON output')
    .action(async (options) => {
      try {
        await runDeviceCurrentCommand(options);
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
        } else {
          console.error(chalk.red('device current failed:'), error.message);
        }
        process.exitCode = 1;
      }
    });

  const override = device
    .command('override')
    .description('Inspect and update local device override policy');

  override
    .command('show')
    .description('Show current local device override policy')
    .option('--json', 'Print machine-readable JSON output')
    .action((options) => safeRun(runDeviceOverrideShowCommand, options, 'device override show'));

  override
    .command('upsert')
    .description('Merge local device override fields from JSON input')
    .requiredOption('--input <path>', 'JSON file with override fields to upsert')
    .option('--auth-lease <lease-id>', 'Write authorization lease id')
    .option('--auth-password <password>', 'Inline auth password if policy allows')
    .option('--actor <actor>', 'Audit actor override')
    .option('--json', 'Print machine-readable JSON output')
    .action((options) => safeRun(runDeviceOverrideUpsertCommand, options, 'device override upsert'));
}

module.exports = {
  runDeviceCurrentCommand,
  runDeviceOverrideShowCommand,
  runDeviceOverrideUpsertCommand,
  registerDeviceCommands
};
