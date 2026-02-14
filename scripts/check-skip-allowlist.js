#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const testsRoot = path.join(repoRoot, 'tests');
const allowlistPath = path.join(repoRoot, 'tests', 'skip-allowlist.txt');

function walkFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js'))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function loadAllowlist(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Allowlist file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

function collectSkippedTests() {
  const testFiles = walkFiles(testsRoot);
  const skipPattern = /\b(?:test|it|describe)\.skip\(\s*(['"`])([^'"`]+)\1/g;
  const skipped = [];

  for (const filePath of testFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    let match = skipPattern.exec(content);

    while (match) {
      skipped.push(`${relativePath}::${match[2]}`);
      match = skipPattern.exec(content);
    }
  }

  return skipped.sort();
}

function main() {
  const allowlist = loadAllowlist(allowlistPath);
  const skipped = collectSkippedTests();

  const allowSet = new Set(allowlist);
  const skippedSet = new Set(skipped);

  const unexpected = skipped.filter(item => !allowSet.has(item));
  const stale = allowlist.filter(item => !skippedSet.has(item));

  console.log(`Skip audit: ${skipped.length} skipped tests, ${allowlist.length} allowlisted entries`);

  if (stale.length > 0) {
    console.log('Stale allowlist entries (safe to remove):');
    for (const item of stale) {
      console.log(`  - ${item}`);
    }
  }

  if (unexpected.length > 0) {
    console.error('Unexpected skipped tests found:');
    for (const item of unexpected) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }

  console.log('Skip audit passed.');
}

try {
  main();
} catch (error) {
  console.error(`Skip audit failed: ${error.message}`);
  process.exit(1);
}
