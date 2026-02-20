'use strict';

const fs = require('fs');
const path = require('path');

function appendSummary(summaryPath, lines = []) {
  if (!summaryPath) {
    return;
  }
  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n\n`, 'utf8');
}

function safeReadJson(file) {
  try {
    if (!file || !fs.existsSync(file)) {
      return { ok: false, error: `missing file: ${file || 'n/a'}` };
    }
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, error: `parse error: ${error.message}` };
  }
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function exportReleaseGovernanceSnapshot(options = {}) {
  const env = options.env && typeof options.env === 'object'
    ? options.env
    : process.env;
  const now = typeof options.now === 'function'
    ? options.now
    : () => new Date().toISOString();

  const summaryFile = `${env.RELEASE_EVIDENCE_SUMMARY_FILE || ''}`.trim();
  const outputJson = `${env.RELEASE_GOVERNANCE_SNAPSHOT_JSON || '.kiro/reports/release-evidence/governance-snapshot.json'}`.trim();
  const outputMarkdown = `${env.RELEASE_GOVERNANCE_SNAPSHOT_MD || '.kiro/reports/release-evidence/governance-snapshot.md'}`.trim();
  const releaseTag = `${env.RELEASE_TAG || ''}`.trim();
  const summaryPath = env.GITHUB_STEP_SUMMARY;

  const summaryResult = safeReadJson(summaryFile);
  const payload = summaryResult.ok && summaryResult.payload && typeof summaryResult.payload === 'object'
    ? summaryResult.payload
    : {};
  const governanceSnapshot = payload.governance_snapshot && typeof payload.governance_snapshot === 'object'
    ? payload.governance_snapshot
    : null;
  const available = governanceSnapshot !== null;
  const concerns = normalizeArray(governanceSnapshot && governanceSnapshot.health && governanceSnapshot.health.concerns);
  const recommendations = normalizeArray(governanceSnapshot && governanceSnapshot.health && governanceSnapshot.health.recommendations);
  const risk = `${governanceSnapshot && governanceSnapshot.health && governanceSnapshot.health.risk || 'unknown'}`.trim().toLowerCase();

  const exportPayload = {
    mode: 'release-governance-snapshot',
    generated_at: now(),
    tag: releaseTag || null,
    summary_file: summaryFile || null,
    available,
    warning: summaryResult.ok ? null : summaryResult.error,
    governance_snapshot: governanceSnapshot
  };

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.writeFileSync(outputJson, `${JSON.stringify(exportPayload, null, 2)}\n`, 'utf8');

  const markdownLines = [
    '# Release Governance Snapshot',
    '',
    `- Tag: ${releaseTag || 'n/a'}`,
    `- Generated At: ${exportPayload.generated_at}`,
    `- Summary File: ${summaryFile || 'n/a'}`,
    `- Available: ${available ? 'yes' : 'no'}`
  ];

  if (!available) {
    markdownLines.push(`- Warning: ${exportPayload.warning || 'governance snapshot unavailable'}`);
  } else {
    markdownLines.push(`- Risk: ${risk}`);
    markdownLines.push(`- Concerns: ${concerns.length}`);
    markdownLines.push(`- Recommendations: ${recommendations.length}`);
    if (concerns.length > 0) {
      markdownLines.push('', '## Concerns');
      concerns.forEach(item => markdownLines.push(`- ${item}`));
    }
    if (recommendations.length > 0) {
      markdownLines.push('', '## Recommendations');
      recommendations.forEach(item => markdownLines.push(`- ${item}`));
    }
  }

  fs.mkdirSync(path.dirname(outputMarkdown), { recursive: true });
  fs.writeFileSync(outputMarkdown, `${markdownLines.join('\n')}\n`, 'utf8');

  console.log(`[release-governance-snapshot] summary=${summaryFile || 'n/a'} available=${available}`);
  console.log(`[release-governance-snapshot] json=${outputJson}`);
  console.log(`[release-governance-snapshot] markdown=${outputMarkdown}`);

  appendSummary(summaryPath, [
    '## Release Governance Snapshot',
    '',
    `- summary: ${summaryFile || 'n/a'}`,
    `- available: ${available}`,
    `- json: ${outputJson}`,
    `- markdown: ${outputMarkdown}`,
    ...(available
      ? [
        `- risk: ${risk}`,
        `- concerns: ${concerns.length}`,
        `- recommendations: ${recommendations.length}`
      ]
      : [`- warning: ${exportPayload.warning || 'governance snapshot unavailable'}`])
  ]);

  return {
    exit_code: 0,
    available,
    warning: exportPayload.warning,
    json_file: outputJson,
    markdown_file: outputMarkdown
  };
}

if (require.main === module) {
  const result = exportReleaseGovernanceSnapshot();
  process.exit(result.exit_code);
}

module.exports = {
  exportReleaseGovernanceSnapshot
};
