'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { evaluateReleaseAssetIntegrity } = require('../../../scripts/release-asset-integrity-check');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sce-release-asset-integrity-'));
}

function writeFile(file, content = 'ok') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

describe('release asset integrity check script', () => {
  test('passes when required assets are present', () => {
    const tempDir = makeTempDir();
    const tag = 'v3.1.0';
    const reportJson = path.join(tempDir, 'asset-integrity.json');
    const reportMd = path.join(tempDir, 'asset-integrity.md');
    const gateFile = path.join(tempDir, 'release-gate.json');

    [
      `release-gate-${tag}.json`,
      `release-gate-history-${tag}.json`,
      `release-gate-history-${tag}.md`,
      `governance-snapshot-${tag}.json`,
      `governance-snapshot-${tag}.md`,
      `weekly-ops-summary-${tag}.json`,
      `weekly-ops-summary-${tag}.md`,
      `release-risk-remediation-${tag}.json`,
      `release-risk-remediation-${tag}.md`,
      `release-risk-remediation-${tag}.lines`
    ].forEach(file => writeFile(path.join(tempDir, file), '{}'));

    const result = evaluateReleaseAssetIntegrity({
      env: {
        RELEASE_TAG: tag,
        RELEASE_ASSET_INTEGRITY_DIR: tempDir,
        RELEASE_ASSET_INTEGRITY_REPORT_JSON: reportJson,
        RELEASE_ASSET_INTEGRITY_REPORT_MD: reportMd,
        RELEASE_GATE_REPORT_FILE: gateFile
      },
      now: () => '2026-02-21T00:00:00.000Z'
    });

    expect(result.exit_code).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(fs.existsSync(reportJson)).toBe(true);
    expect(fs.existsSync(reportMd)).toBe(true);
    const gatePayload = JSON.parse(fs.readFileSync(gateFile, 'utf8'));
    expect(gatePayload.asset_integrity).toEqual(expect.objectContaining({
      mode: 'release-asset-integrity-check',
      passed: true
    }));
  });

  test('blocks by default when required assets are missing', () => {
    const tempDir = makeTempDir();
    const tag = 'v3.1.0';
    writeFile(path.join(tempDir, `release-gate-${tag}.json`), '{}');

    const result = evaluateReleaseAssetIntegrity({
      env: {
        RELEASE_TAG: tag,
        RELEASE_ASSET_INTEGRITY_DIR: tempDir
      }
    });

    expect(result.exit_code).toBe(1);
    expect(result.blocked).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('does not block in advisory mode', () => {
    const tempDir = makeTempDir();
    const tag = 'v3.1.0';
    writeFile(path.join(tempDir, `release-gate-${tag}.json`), '{}');

    const result = evaluateReleaseAssetIntegrity({
      env: {
        RELEASE_TAG: tag,
        RELEASE_ASSET_INTEGRITY_DIR: tempDir,
        RELEASE_ASSET_INTEGRITY_ENFORCE: 'false'
      }
    });

    expect(result.exit_code).toBe(0);
    expect(result.blocked).toBe(false);
    expect(result.passed).toBe(false);
  });
});

