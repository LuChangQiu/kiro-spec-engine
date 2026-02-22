#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function readJsonFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function toBool(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(lowered)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', 'off'].includes(lowered)) {
      return false;
    }
  }
  return fallback;
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeInput(input = {}) {
  const goalTypeRaw = typeof input.goal_type === 'string' ? input.goal_type.trim().toLowerCase() : '';
  return {
    goal_type: goalTypeRaw || 'unknown',
    requires_write: toBool(input.requires_write, false),
    high_risk: toBool(input.high_risk, false),
    last_run_failed: toBool(input.last_run_failed, false),
    has_rollback_checkpoint: toBool(input.has_rollback_checkpoint, false),
    test_failures: toFiniteNumber(input.test_failures, 0),
    changed_files: toFiniteNumber(input.changed_files, 0),
    user_explicit_answer_only: toBool(input.user_explicit_answer_only, false),
    user_explicit_rollback: toBool(input.user_explicit_rollback, false)
  };
}

function resolvePolicy(policy = {}) {
  const fallback = {
    answer_only_goal_types: ['question', 'analysis', 'explain', 'summarize'],
    rollback_when: {
      require_checkpoint: true,
      require_high_risk_or_explicit: true
    },
    code_fix_when_tests_fail: true
  };
  const answerTypes = Array.isArray(policy.answer_only_goal_types)
    ? policy.answer_only_goal_types
      .map(item => `${item || ''}`.trim().toLowerCase())
      .filter(Boolean)
    : fallback.answer_only_goal_types;
  return {
    answer_only_goal_types: answerTypes.length > 0 ? answerTypes : fallback.answer_only_goal_types,
    rollback_when: {
      require_checkpoint: toBool(
        policy.rollback_when && policy.rollback_when.require_checkpoint,
        fallback.rollback_when.require_checkpoint
      ),
      require_high_risk_or_explicit: toBool(
        policy.rollback_when && policy.rollback_when.require_high_risk_or_explicit,
        fallback.rollback_when.require_high_risk_or_explicit
      )
    },
    code_fix_when_tests_fail: toBool(policy.code_fix_when_tests_fail, fallback.code_fix_when_tests_fail)
  };
}

function evaluateStrategy(input = {}, policyInput = {}) {
  const payload = normalizeInput(input);
  const policy = resolvePolicy(policyInput);
  const reasons = [];
  let decision = 'answer_only';
  let confidence = 'low';

  if (payload.user_explicit_answer_only) {
    decision = 'answer_only';
    confidence = 'high';
    reasons.push('explicit user instruction: answer only');
  } else if (payload.user_explicit_rollback) {
    const checkpointOk = !policy.rollback_when.require_checkpoint || payload.has_rollback_checkpoint;
    const riskGateOk = !policy.rollback_when.require_high_risk_or_explicit || payload.high_risk || payload.user_explicit_rollback;
    if (checkpointOk && riskGateOk) {
      decision = 'rollback';
      confidence = 'high';
      reasons.push('explicit user instruction: rollback');
    } else {
      decision = 'answer_only';
      confidence = 'medium';
      reasons.push('rollback requested but preconditions are not met');
    }
  } else if (
    payload.last_run_failed
    && payload.has_rollback_checkpoint
    && payload.high_risk
    && payload.changed_files > 0
  ) {
    decision = 'rollback';
    confidence = 'high';
    reasons.push('last run failed with high risk and rollback checkpoint available');
  } else if (
    policy.answer_only_goal_types.includes(payload.goal_type)
    && !payload.requires_write
  ) {
    decision = 'answer_only';
    confidence = 'high';
    reasons.push(`goal_type=${payload.goal_type} with no write requirement`);
  } else if (
    policy.code_fix_when_tests_fail
    && payload.test_failures > 0
    && payload.changed_files > 0
  ) {
    decision = 'code_fix';
    confidence = 'high';
    reasons.push('tests failing after code changes, prioritize focused repair');
  } else if (payload.requires_write || payload.goal_type === 'feature' || payload.goal_type === 'bugfix') {
    decision = 'code_change';
    confidence = 'medium';
    reasons.push('write-required goal needs implementation changes');
  } else {
    decision = 'answer_only';
    confidence = 'low';
    reasons.push('insufficient signals for safe code changes');
  }

  const next_actions = [];
  if (decision === 'rollback') {
    next_actions.push('execute rollback to latest stable checkpoint');
    next_actions.push('collect failure evidence before reattempt');
  } else if (decision === 'code_fix') {
    next_actions.push('locate failing symbols and failing tests first');
    next_actions.push('apply minimal patch and re-run targeted tests');
  } else if (decision === 'code_change') {
    next_actions.push('confirm affected scope and symbol locations');
    next_actions.push('implement change and run validation tests');
  } else {
    next_actions.push('answer request with evidence and constraints');
    next_actions.push('avoid repository writes in current turn');
  }

  return {
    mode: 'auto-strategy-router',
    decision,
    confidence,
    reasons,
    next_actions,
    input: payload,
    policy
  };
}

function parseArgs(argv = []) {
  const options = {
    input: null,
    inputFile: '',
    policyFile: '',
    json: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--input') {
      options.input = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--input-file') {
      options.inputFile = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--policy-file') {
      options.policyFile = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--json') {
      options.json = true;
      continue;
    }
    if (token === '-h' || token === '--help') {
      console.log([
        'Usage:',
        '  node scripts/auto-strategy-router.js --input-file <path> [--policy-file <path>] --json',
        '  node scripts/auto-strategy-router.js --input \'{\"goal_type\":\"bugfix\",\"requires_write\":true}\' --json'
      ].join('\n'));
      process.exit(0);
    }
  }
  return options;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  let inputPayload = {};
  let policyPayload = {};
  if (args.inputFile) {
    inputPayload = readJsonFile(args.inputFile);
  } else if (args.input) {
    inputPayload = JSON.parse(args.input);
  }
  if (args.policyFile) {
    policyPayload = readJsonFile(args.policyFile);
  }
  const result = evaluateStrategy(inputPayload, policyPayload);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(
      `[auto-strategy-router] decision=${result.decision} confidence=${result.confidence} reasons=${result.reasons.join('; ')}\n`
    );
  }
}

module.exports = {
  evaluateStrategy,
  normalizeInput,
  parseArgs,
  resolvePolicy
};
