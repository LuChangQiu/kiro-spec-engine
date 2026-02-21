#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const DEFAULT_CONTEXT = 'docs/interactive-customization/page-context.sample.json';
const DEFAULT_GOAL = 'Adjust order screen field layout for clearer input flow';
const DEFAULT_APPROVAL_ROLE_POLICY = 'docs/interactive-customization/approval-role-policy-baseline.json';
const DEFAULT_APPROVAL_ACTOR_ROLE = 'workflow-operator';
const DEFAULT_APPROVER_ACTOR_ROLE = 'workflow-operator';
const DEFAULT_DIALOGUE_PROFILE = 'system-maintainer';
const DEFAULT_OUT = '.kiro/reports/interactive-loop-smoke/interactive-loop-smoke.summary.json';

function parseArgs(argv) {
  const options = {
    context: DEFAULT_CONTEXT,
    goal: DEFAULT_GOAL,
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
    if (token === '--context' && next) {
      options.context = next;
      index += 1;
    } else if (token === '--goal' && next) {
      options.goal = next;
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
    'Usage: node scripts/interactive-loop-smoke.js [options]',
    '',
    'Options:',
    `  --context <path>     Context JSON path (default: ${DEFAULT_CONTEXT})`,
    `  --goal <text>        Smoke goal text (default: ${DEFAULT_GOAL})`,
    `  --approval-role-policy <path> Role policy path (default: ${DEFAULT_APPROVAL_ROLE_POLICY})`,
    `  --approval-actor-role <name>  Approval actor role (default: ${DEFAULT_APPROVAL_ACTOR_ROLE})`,
    `  --approver-actor-role <name>  Approver actor role (default: ${DEFAULT_APPROVER_ACTOR_ROLE})`,
    `  --dialogue-profile <name>      Dialogue profile (default: ${DEFAULT_DIALOGUE_PROFILE})`,
    `  --out <path>         Loop summary output path (default: ${DEFAULT_OUT})`,
    '  --json               Print smoke payload as JSON',
    '  -h, --help           Show this help'
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
  const loopScript = path.resolve(__dirname, 'interactive-customization-loop.js');
  const contextPath = resolvePath(cwd, options.context);
  const approvalRolePolicyPath = resolvePath(cwd, options.approvalRolePolicy);
  const outPath = resolvePath(cwd, options.out);

  if (!(await fs.pathExists(loopScript))) {
    throw new Error(`interactive loop script not found: ${loopScript}`);
  }
  if (!(await fs.pathExists(contextPath))) {
    throw new Error(`context file not found: ${contextPath}`);
  }
  if (!(await fs.pathExists(approvalRolePolicyPath))) {
    throw new Error(`approval role policy file not found: ${approvalRolePolicyPath}`);
  }

  const args = [
    loopScript,
    '--context', contextPath,
    '--goal', options.goal,
    '--execution-mode', 'apply',
    '--dialogue-profile', options.dialogueProfile,
    '--approval-role-policy', approvalRolePolicyPath,
    '--approval-actor-role', options.approvalActorRole,
    '--approver-actor-role', options.approverActorRole,
    '--auto-execute-low-risk',
    '--auth-password-hash', crypto.createHash('sha256').update('smoke-pass').digest('hex'),
    '--auth-password', 'smoke-pass',
    '--feedback-score', '5',
    '--feedback-comment', 'CI smoke feedback',
    '--feedback-tags', 'ci,smoke',
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
    throw new Error(`interactive loop exited with ${exitCode}${stderr ? `: ${stderr}` : ''}`);
  }

  const payload = parseJson(runResult.stdout, 'interactive loop');
  const artifactFeedback = resolvePath(cwd, payload && payload.artifacts ? payload.artifacts.feedback_jsonl : '');
  const artifactFeedbackGlobal = resolvePath(cwd, payload && payload.artifacts ? payload.artifacts.feedback_global_jsonl : '');
  const artifactSummary = resolvePath(cwd, payload && payload.artifacts ? payload.artifacts.summary_json : '');

  assert(payload.mode === 'interactive-customization-loop', 'loop mode mismatch');
  assert(payload.summary && payload.summary.status === 'completed', 'loop summary status must be completed');
  assert(payload.execution && payload.execution.attempted === true, 'loop execution must be attempted');
  assert(payload.execution && payload.execution.blocked === false, 'loop execution must not be blocked');
  assert(payload.approval && payload.approval.authorization && payload.approval.authorization.role_requirements &&
    Array.isArray(payload.approval.authorization.role_requirements.execute), 'loop role requirements must be present');
  assert(payload.feedback && payload.feedback.logged === true, 'loop feedback must be logged');
  assert(Array.isArray(payload.steps) && payload.steps.some(step => step && step.name === 'feedback_log'), 'feedback_log step is required');
  assert(await fs.pathExists(artifactFeedback), `session feedback file missing: ${artifactFeedback}`);
  assert(await fs.pathExists(artifactFeedbackGlobal), `global feedback file missing: ${artifactFeedbackGlobal}`);
  assert(await fs.pathExists(artifactSummary), `loop summary file missing: ${artifactSummary}`);

  const smokePayload = {
    mode: 'interactive-loop-smoke',
    generated_at: new Date().toISOString(),
    status: 'passed',
    checks: {
      summary_status: payload.summary.status,
      gate_decision: payload.gate ? payload.gate.decision : null,
      execution_result: payload.execution ? payload.execution.result : null,
      feedback_logged: payload.feedback ? payload.feedback.logged : false
    },
    artifacts: {
      summary: path.relative(cwd, artifactSummary) || '.',
      feedback_session: path.relative(cwd, artifactFeedback) || '.',
      feedback_global: path.relative(cwd, artifactFeedbackGlobal) || '.'
    }
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(smokePayload, null, 2)}\n`);
  } else {
    process.stdout.write('Interactive loop smoke passed.\n');
    process.stdout.write(`- Summary: ${smokePayload.artifacts.summary}\n`);
    process.stdout.write(`- Feedback (session): ${smokePayload.artifacts.feedback_session}\n`);
    process.stdout.write(`- Feedback (global): ${smokePayload.artifacts.feedback_global}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive loop smoke failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_CONTEXT,
  DEFAULT_GOAL,
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
