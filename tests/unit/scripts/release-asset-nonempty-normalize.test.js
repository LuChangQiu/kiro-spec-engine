'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { normalizeNonEmptyAssets } = require('../../../scripts/release-asset-nonempty-normalize');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sce-release-asset-normalize-'));
}

describe('release asset nonempty normalize script', () => {
  test('creates placeholder for missing jsonl asset', () => {
    const tempDir = makeTempDir();
    const target = path.join(tempDir, 'interactive-matrix-signals-vX.jsonl');

    const result = normalizeNonEmptyAssets({
      files: [target],
      kind: 'jsonl',
      event: 'interactive-matrix-signals',
      note: 'no interactive matrix signals',
      now: () => '2026-02-22T08:00:00.000Z'
    });

    expect(result.created_placeholders).toBe(1);
    expect(fs.existsSync(target)).toBe(true);
    const content = fs.readFileSync(target, 'utf8').trim();
    expect(content).toContain('"event":"interactive-matrix-signals"');
    expect(content).toContain('"note":"no interactive matrix signals"');
  });

  test('fills empty lines file with placeholder', () => {
    const tempDir = makeTempDir();
    const target = path.join(tempDir, 'matrix-remediation-vX.lines');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '', 'utf8');

    const result = normalizeNonEmptyAssets({
      files: [target],
      kind: 'lines',
      note: 'no matrix remediation items for this release'
    });

    expect(result.filled_empty_files).toBe(1);
    const content = fs.readFileSync(target, 'utf8');
    expect(content).toContain('# no matrix remediation items for this release');
  });

  test('keeps non-empty file unchanged', () => {
    const tempDir = makeTempDir();
    const target = path.join(tempDir, 'release-risk-remediation-vX.lines');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '# existing remediation action\n', 'utf8');

    const before = fs.readFileSync(target, 'utf8');
    const result = normalizeNonEmptyAssets({
      files: [target],
      kind: 'lines',
      note: 'should not overwrite'
    });
    const after = fs.readFileSync(target, 'utf8');

    expect(result.kept_existing_files).toBe(1);
    expect(after).toBe(before);
  });
});
