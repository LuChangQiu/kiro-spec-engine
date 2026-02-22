#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function resolveKind(filePath, explicitKind = 'auto') {
  const kind = `${explicitKind || 'auto'}`.trim().toLowerCase();
  if (kind && kind !== 'auto') {
    return kind;
  }
  if (/\.jsonl$/i.test(filePath)) {
    return 'jsonl';
  }
  if (/\.json$/i.test(filePath)) {
    return 'json';
  }
  if (/\.lines$/i.test(filePath)) {
    return 'lines';
  }
  return 'text';
}

function buildPlaceholder(filePath, kind, options = {}) {
  const note = `${options.note || ''}`.trim();
  const event = `${options.event || 'release-asset-placeholder'}`.trim();
  const now = typeof options.now === 'function'
    ? options.now
    : () => new Date().toISOString();
  const baseNote = note || `placeholder for ${path.basename(filePath)}`;
  if (kind === 'json' || kind === 'jsonl') {
    return `${JSON.stringify({
      event,
      note: baseNote,
      generated_at: now()
    })}\n`;
  }
  return `# ${baseNote}\n`;
}

function normalizeNonEmptyAssets(options = {}) {
  const files = Array.isArray(options.files)
    ? options.files.map(item => `${item || ''}`.trim()).filter(Boolean)
    : [];
  if (files.length === 0) {
    throw new Error('at least one --file is required');
  }

  const dryRun = Boolean(options.dryRun);
  const kindInput = options.kind || 'auto';
  const details = [];

  for (const file of files) {
    const absolute = path.resolve(file);
    const kind = resolveKind(absolute, kindInput);
    const exists = fs.existsSync(absolute);
    const size = exists ? fs.statSync(absolute).size : 0;
    const needsPlaceholder = !exists || size <= 0;
    let action = 'kept';
    let writtenBytes = 0;

    if (needsPlaceholder) {
      action = exists ? 'filled-empty' : 'created-placeholder';
      const content = buildPlaceholder(absolute, kind, options);
      writtenBytes = Buffer.byteLength(content, 'utf8');
      if (!dryRun) {
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, content, 'utf8');
      }
    }

    details.push({
      file,
      absolute_path: absolute,
      kind,
      existed: exists,
      previous_size: size,
      action,
      written_bytes: writtenBytes
    });
  }

  const createdCount = details.filter(item => item.action === 'created-placeholder').length;
  const filledCount = details.filter(item => item.action === 'filled-empty').length;
  const keptCount = details.filter(item => item.action === 'kept').length;

  return {
    mode: 'release-asset-nonempty-normalize',
    dry_run: dryRun,
    total: details.length,
    created_placeholders: createdCount,
    filled_empty_files: filledCount,
    kept_existing_files: keptCount,
    details
  };
}

function parseArgs(argv = []) {
  const options = {
    files: [],
    kind: 'auto',
    note: '',
    event: '',
    dryRun: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--file') {
      options.files.push(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (token === '--kind') {
      options.kind = argv[i + 1] || 'auto';
      i += 1;
      continue;
    }
    if (token === '--note') {
      options.note = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--event') {
      options.event = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (token === '--json') {
      options.json = true;
      continue;
    }
    if (token === '-h' || token === '--help') {
      console.log([
        'Usage:',
        '  node scripts/release-asset-nonempty-normalize.js --file <path> [--file <path> ...] [--kind auto|json|jsonl|lines|text] [--note <text>] [--event <event>] [--dry-run] [--json]'
      ].join('\n'));
      process.exit(0);
    }
  }
  return options;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const payload = normalizeNonEmptyAssets(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(
      `[release-asset-nonempty-normalize] total=${payload.total} created=${payload.created_placeholders} filled=${payload.filled_empty_files} kept=${payload.kept_existing_files}\n`
    );
  }
}

module.exports = {
  buildPlaceholder,
  normalizeNonEmptyAssets,
  parseArgs,
  resolveKind
};
