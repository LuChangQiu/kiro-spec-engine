#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const DEFAULT_INPUT = 'docs/interactive-customization/moqui-context-provider.sample.json';
const DEFAULT_GOAL = 'Adjust order screen field layout for clearer input flow';
const DEFAULT_POLICY = 'docs/interactive-customization/guardrail-policy-baseline.json';
const DEFAULT_CATALOG = 'docs/interactive-customization/high-risk-action-catalog.json';
const DEFAULT_APPROVAL_ROLE_POLICY = 'docs/interactive-customization/approval-role-policy-baseline.json';
const DEFAULT_APPROVAL_ACTOR_ROLE = 'workflow-operator';
const DEFAULT_APPROVER_ACTOR_ROLE = 'workflow-operator';
const DEFAULT_DIALOGUE_PROFILE = 'system-maintainer';
const DEFAULT_OUT = '.sce/reports/interactive-flow-smoke/interactive-flow-smoke.summary.json';

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    goal: DEFAULT_GOAL,
    policy: DEFAULT_POLICY,
    catalog: DEFAULT_CATALOG,
    approvalRolePolicy: DEFAULT_APPROVAL_ROLE_POLICY,
    approvalActorRole: DEFAULT_APPROVAL_ACTOR_ROLE,
    approverActorRole: DEFAULT_APPROVER_ACTOR_ROLE,
    dialogueProfile: DEFAULT_DIALOGUE_PROFILE,
    out: DEFAULT_OUT,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--input' && next) {
      options.input = next;
      index += 1;
    } else if (token === '--goal' && next) {
      options.goal = next;
      index += 1;
    } else if (token === '--policy' && next) {
      options.policy = next;
      index += 1;
    } else if (token === '--catalog' && next) {
      options.catalog = next;
      index += 1;
    } else if (token === '--approval-role-policy' && next) {
      options.approvalRolePolicy = next;
      index += 1;
    } else if (token === '--approval-actor-role' && next) {
      options.approvalActorRole = next;
      index += 1;
    } else if (token === '--approver-actor-role' && next) {
      options.approverActorRole = next;
      index += 1;
    } else if (token === '--dialogue-profile' && next) {
      options.dialogueProfile = next;
      index += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-flow-smoke.js [options]',
    '',
    'Options:',
    `  --input <path>     Provider payload JSON path (default: ${DEFAULT_INPUT})`,
    `  --goal <text>      Smoke goal text (default: ${DEFAULT_GOAL})`,
    `  --policy <path>    Guardrail policy path (default: ${DEFAULT_POLICY})`,
    `  --catalog <path>   High-risk catalog path (default: ${DEFAULT_CATALOG})`,
    `  --approval-role-policy <path> Role policy path (default: ${DEFAULT_APPROVAL_ROLE_POLICY})`,
    `  --approval-actor-role <name>  Approval actor role (default: ${DEFAULT_APPROVAL_ACTOR_ROLE})`,
    `  --approver-actor-role <name>  Approver actor role (default: ${DEFAULT_APPROVER_ACTOR_ROLE})`,
    `  --dialogue-profile <name>      Dialogue profile (default: ${DEFAULT_DIALOGUE_PROFILE})`,
    `  --out <path>       Flow summary output path (default: ${DEFAULT_OUT})`,
    '  --json             Print smoke payload as JSON',
    '  -h, --help         Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function parseJson(text, label) {
  const raw = `${text || ''}`.trim();
  if (!raw) {
    throw new Error(`${label} output is empty`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} output is not valid JSON: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const flowScript = path.resolve(__dirname, 'interactive-flow.js');
  const inputPath = resolvePath(cwd, options.input);
  const policyPath = resolvePath(cwd, options.policy);
  const catalogPath = resolvePath(cwd, options.catalog);
  const approvalRolePolicyPath = resolvePath(cwd, options.approvalRolePolicy);
  const outPath = resolvePath(cwd, options.out);

  if (!(await fs.pathExists(flowScript))) {
    throw new Error(`interactive flow script not found: ${flowScript}`);
  }
  if (!(await fs.pathExists(inputPath))) {
    throw new Error(`input file not found: ${inputPath}`);
  }
  if (!(await fs.pathExists(policyPath))) {
    throw new Error(`policy file not found: ${policyPath}`);
  }
  if (!(await fs.pathExists(catalogPath))) {
    throw new Error(`catalog file not found: ${catalogPath}`);
  }
  if (!(await fs.pathExists(approvalRolePolicyPath))) {
    throw new Error(`approval role policy file not found: ${approvalRolePolicyPath}`);
  }

  const args = [
    flowScript,
    '--input', inputPath,
    '--goal', options.goal,
    '--policy', policyPath,
    '--catalog', catalogPath,
    '--approval-role-policy', approvalRolePolicyPath,
    '--approval-actor-role', options.approvalActorRole,
    '--approver-actor-role', options.approverActorRole,
    '--dialogue-profile', options.dialogueProfile,
    '--execution-mode', 'apply',
    '--auto-execute-low-risk',
    '--auth-password-hash', crypto.createHash('sha256').update('smoke-pass').digest('hex'),
    '--auth-password', 'smoke-pass',
    '--feedback-score', '5',
    '--out', outPath,
    '--json'
  ];

  const runResult = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8'
  });

  const exitCode = Number.isInteger(runResult.status) ? runResult.status : 1;
  if (exitCode !== 0) {
    const stderr = `${runResult.stderr || ''}`.trim();
    throw new Error(`interactive flow exited with ${exitCode}${stderr ? `: ${stderr}` : ''}`);
  }

  const payload = parseJson(runResult.stdout, 'interactive flow');
  const flowSummary = resolvePath(cwd, payload && payload.artifacts ? payload.artifacts.flow_summary_json : '');
  const bridgeContext = resolvePath(cwd, payload && payload.artifacts ? payload.artifacts.bridge_context_json : '');

  assert(payload.mode === 'interactive-flow', 'flow mode mismatch');
  assert(payload.summary && payload.summary.status === 'completed', 'flow summary status must be completed');
  assert(payload.summary && payload.summary.gate_decision === 'allow', 'flow gate decision must be allow');
  assert(payload.summary && payload.summary.execution_result === 'success', 'flow execution result must be success');
  assert(payload.pipeline && payload.pipeline.bridge && payload.pipeline.bridge.exit_code === 0, 'bridge stage must succeed');
  assert(payload.pipeline && payload.pipeline.loop && payload.pipeline.loop.exit_code === 0, 'loop stage must succeed');
  assert(payload.pipeline && payload.pipeline.loop && payload.pipeline.loop.payload &&
    payload.pipeline.loop.payload.approval &&
    payload.pipeline.loop.payload.approval.authorization &&
    payload.pipeline.loop.payload.approval.authorization.role_requirements &&
    Array.isArray(payload.pipeline.loop.payload.approval.authorization.role_requirements.execute),
  'flow loop payload role requirements must be present');
  assert(await fs.pathExists(flowSummary), `flow summary file missing: ${flowSummary}`);
  assert(await fs.pathExists(bridgeContext), `bridge context file missing: ${bridgeContext}`);

  const smokePayload = {
    mode: 'interactive-flow-smoke',
    generated_at: new Date().toISOString(),
    status: 'passed',
    checks: {
      summary_status: payload.summary.status,
      gate_decision: payload.summary.gate_decision,
      execution_result: payload.summary.execution_result,
      bridge_exit_code: payload.pipeline.bridge.exit_code,
      loop_exit_code: payload.pipeline.loop.exit_code
    },
    artifacts: {
      flow_summary: path.relative(cwd, flowSummary) || '.',
      bridge_context: path.relative(cwd, bridgeContext) || '.'
    }
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(smokePayload, null, 2)}\n`);
  } else {
    process.stdout.write('Interactive flow smoke passed.\n');
    process.stdout.write(`- Flow summary: ${smokePayload.artifacts.flow_summary}\n`);
    process.stdout.write(`- Bridge context: ${smokePayload.artifacts.bridge_context}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive flow smoke failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_INPUT,
  DEFAULT_GOAL,
  DEFAULT_POLICY,
  DEFAULT_CATALOG,
  DEFAULT_APPROVAL_ROLE_POLICY,
  DEFAULT_APPROVAL_ACTOR_ROLE,
  DEFAULT_APPROVER_ACTOR_ROLE,
  DEFAULT_DIALOGUE_PROFILE,
  DEFAULT_OUT,
  parseArgs,
  resolvePath,
  parseJson,
  main
};
