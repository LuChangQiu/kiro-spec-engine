#!/usr/bin/env node

const { auditSceTracking } = require('../lib/workspace/sce-tracking-audit');

function printTextReport(report) {
  if (report.passed) {
    console.log('SCE tracking audit passed.');
    console.log(`Fixture tracked specs: ${report.summary.fixture_spec_files}`);
    console.log(`Fixture tracked templates: ${report.summary.fixture_template_files}`);
    return;
  }

  console.error('SCE tracking audit failed.');
  if (report.missing_required_files.length > 0) {
    console.error('Missing required tracked files:');
    for (const filePath of report.missing_required_files) {
      console.error(`  - ${filePath}`);
    }
  }
  if (report.summary.fixture_spec_files === 0) {
    console.error('No tracked fixture spec files were found under tests/fixtures/.../.sce/specs.');
  }
  if (report.summary.fixture_template_files === 0) {
    console.error('No tracked fixture template files were found under tests/fixtures/.../.sce/templates.');
  }
  if (report.fixture.disallowed_tracked_files.length > 0) {
    console.error('Disallowed tracked fixture runtime files found:');
    for (const filePath of report.fixture.disallowed_tracked_files) {
      console.error(`  - ${filePath}`);
    }
  }
}

function main() {
  const json = process.argv.includes('--json');
  const report = auditSceTracking(process.cwd());

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (!report.passed) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`SCE tracking audit error: ${error.message}`);
  process.exit(1);
}
