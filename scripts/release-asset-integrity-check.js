#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function appendSummary(summaryPath, lines = []) {
  if (!summaryPath) {
    return;
  }
  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n\n`, 'utf8');
}

function readValue(env, name, fallback = '') {
  const value = env[name];
  return value === undefined || value === null ? fallback : `${value}`.trim();
}

function parseBoolean(raw, fallback) {
  const value = `${raw || ''}`.trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'y', 'on'].includes(value)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(value)) {
    return false;
  }
  return fallback;
}

function normalizeRequiredFiles(raw, tag) {
  const defaultList = [
    'release-gate-{tag}.json',
    'release-gate-history-{tag}.json',
    'release-gate-history-{tag}.md',
    'governance-snapshot-{tag}.json',
    'governance-snapshot-{tag}.md',
    'weekly-ops-summary-{tag}.json',
    'weekly-ops-summary-{tag}.md',
    'release-risk-remediation-{tag}.json',
    'release-risk-remediation-{tag}.md',
    'release-risk-remediation-{tag}.lines'
  ];
  const source = raw
    ? `${raw}`
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
    : defaultList;
  const normalizedTag = `${tag || ''}`.trim();
  return source.map(item => item.replace(/\{tag\}/g, normalizedTag));
}

function mergeGateReport(gateReportFile, payload) {
  if (!gateReportFile) {
    return;
  }
  let gatePayload = {};
  try {
    if (fs.existsSync(gateReportFile)) {
      gatePayload = JSON.parse(fs.readFileSync(gateReportFile, 'utf8'));
    }
  } catch (_error) {
    gatePayload = {};
  }
  gatePayload.asset_integrity = payload;
  gatePayload.updated_at = payload.evaluated_at;
  fs.writeFileSync(gateReportFile, `${JSON.stringify(gatePayload, null, 2)}\n`, 'utf8');
}

function evaluateReleaseAssetIntegrity(options = {}) {
  const env = options.env && typeof options.env === 'object'
    ? options.env
    : process.env;
  const now = typeof options.now === 'function'
    ? options.now
    : () => new Date().toISOString();

  const tag = readValue(env, 'RELEASE_TAG', '');
  const baseDir = readValue(env, 'RELEASE_ASSET_INTEGRITY_DIR', '.kiro/reports/release-evidence');
  const required = normalizeRequiredFiles(readValue(env, 'RELEASE_ASSET_INTEGRITY_REQUIRED_FILES', ''), tag);
  const enforce = parseBoolean(readValue(env, 'RELEASE_ASSET_INTEGRITY_ENFORCE', ''), true);
  const requireNonEmpty = parseBoolean(readValue(env, 'RELEASE_ASSET_INTEGRITY_REQUIRE_NON_EMPTY', ''), true);
  const reportJsonFile = readValue(env, 'RELEASE_ASSET_INTEGRITY_REPORT_JSON', '');
  const reportMarkdownFile = readValue(env, 'RELEASE_ASSET_INTEGRITY_REPORT_MD', '');
  const gateReportFile = readValue(env, 'RELEASE_GATE_REPORT_FILE', '');
  const summaryPath = readValue(env, 'GITHUB_STEP_SUMMARY', '');

  const missingFiles = [];
  const emptyFiles = [];
  const presentFiles = [];

  for (const rel of required) {
    const absolute = path.resolve(baseDir, rel);
    const exists = fs.existsSync(absolute);
    if (!exists) {
      missingFiles.push(rel);
      continue;
    }
    const stat = fs.statSync(absolute);
    if (requireNonEmpty && (!stat || stat.size <= 0)) {
      emptyFiles.push(rel);
      continue;
    }
    presentFiles.push({
      file: rel,
      size: stat.size
    });
  }

  const violations = [
    ...missingFiles.map(item => `missing asset: ${item}`),
    ...emptyFiles.map(item => `empty asset: ${item}`)
  ];
  const passed = violations.length === 0;
  const blocked = enforce && !passed;
  const evaluatedAt = now();

  const payload = {
    mode: 'release-asset-integrity-check',
    evaluated_at: evaluatedAt,
    tag: tag || null,
    dir: baseDir,
    enforce,
    require_non_empty: requireNonEmpty,
    required_count: required.length,
    required_files: required,
    present_count: presentFiles.length,
    present_files: presentFiles,
    missing_files: missingFiles,
    empty_files: emptyFiles,
    violations,
    passed,
    blocked
  };

  if (reportJsonFile) {
    fs.mkdirSync(path.dirname(reportJsonFile), { recursive: true });
    fs.writeFileSync(reportJsonFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  if (reportMarkdownFile) {
    const lines = [
      '# Release Asset Integrity Check',
      '',
      `- Tag: ${payload.tag || 'n/a'}`,
      `- Directory: ${payload.dir}`,
      `- Enforce: ${payload.enforce}`,
      `- Require non-empty: ${payload.require_non_empty}`,
      `- Passed: ${payload.passed}`,
      `- Required: ${payload.required_count}`,
      `- Present: ${payload.present_count}`,
      `- Missing: ${payload.missing_files.length}`,
      `- Empty: ${payload.empty_files.length}`
    ];
    if (payload.violations.length > 0) {
      lines.push('', '## Violations');
      payload.violations.forEach(item => lines.push(`- ${item}`));
    }
    fs.mkdirSync(path.dirname(reportMarkdownFile), { recursive: true });
    fs.writeFileSync(reportMarkdownFile, `${lines.join('\n')}\n`, 'utf8');
  }

  mergeGateReport(gateReportFile, payload);

  const summaryLines = [
    '## Release Asset Integrity',
    '',
    `- enforce: ${enforce}`,
    `- required assets: ${required.length}`,
    `- present assets: ${presentFiles.length}`,
    `- missing assets: ${missingFiles.length}`,
    `- empty assets: ${emptyFiles.length}`,
    `- passed: ${passed}`
  ];
  if (violations.length > 0) {
    summaryLines.push('', '### Violations');
    violations.forEach(item => summaryLines.push(`- ${item}`));
  }
  appendSummary(summaryPath, summaryLines);

  console.log(
    `[release-asset-integrity] enforce=${enforce} required=${required.length} present=${presentFiles.length} missing=${missingFiles.length} empty=${emptyFiles.length}`
  );
  if (!passed) {
    console.error(`[release-asset-integrity] violations=${violations.join('; ')}`);
  } else {
    console.log('[release-asset-integrity] passed');
  }
  if (reportJsonFile) {
    console.log(`[release-asset-integrity] json=${reportJsonFile}`);
  }
  if (reportMarkdownFile) {
    console.log(`[release-asset-integrity] markdown=${reportMarkdownFile}`);
  }

  return {
    exit_code: blocked ? 1 : 0,
    blocked,
    passed,
    violations,
    payload
  };
}

if (require.main === module) {
  const result = evaluateReleaseAssetIntegrity();
  process.exit(result.exit_code);
}

module.exports = {
  evaluateReleaseAssetIntegrity
};

