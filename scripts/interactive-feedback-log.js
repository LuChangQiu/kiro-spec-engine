#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const DEFAULT_FEEDBACK_FILE = '.kiro/reports/interactive-user-feedback.jsonl';
const ALLOWED_CHANNELS = new Set(['ui', 'cli', 'api', 'other']);

function parseArgs(argv) {
  const options = {
    score: null,
    comment: null,
    userId: 'anonymous-user',
    sessionId: null,
    intentId: null,
    planId: null,
    executionId: null,
    channel: 'ui',
    tags: [],
    product: null,
    module: null,
    page: null,
    sceneId: null,
    feedbackFile: DEFAULT_FEEDBACK_FILE,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--score' && next) {
      options.score = Number(next);
      index += 1;
    } else if (token === '--comment' && next) {
      options.comment = next;
      index += 1;
    } else if (token === '--user-id' && next) {
      options.userId = next;
      index += 1;
    } else if (token === '--session-id' && next) {
      options.sessionId = next;
      index += 1;
    } else if (token === '--intent-id' && next) {
      options.intentId = next;
      index += 1;
    } else if (token === '--plan-id' && next) {
      options.planId = next;
      index += 1;
    } else if (token === '--execution-id' && next) {
      options.executionId = next;
      index += 1;
    } else if (token === '--channel' && next) {
      options.channel = next;
      index += 1;
    } else if (token === '--tags' && next) {
      options.tags = next
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      index += 1;
    } else if (token === '--product' && next) {
      options.product = next;
      index += 1;
    } else if (token === '--module' && next) {
      options.module = next;
      index += 1;
    } else if (token === '--page' && next) {
      options.page = next;
      index += 1;
    } else if (token === '--scene-id' && next) {
      options.sceneId = next;
      index += 1;
    } else if (token === '--feedback-file' && next) {
      options.feedbackFile = next;
      index += 1;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!Number.isFinite(options.score)) {
    throw new Error('--score is required and must be a number between 0 and 5.');
  }
  if (options.score < 0 || options.score > 5) {
    throw new Error('--score must be between 0 and 5.');
  }

  options.channel = `${options.channel || ''}`.trim().toLowerCase();
  if (!ALLOWED_CHANNELS.has(options.channel)) {
    throw new Error(`--channel must be one of: ${Array.from(ALLOWED_CHANNELS).join(', ')}`);
  }

  options.userId = `${options.userId || ''}`.trim() || 'anonymous-user';
  options.sessionId = normalizeOptionalString(options.sessionId);
  options.intentId = normalizeOptionalString(options.intentId);
  options.planId = normalizeOptionalString(options.planId);
  options.executionId = normalizeOptionalString(options.executionId);
  options.comment = normalizeOptionalString(options.comment);
  options.product = normalizeOptionalString(options.product);
  options.module = normalizeOptionalString(options.module);
  options.page = normalizeOptionalString(options.page);
  options.sceneId = normalizeOptionalString(options.sceneId);
  options.tags = normalizeTags(options.tags);

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-feedback-log.js --score <0..5> [options]',
    '',
    'Options:',
    '  --score <n>              Feedback score (required, 0-5)',
    '  --comment <text>         Optional feedback comment',
    '  --user-id <id>           User identifier (default: anonymous-user)',
    '  --session-id <id>        Optional interactive session id',
    '  --intent-id <id>         Optional intent id',
    '  --plan-id <id>           Optional plan id',
    '  --execution-id <id>      Optional execution id',
    '  --channel <name>         ui|cli|api|other (default: ui)',
    '  --tags <csv>             Optional tags, comma separated',
    '  --product <name>         Optional product context',
    '  --module <name>          Optional module context',
    '  --page <name>            Optional page context',
    '  --scene-id <name>        Optional scene id context',
    `  --feedback-file <path>   Feedback JSONL file (default: ${DEFAULT_FEEDBACK_FILE})`,
    '  --json                   Print JSON result',
    '  -h, --help               Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function normalizeOptionalString(value) {
  const text = `${value || ''}`.trim();
  return text.length > 0 ? text : null;
}

function normalizeTags(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  const normalized = [];
  const seen = new Set();
  for (const item of input) {
    const value = `${item || ''}`.trim().toLowerCase();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function inferSentiment(score) {
  if (score >= 4) {
    return 'positive';
  }
  if (score <= 2) {
    return 'negative';
  }
  return 'neutral';
}

function buildContextRef(options) {
  const context = {
    product: options.product,
    module: options.module,
    page: options.page,
    scene_id: options.sceneId
  };

  const hasValue = Object.values(context).some(item => item != null);
  return hasValue ? context : null;
}

function buildFeedbackRecord(options, createdAt) {
  return {
    feedback_id: `feedback-${crypto.randomUUID()}`,
    event_type: 'interactive.feedback.submitted',
    timestamp: createdAt,
    user_id: options.userId,
    session_id: options.sessionId,
    intent_id: options.intentId,
    plan_id: options.planId,
    execution_id: options.executionId,
    score: Number(options.score),
    sentiment: inferSentiment(options.score),
    comment: options.comment,
    channel: options.channel,
    tags: options.tags,
    context_ref: buildContextRef(options)
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const feedbackPath = resolvePath(cwd, options.feedbackFile);
  const createdAt = new Date().toISOString();
  const record = buildFeedbackRecord(options, createdAt);

  await fs.ensureDir(path.dirname(feedbackPath));
  await fs.appendFile(feedbackPath, `${JSON.stringify(record)}\n`, 'utf8');

  const payload = {
    mode: 'interactive-feedback-log',
    generated_at: createdAt,
    record,
    output: {
      feedback_file: path.relative(cwd, feedbackPath) || '.'
    }
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write('Interactive feedback logged.\n');
    process.stdout.write(`- Feedback file: ${payload.output.feedback_file}\n`);
    process.stdout.write(`- Score: ${record.score}\n`);
    process.stdout.write(`- Sentiment: ${record.sentiment}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive feedback log failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_FEEDBACK_FILE,
  ALLOWED_CHANNELS,
  parseArgs,
  normalizeOptionalString,
  normalizeTags,
  resolvePath,
  inferSentiment,
  buildContextRef,
  buildFeedbackRecord,
  main
};
