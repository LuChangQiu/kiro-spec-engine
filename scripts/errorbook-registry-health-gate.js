#!/usr/bin/env node
'use strict';

const path = require('path');
const { runErrorbookRegistryHealthCommand } = require('../lib/commands/errorbook');

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'on', 'y'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off', 'n'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseArgs(argv = [], env = process.env) {
  const options = {
    strict: parseBoolean(env.SCE_REGISTRY_HEALTH_STRICT, false),
    json: false,
    projectPath: process.cwd(),
    maxShards: 8,
    shardSample: 2
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--strict') {
      options.strict = true;
    } else if (token === '--no-strict') {
      options.strict = false;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--project-path' && next) {
      options.projectPath = path.resolve(next);
      index += 1;
    } else if (token === '--config' && next) {
      options.config = next;
      index += 1;
    } else if (token === '--cache' && next) {
      options.cache = next;
      index += 1;
    } else if (token === '--source' && next) {
      options.source = next;
      index += 1;
    } else if (token === '--source-name' && next) {
      options.sourceName = next;
      index += 1;
    } else if (token === '--index' && next) {
      options.index = next;
      index += 1;
    } else if (token === '--max-shards' && next) {
      options.maxShards = Number.parseInt(next, 10);
      index += 1;
    } else if (token === '--shard-sample' && next) {
      options.shardSample = Number.parseInt(next, 10);
      index += 1;
    } else if (token === '--help' || token === '-h') {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  const lines = [
    'Usage: node scripts/errorbook-registry-health-gate.js [options]',
    '',
    'Options:',
    '  --strict                Exit with code 2 when health check reports errors',
    '  --no-strict             Force advisory mode even if env is strict',
    '  --project-path <path>   Override project path (default: cwd)',
    '  --config <path>         Registry config path override',
    '  --cache <path>          Registry cache path override',
    '  --source <url-or-path>  Override registry source JSON',
    '  --source-name <name>    Override registry source label',
    '  --index <url-or-path>   Override registry index JSON',
    '  --max-shards <n>        Max index-resolved shards to validate (default: 8)',
    '  --shard-sample <n>      Number of shard files to fetch for validation (default: 2)',
    '  --json                  Print JSON payload',
    '  -h, --help              Show this help',
    '',
    'Environment:',
    '  SCE_REGISTRY_HEALTH_STRICT=1 enables strict mode by default'
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

async function runErrorbookRegistryHealthGateScript(options = {}) {
  const health = await runErrorbookRegistryHealthCommand({
    config: options.config,
    cache: options.cache,
    source: options.source,
    sourceName: options.sourceName,
    index: options.index,
    maxShards: options.maxShards,
    shardSample: options.shardSample,
    silent: true
  }, {
    projectPath: options.projectPath
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({
      ...health,
      mode: 'errorbook-registry-health-gate',
      strict: options.strict === true
    }, null, 2)}\n`);
  } else if (health.passed) {
    process.stdout.write('[errorbook-registry-health-gate] passed\n');
    process.stdout.write(
      `[errorbook-registry-health-gate] sources=${health.config.source_count} warnings=${health.warning_count} errors=0\n`
    );
  } else {
    process.stdout.write('[errorbook-registry-health-gate] alert\n');
    process.stdout.write(
      `[errorbook-registry-health-gate] sources=${health.config.source_count} warnings=${health.warning_count} errors=${health.error_count}\n`
    );
    health.errors.slice(0, 20).forEach((message) => {
      process.stdout.write(`[errorbook-registry-health-gate] error=${message}\n`);
    });
  }

  const exitCode = options.strict && !health.passed ? 2 : 0;
  return {
    ...health,
    mode: 'errorbook-registry-health-gate',
    strict: options.strict === true,
    exit_code: exitCode
  };
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  runErrorbookRegistryHealthGateScript(options)
    .then((result) => {
      process.exitCode = result.exit_code;
    })
    .catch((error) => {
      const payload = {
        mode: 'errorbook-registry-health-gate',
        passed: false,
        error: error.message
      };
      if (options.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      } else {
        process.stderr.write(`[errorbook-registry-health-gate] error=${error.message}\n`);
      }
      process.exitCode = 1;
    });
}

module.exports = {
  parseArgs,
  runErrorbookRegistryHealthGateScript
};
