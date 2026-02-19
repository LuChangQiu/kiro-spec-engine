#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const {
  MoquiInteractiveAdapter
} = require('../lib/interactive-customization/moqui-interactive-adapter');

const DEFAULT_OUT_PLAN = '.kiro/reports/interactive-change-plan.adapter.json';
const DEFAULT_OUTPUT = '.kiro/reports/interactive-moqui-adapter.json';

function parseArgs(argv) {
  const options = {
    action: null,
    intent: null,
    context: null,
    plan: null,
    executionId: null,
    executionMode: 'suggestion',
    policy: null,
    catalog: null,
    moquiConfig: null,
    outPlan: DEFAULT_OUT_PLAN,
    out: DEFAULT_OUTPUT,
    recordOut: null,
    ledgerOut: null,
    liveApply: false,
    dryRun: true,
    allowSuggestionApply: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--action' && next) {
      options.action = next;
      i += 1;
    } else if (token === '--intent' && next) {
      options.intent = next;
      i += 1;
    } else if (token === '--context' && next) {
      options.context = next;
      i += 1;
    } else if (token === '--plan' && next) {
      options.plan = next;
      i += 1;
    } else if (token === '--execution-id' && next) {
      options.executionId = next;
      i += 1;
    } else if (token === '--execution-mode' && next) {
      options.executionMode = next;
      i += 1;
    } else if (token === '--policy' && next) {
      options.policy = next;
      i += 1;
    } else if (token === '--catalog' && next) {
      options.catalog = next;
      i += 1;
    } else if (token === '--moqui-config' && next) {
      options.moquiConfig = next;
      i += 1;
    } else if (token === '--out-plan' && next) {
      options.outPlan = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--record-out' && next) {
      options.recordOut = next;
      i += 1;
    } else if (token === '--ledger-out' && next) {
      options.ledgerOut = next;
      i += 1;
    } else if (token === '--live-apply') {
      options.liveApply = true;
    } else if (token === '--no-dry-run') {
      options.dryRun = false;
    } else if (token === '--allow-suggestion-apply') {
      options.allowSuggestionApply = true;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  const action = `${options.action || ''}`.trim().toLowerCase();
  const allowed = new Set(['capabilities', 'plan', 'validate', 'apply', 'low-risk-apply', 'rollback']);
  if (!allowed.has(action)) {
    throw new Error('--action must be one of: capabilities, plan, validate, apply, low-risk-apply, rollback');
  }

  options.action = action;

  if (action === 'plan' && !options.intent) {
    throw new Error('--intent is required for --action plan');
  }
  if (['validate', 'apply', 'low-risk-apply'].includes(action) && !options.plan) {
    throw new Error('--plan is required for --action validate/apply/low-risk-apply');
  }
  if (action === 'rollback' && !options.executionId) {
    throw new Error('--execution-id is required for --action rollback');
  }
  if (!['suggestion', 'apply'].includes(`${options.executionMode || ''}`.trim())) {
    throw new Error('--execution-mode must be one of: suggestion, apply');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-moqui-adapter.js --action <name> [options]',
    '',
    'Actions:',
    '  capabilities         Show adapter capability contract',
    '  plan                 Build Change_Plan from Change_Intent',
    '  validate             Validate Change_Plan against policy gate',
    '  apply                Run controlled apply pipeline and emit ExecutionRecord',
    '  low-risk-apply       One-click apply path (requires low-risk + allow)',
    '  rollback             Emit rollback ExecutionRecord for a previous execution',
    '',
    'Options:',
    '  --action <name>                 Action name (required)',
    '  --intent <path>                 Change_Intent JSON (for plan)',
    '  --context <path>                Optional page context JSON (for plan)',
    '  --plan <path>                   Change_Plan JSON (for validate/apply)',
    '  --execution-id <id>             Execution id (for rollback)',
    '  --execution-mode <mode>         suggestion|apply (for plan; default: suggestion)',
    '  --policy <path>                 Guardrail policy path override',
    '  --catalog <path>                High-risk catalog path override',
    '  --moqui-config <path>           moqui-adapter.json override for live apply',
    `  --out-plan <path>               Generated plan output path (default: ${DEFAULT_OUT_PLAN})`,
    `  --out <path>                    Command output summary JSON (default: ${DEFAULT_OUTPUT})`,
    '  --record-out <path>             Execution record output override',
    '  --ledger-out <path>             Execution ledger output override',
    '  --live-apply                    Enable live Moqui execute mode (default: false)',
    '  --no-dry-run                    Disable dry-run simulation when live apply is enabled',
    '  --allow-suggestion-apply        Allow applying plans with execution_mode=suggestion',
    '  --json                          Print result JSON to stdout',
    '  -h, --help                      Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

async function readJsonFile(filePath, label) {
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  const text = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON in ${label}: ${error.message}`);
  }
}

async function writeJsonFile(filePath, payload) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, payload, { spaces: 2 });
}

function summarizeResult(payload, options, cwd) {
  return {
    mode: 'interactive-moqui-adapter',
    generated_at: new Date().toISOString(),
    action: options.action,
    payload
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  const adapter = new MoquiInteractiveAdapter({
    projectRoot: cwd,
    policyPath: options.policy || undefined,
    catalogPath: options.catalog || undefined,
    executionRecordOut: options.recordOut || undefined,
    executionLedgerOut: options.ledgerOut || undefined,
    moquiConfigPath: options.moquiConfig || undefined,
    liveApply: options.liveApply,
    dryRun: options.dryRun
  });

  let payload;

  if (options.action === 'capabilities') {
    payload = {
      capabilities: adapter.capabilities()
    };
  } else if (options.action === 'plan') {
    const intentPath = resolvePath(cwd, options.intent);
    const intent = await readJsonFile(intentPath, 'intent');
    const context = options.context
      ? await readJsonFile(resolvePath(cwd, options.context), 'context')
      : {};
    const plan = await adapter.plan(intent, context, { executionMode: options.executionMode });
    const outPlanPath = resolvePath(cwd, options.outPlan);
    await writeJsonFile(outPlanPath, plan);
    payload = {
      decision: 'planned',
      plan,
      output: {
        plan: path.relative(cwd, outPlanPath) || '.'
      }
    };
  } else if (options.action === 'validate') {
    const planPath = resolvePath(cwd, options.plan);
    const plan = await readJsonFile(planPath, 'plan');
    const validation = await adapter.validate(plan);
    payload = {
      decision: validation.decision,
      validation
    };
  } else if (options.action === 'apply') {
    const planPath = resolvePath(cwd, options.plan);
    const plan = await readJsonFile(planPath, 'plan');
    const result = await adapter.apply(plan, {
      liveApply: options.liveApply,
      dryRun: options.dryRun,
      allowSuggestionApply: options.allowSuggestionApply
    });
    payload = {
      decision: result.record.result === 'success' ? 'applied' : 'blocked',
      blocked: result.blocked,
      reason: result.reason,
      validation: result.validation,
      execution_record: result.record
    };
    if (result.record.result !== 'success') {
      process.exitCode = 2;
    }
  } else if (options.action === 'low-risk-apply') {
    const planPath = resolvePath(cwd, options.plan);
    const plan = await readJsonFile(planPath, 'plan');
    const result = await adapter.applyLowRisk(plan, {
      liveApply: options.liveApply,
      dryRun: options.dryRun,
      allowSuggestionApply: options.allowSuggestionApply
    });
    payload = {
      decision: result.record.result === 'success' ? 'applied' : 'blocked',
      blocked: result.blocked,
      reason: result.reason,
      validation: result.validation,
      execution_record: result.record
    };
    if (result.record.result !== 'success') {
      process.exitCode = 2;
    }
  } else {
    const rollback = await adapter.rollback(options.executionId);
    payload = {
      decision: rollback.record.result === 'rolled-back' ? 'rolled-back' : 'failed',
      found: rollback.found,
      execution_record: rollback.record
    };
    if (rollback.record.result !== 'rolled-back') {
      process.exitCode = 2;
    }
  }

  const finalPayload = summarizeResult(payload, options, cwd);
  const outPath = resolvePath(cwd, options.out);
  await writeJsonFile(outPath, finalPayload);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(finalPayload, null, 2)}\n`);
  } else {
    process.stdout.write(`Interactive moqui adapter action completed: ${options.action}\n`);
    process.stdout.write(`- Output: ${path.relative(cwd, outPath) || '.'}\n`);
    if (payload.execution_record && payload.execution_record.execution_id) {
      process.stdout.write(`- Execution ID: ${payload.execution_record.execution_id}\n`);
      process.stdout.write(`- Result: ${payload.execution_record.result}\n`);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive moqui adapter failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_OUT_PLAN,
  DEFAULT_OUTPUT,
  parseArgs,
  resolvePath,
  readJsonFile,
  writeJsonFile,
  main
};
