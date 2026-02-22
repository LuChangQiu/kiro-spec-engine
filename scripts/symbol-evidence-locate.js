#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_HITS = 10;
const DEFAULT_MIN_SCORE = 0.35;
const DEFAULT_MIN_RELIABLE_SCORE = 0.6;
const DEFAULT_EXTENSIONS = [
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx',
  '.py', '.java', '.go', '.rb', '.php', '.cs',
  '.json', '.yaml', '.yml', '.md'
];
const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache'
]);

function parseArgs(argv = []) {
  const options = {
    workspace: process.cwd(),
    query: '',
    queryFile: '',
    maxHits: DEFAULT_MAX_HITS,
    minScore: DEFAULT_MIN_SCORE,
    minReliableScore: DEFAULT_MIN_RELIABLE_SCORE,
    extensions: [...DEFAULT_EXTENSIONS],
    strict: false,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--workspace' && next) {
      options.workspace = next;
      index += 1;
      continue;
    }
    if (token === '--query' && next) {
      options.query = next;
      index += 1;
      continue;
    }
    if (token === '--query-file' && next) {
      options.queryFile = next;
      index += 1;
      continue;
    }
    if (token === '--max-hits' && next) {
      options.maxHits = Number(next);
      index += 1;
      continue;
    }
    if (token === '--min-score' && next) {
      options.minScore = Number(next);
      index += 1;
      continue;
    }
    if (token === '--min-reliable-score' && next) {
      options.minReliableScore = Number(next);
      index += 1;
      continue;
    }
    if (token === '--extensions' && next) {
      options.extensions = next
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .map((item) => (item.startsWith('.') ? item : `.${item}`));
      index += 1;
      continue;
    }
    if (token === '--strict') {
      options.strict = true;
      continue;
    }
    if (token === '--json') {
      options.json = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!Number.isFinite(options.maxHits) || options.maxHits <= 0) {
    throw new Error('--max-hits must be a positive number.');
  }
  if (!Number.isFinite(options.minScore) || options.minScore < 0 || options.minScore > 1) {
    throw new Error('--min-score must be between 0 and 1.');
  }
  if (
    !Number.isFinite(options.minReliableScore)
    || options.minReliableScore < 0
    || options.minReliableScore > 1
  ) {
    throw new Error('--min-reliable-score must be between 0 and 1.');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/symbol-evidence-locate.js --query "<text>" [options]',
    '',
    'Options:',
    '  --workspace <path>            Workspace root to search (default: current directory)',
    '  --query <text>                Query text for symbol localization',
    '  --query-file <path>           Query text file (fallback when --query absent)',
    `  --max-hits <n>                Maximum hits to return (default: ${DEFAULT_MAX_HITS})`,
    `  --min-score <0-1>             Minimum hit score (default: ${DEFAULT_MIN_SCORE})`,
    `  --min-reliable-score <0-1>    Reliability threshold (default: ${DEFAULT_MIN_RELIABLE_SCORE})`,
    `  --extensions <csv>            File extensions (default: ${DEFAULT_EXTENSIONS.join(',')})`,
    '  --strict                      Exit code 2 when no reliable evidence is found',
    '  --json                        Print JSON payload',
    '  -h, --help                    Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolveQuery(options) {
  if (typeof options.query === 'string' && options.query.trim()) {
    return options.query.trim();
  }
  if (typeof options.queryFile === 'string' && options.queryFile.trim()) {
    const resolvedFile = path.resolve(options.workspace, options.queryFile);
    if (!fs.existsSync(resolvedFile)) {
      throw new Error(`query file not found: ${options.queryFile}`);
    }
    const content = fs.readFileSync(resolvedFile, 'utf8').trim();
    if (!content) {
      throw new Error(`query file is empty: ${options.queryFile}`);
    }
    return content;
  }
  throw new Error('query is required. Use --query or --query-file.');
}

function normalizeQueryTokens(query) {
  return `${query || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9_:\-\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function listCandidateFiles(workspaceRoot, extensions) {
  const resolvedRoot = path.resolve(workspaceRoot);
  const extSet = new Set((extensions || []).map((item) => `${item}`.toLowerCase()));
  const files = [];
  const stack = [resolvedRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_error) {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (extSet.size > 0 && !extSet.has(ext)) {
        continue;
      }
      files.push(fullPath);
    }
  }

  return files;
}

function extractSymbolFromLine(line = '') {
  const patterns = [
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/,
    /\bclass\s+([A-Za-z_$][\w$]*)\b/,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
    /\b([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?\(/,
    /\b([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(line);
    if (match && match[1]) {
      return match[1];
    }
  }
  return '';
}

function computeHitScore({ query, queryTokens, line, symbol }) {
  const loweredLine = `${line || ''}`.toLowerCase();
  const normalizedQuery = `${query || ''}`.toLowerCase().trim();
  const normalizedSymbol = `${symbol || ''}`.toLowerCase();
  if (queryTokens.length === 0) {
    return 0;
  }

  const tokenMatches = queryTokens.filter((token) => loweredLine.includes(token)).length;
  if (tokenMatches === 0) {
    return 0;
  }

  const tokenCoverage = tokenMatches / queryTokens.length;
  const hasPhraseMatch = normalizedQuery && loweredLine.includes(normalizedQuery);
  const hasSymbolMatch = normalizedSymbol
    && queryTokens.some((token) => normalizedSymbol.includes(token) || token.includes(normalizedSymbol));

  const rawScore = (tokenCoverage * 0.65) + (hasPhraseMatch ? 0.2 : 0) + (hasSymbolMatch ? 0.15 : 0);
  return Math.max(0, Math.min(1, Number(rawScore.toFixed(4))));
}

function confidenceFromScore(score) {
  if (!Number.isFinite(score) || score <= 0) {
    return 'none';
  }
  if (score >= 0.8) {
    return 'high';
  }
  if (score >= 0.6) {
    return 'medium';
  }
  if (score >= 0.4) {
    return 'low';
  }
  return 'none';
}

function locateSymbolEvidence({
  workspace,
  query,
  maxHits = DEFAULT_MAX_HITS,
  minScore = DEFAULT_MIN_SCORE,
  minReliableScore = DEFAULT_MIN_RELIABLE_SCORE,
  extensions = DEFAULT_EXTENSIONS
}) {
  const workspaceRoot = path.resolve(workspace);
  const queryTokens = normalizeQueryTokens(query);
  const candidateFiles = listCandidateFiles(workspaceRoot, extensions);
  const hits = [];

  for (const filePath of candidateFiles) {
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (_error) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const symbol = extractSymbolFromLine(line);
      const score = computeHitScore({ query, queryTokens, line, symbol });
      if (score < minScore) {
        continue;
      }
      const relativeFile = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
      hits.push({
        file: relativeFile || path.basename(filePath),
        line: index + 1,
        snippet: line.trim().slice(0, 240),
        symbol: symbol || 'unknown',
        score,
        source: symbol ? 'symbol-heuristic' : 'text-grep'
      });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || (a.line - b.line));
  const slicedHits = hits.slice(0, Math.max(1, Math.floor(maxHits)));
  const reliableHits = slicedHits.filter((item) => item.score >= minReliableScore);
  const topScore = slicedHits.length > 0 ? slicedHits[0].score : 0;
  const confidence = confidenceFromScore(topScore);
  const reliable = reliableHits.length > 0;

  return {
    mode: 'symbol-evidence-locate',
    query,
    hits: slicedHits,
    evidence: {
      confidence,
      reliable,
      fallback_action: reliable ? 'allow_write' : 'block_high_risk_write',
      advisory: reliable
        ? 'Symbol evidence is reliable; scoped code change can proceed.'
        : 'No reliable symbol evidence found. Fallback to answer-only mode and block high-risk writes.'
    },
    summary: {
      searched_files: candidateFiles.length,
      candidate_files: candidateFiles.length,
      total_hits: slicedHits.length,
      reliable_hits: reliableHits.length
    }
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const query = resolveQuery(options);
  const payload = locateSymbolEvidence({
    workspace: options.workspace,
    query,
    maxHits: options.maxHits,
    minScore: options.minScore,
    minReliableScore: options.minReliableScore,
    extensions: options.extensions
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`symbol evidence confidence=${payload.evidence.confidence}\n`);
    process.stdout.write(`hits=${payload.hits.length} reliable=${payload.summary.reliable_hits}\n`);
    process.stdout.write(`fallback_action=${payload.evidence.fallback_action}\n`);
  }

  if (options.strict && payload.evidence.reliable !== true) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`symbol-evidence-locate failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  resolveQuery,
  normalizeQueryTokens,
  listCandidateFiles,
  extractSymbolFromLine,
  computeHitScore,
  confidenceFromScore,
  locateSymbolEvidence
};
