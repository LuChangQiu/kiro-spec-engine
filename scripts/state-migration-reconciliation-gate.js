#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const { runStateDoctor } = require('../lib/state/state-migration-manager');

function parseArgs(argv = []) {
  const options = {
    projectPath: process.cwd(),
    json: false,
    failOnAlert: false,
    failOnPending: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--workspace' || token === '--project-path') {
      if (next) {
        options.projectPath = path.resolve(next);
        index += 1;
      }
      continue;
    }
    if (token === '--json') {
      options.json = true;
      continue;
    }
    if (token === '--fail-on-alert') {
      options.failOnAlert = true;
      continue;
    }
    if (token === '--fail-on-pending') {
      options.failOnPending = true;
      continue;
    }
  }

  return options;
}

function summarizePendingChecks(checks = []) {
  return checks
    .filter((item) => item.sync_status === 'pending-migration')
    .map((item) => item.id);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const doctor = await runStateDoctor({}, {
    projectPath: options.projectPath,
    fileSystem: fs
  });

  const pending = summarizePendingChecks(doctor.checks);
  const blocking = Array.isArray(doctor.blocking) ? doctor.blocking : [];
  const alerts = Array.isArray(doctor.alerts) ? doctor.alerts : [];

  const reasons = [];
  if (blocking.length > 0) {
    reasons.push(...blocking.map((item) => `blocking:${item}`));
  }
  if (options.failOnAlert && alerts.length > 0) {
    reasons.push(...alerts.map((item) => `alert:${item}`));
  }
  if (options.failOnPending && pending.length > 0) {
    reasons.push(...pending.map((item) => `pending:${item}`));
  }

  const passed = reasons.length === 0;
  const payload = {
    mode: 'state-migration-reconciliation-gate',
    success: passed,
    passed,
    workspace: path.relative(process.cwd(), options.projectPath).replace(/\\/g, '/'),
    fail_on_alert: options.failOnAlert,
    fail_on_pending: options.failOnPending,
    blocking,
    alerts,
    pending_components: pending,
    reasons,
    doctor
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else if (!passed) {
    console.error(`[state-migration-reconciliation-gate] blocked`);
    for (const reason of reasons) {
      console.error(`[state-migration-reconciliation-gate] reason=${reason}`);
    }
  } else {
    console.log('[state-migration-reconciliation-gate] passed');
  }

  if (!passed) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : `${error}`);
  process.exitCode = 1;
});
