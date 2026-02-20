'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { exportReleaseGovernanceSnapshot } = require('../../../scripts/release-governance-snapshot-export');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sce-release-governance-snapshot-'));
}

describe('release governance snapshot export script', () => {
  test('exports governance snapshot assets from release evidence summary', () => {
    const tempDir = makeTempDir();
    const summaryFile = path.join(tempDir, 'release-evidence-summary.json');
    const outputJson = path.join(tempDir, 'governance-snapshot.json');
    const outputMd = path.join(tempDir, 'governance-snapshot.md');

    fs.writeFileSync(summaryFile, JSON.stringify({
      mode: 'auto-handoff-evidence-review',
      governance_snapshot: {
        mode: 'auto-governance-stats',
        health: {
          risk: 'medium',
          concerns: ['release gate drift alert rate is positive'],
          recommendations: ['run sce auto handoff evidence --window 5 --json']
        }
      }
    }, null, 2), 'utf8');

    const result = exportReleaseGovernanceSnapshot({
      env: {
        RELEASE_EVIDENCE_SUMMARY_FILE: summaryFile,
        RELEASE_GOVERNANCE_SNAPSHOT_JSON: outputJson,
        RELEASE_GOVERNANCE_SNAPSHOT_MD: outputMd,
        RELEASE_TAG: 'v3.0.9'
      },
      now: () => '2026-02-20T00:00:00.000Z'
    });

    expect(result.exit_code).toBe(0);
    expect(result.available).toBe(true);

    const jsonPayload = JSON.parse(fs.readFileSync(outputJson, 'utf8'));
    expect(jsonPayload).toEqual(expect.objectContaining({
      mode: 'release-governance-snapshot',
      generated_at: '2026-02-20T00:00:00.000Z',
      tag: 'v3.0.9',
      available: true,
      warning: null
    }));
    expect(jsonPayload.governance_snapshot).toEqual(expect.objectContaining({
      mode: 'auto-governance-stats'
    }));

    const markdown = fs.readFileSync(outputMd, 'utf8');
    expect(markdown).toContain('# Release Governance Snapshot');
    expect(markdown).toContain('- Available: yes');
    expect(markdown).toContain('- Risk: medium');
    expect(markdown).toContain('## Concerns');
  });

  test('writes unavailable snapshot artifacts when summary is missing', () => {
    const tempDir = makeTempDir();
    const outputJson = path.join(tempDir, 'governance-snapshot.json');
    const outputMd = path.join(tempDir, 'governance-snapshot.md');
    const missingSummary = path.join(tempDir, 'missing.json');

    const result = exportReleaseGovernanceSnapshot({
      env: {
        RELEASE_EVIDENCE_SUMMARY_FILE: missingSummary,
        RELEASE_GOVERNANCE_SNAPSHOT_JSON: outputJson,
        RELEASE_GOVERNANCE_SNAPSHOT_MD: outputMd,
        RELEASE_TAG: 'v3.0.9'
      }
    });

    expect(result.exit_code).toBe(0);
    expect(result.available).toBe(false);
    expect(result.warning).toContain('missing file');

    const jsonPayload = JSON.parse(fs.readFileSync(outputJson, 'utf8'));
    expect(jsonPayload.available).toBe(false);
    expect(jsonPayload.warning).toContain('missing file');
    expect(jsonPayload.governance_snapshot).toBeNull();

    const markdown = fs.readFileSync(outputMd, 'utf8');
    expect(markdown).toContain('- Available: no');
    expect(markdown).toContain('- Warning:');
  });
});
