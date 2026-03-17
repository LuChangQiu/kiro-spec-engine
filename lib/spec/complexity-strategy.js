const fs = require('fs-extra');
const path = require('path');
const { analyzeGoalSemantics } = require('../auto/semantic-decomposer');
const {
  DOMAIN_MAP_RELATIVE_PATH,
  SCENE_SPEC_RELATIVE_PATH,
  DOMAIN_CHAIN_RELATIVE_PATH,
  PROBLEM_CONTRACT_RELATIVE_PATH,
  analyzeSpecDomainCoverage
} = require('./domain-modeling');

const UNCERTAINTY_PATTERNS = [
  /\bunknown\b/gi,
  /\bunclear\b/gi,
  /\bunsure\b/gi,
  /\bnot sure\b/gi,
  /\btbd\b/gi,
  /\btodo\b/gi,
  /\bplaceholder\b/gi,
  /待确认/g,
  /待定/g,
  /不明确/g,
  /不清晰/g,
  /未知/g
];

const CONTRACT_PATTERNS = [
  /\bapi\b/gi,
  /\binterface\b/gi,
  /\bcontract\b/gi,
  /\bendpoint\b/gi,
  /\bschema\b/gi,
  /\bfrontend\b/gi,
  /\bbackend\b/gi,
  /接口/g,
  /前端/g,
  /后端/g,
  /契约/g
];

const POLICY_PATTERNS = [
  /\bpolicy\b/gi,
  /\brule\b/gi,
  /\bapproval\b/gi,
  /\bpermission\b/gi,
  /\bcompliance\b/gi,
  /\bgovernance\b/gi,
  /规则/g,
  /策略/g,
  /审批/g,
  /权限/g,
  /治理/g
];

const DEPENDENCY_PATTERNS = [
  /\bdependency\b/gi,
  /\bintegration\b/gi,
  /\bworkflow\b/gi,
  /\borchestrate\b/gi,
  /\bscheduler\b/gi,
  /\bsubsystem\b/gi,
  /\bservice\b/gi,
  /\bmodule\b/gi,
  /依赖/g,
  /集成/g,
  /编排/g,
  /调度/g,
  /子系统/g,
  /服务/g,
  /模块/g
];

const OWNERSHIP_PATTERNS = [
  /\bowner\b/gi,
  /\bownership\b/gi,
  /\bresponsibility\b/gi,
  /\bteam\b/gi,
  /\brole\b/gi,
  /负责人/g,
  /归属/g,
  /责任/g,
  /团队/g,
  /角色/g
];

const VERIFICATION_PATTERNS = [
  /\btest\b/gi,
  /\bverify\b/gi,
  /\bvalidation\b/gi,
  /\bacceptance\b/gi,
  /\bgate\b/gi,
  /\bevidence\b/gi,
  /测试/g,
  /验证/g,
  /验收/g,
  /门禁/g,
  /证据/g
];

const ROLE_PATTERNS = [
  /\buser\b/gi,
  /\boperator\b/gi,
  /\bmaintainer\b/gi,
  /\badmin\b/gi,
  /\bplanner\b/gi,
  /\bsales\b/gi,
  /\bwarehouse\b/gi,
  /用户/g,
  /运维/g,
  /维护/g,
  /管理员/g,
  /计划/g,
  /销售/g,
  /仓储/g
];

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.max(1, Math.min(5, Math.round(numeric)));
}

function scoreLevel(score) {
  if (score >= 4) {
    return 'high';
  }
  if (score >= 3) {
    return 'medium';
  }
  return 'low';
}

function countPatternHits(text, patterns = []) {
  const source = normalizeText(text);
  if (!source) {
    return 0;
  }
  let total = 0;
  for (const pattern of patterns) {
    const matches = source.match(pattern);
    total += Array.isArray(matches) ? matches.length : 0;
  }
  return total;
}

function countChecklistItems(content = '') {
  const matches = content.match(/^- \[[ xX]\]/gm);
  return Array.isArray(matches) ? matches.length : 0;
}

function average(values = []) {
  const filtered = values.filter((value) => Number.isFinite(Number(value))).map((value) => Number(value));
  if (filtered.length === 0) {
    return 0;
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function createDimension(key, score, reason, evidence = []) {
  const normalizedScore = clampScore(score);
  return {
    key,
    score: normalizedScore,
    level: scoreLevel(normalizedScore),
    reason,
    evidence: Array.isArray(evidence) ? evidence.filter(Boolean) : []
  };
}

function listHighPressureSignals(dimensions = []) {
  return dimensions
    .filter((item) => item.score >= 4)
    .map((item) => item.reason);
}

function selectTopology(decision, dimensions = []) {
  const byKey = Object.fromEntries(dimensions.map((item) => [item.key, item]));
  if (decision === 'single-spec') {
    return {
      type: 'single-spec',
      tracks: ['implementation']
    };
  }

  if (decision === 'research-program') {
    const tracks = ['domain-clarification'];
    if ((byKey.contract_clarity && byKey.contract_clarity.score >= 4)) {
      tracks.push('contract-clarification');
    }
    if ((byKey.policy_clarity && byKey.policy_clarity.score >= 4)) {
      tracks.push('policy-clarification');
    }
    if ((byKey.ownership_clarity && byKey.ownership_clarity.score >= 4)) {
      tracks.push('ownership-clarification');
    }
    tracks.push('implementation-decomposition');
    tracks.push('verification-strategy');
    return {
      type: 'research-first-master-sub',
      tracks: Array.from(new Set(tracks))
    };
  }

  const tracks = ['implementation-split'];
  if ((byKey.contract_clarity && byKey.contract_clarity.score >= 3)) {
    tracks.push('integration-contract');
  }
  if ((byKey.verification_readiness && byKey.verification_readiness.score >= 3)) {
    tracks.push('verification');
  }
  if ((byKey.dependency_entanglement && byKey.dependency_entanglement.score >= 4)) {
    tracks.push('orchestration');
  }
  return {
    type: 'implementation-master-sub',
    tracks: Array.from(new Set(tracks))
  };
}

function recommendProgramSpecCount(decision, dimensions = []) {
  if (decision === 'single-spec') {
    return 1;
  }
  const highCount = dimensions.filter((item) => item.score >= 4).length;
  return decision === 'research-program'
    ? Math.max(4, Math.min(6, 3 + highCount))
    : Math.max(3, Math.min(5, 2 + highCount));
}

function buildNextActions(decision, sourceType, sourceId = null) {
  if (decision === 'single-spec') {
    return [
      sourceType === 'spec'
        ? `continue refining Spec ${sourceId} through requirements/design/tasks`
        : 'bootstrap one Spec and keep domain-first artifacts aligned',
      'run spec domain coverage before implementation tasks',
      'avoid premature multi-Spec split unless new evidence appears'
    ];
  }

  if (decision === 'research-program') {
    return [
      'create a master program spec before implementation splitting',
      'split clarification specs for domain, contract, and policy unknowns first',
      'wait for stable executable tasks before routing child specs into implementation execution'
    ];
  }

  return [
    'create a coordinated multi-Spec portfolio with explicit dependencies',
    'use orchestrate or close-loop-program instead of forcing one oversized Spec',
    'keep verification and integration contract tracks explicit across child specs'
  ];
}

function readJsonSafely(filePath, fileSystem) {
  return fileSystem.readJson(filePath).catch(() => null);
}

async function buildSpecEvidence(projectPath, specId, fileSystem = fs) {
  const specRoot = path.join(projectPath, '.sce', 'specs', specId);
  const paths = {
    requirements: path.join(specRoot, 'requirements.md'),
    design: path.join(specRoot, 'design.md'),
    tasks: path.join(specRoot, 'tasks.md'),
    domainMap: path.join(specRoot, DOMAIN_MAP_RELATIVE_PATH),
    sceneSpec: path.join(specRoot, SCENE_SPEC_RELATIVE_PATH),
    domainChain: path.join(specRoot, DOMAIN_CHAIN_RELATIVE_PATH),
    problemContract: path.join(specRoot, PROBLEM_CONTRACT_RELATIVE_PATH)
  };

  const contents = {};
  for (const [key, filePath] of Object.entries(paths)) {
    if (await fileSystem.pathExists(filePath)) {
      contents[key] = await fileSystem.readFile(filePath, 'utf8');
    } else {
      contents[key] = '';
    }
  }

  const domainChainPayload = await fileSystem.pathExists(paths.domainChain)
    ? await readJsonSafely(paths.domainChain, fileSystem)
    : null;
  const problemContractPayload = await fileSystem.pathExists(paths.problemContract)
    ? await readJsonSafely(paths.problemContract, fileSystem)
    : null;
  const coverage = await analyzeSpecDomainCoverage(projectPath, specId, fileSystem).catch(() => null);

  return {
    specRoot,
    paths,
    contents,
    domainChainPayload,
    problemContractPayload,
    coverage
  };
}

function computeGoalDimensions(goal) {
  const semantic = analyzeGoalSemantics(goal);
  const uncertaintyHits = countPatternHits(goal, UNCERTAINTY_PATTERNS);
  const contractHits = countPatternHits(goal, CONTRACT_PATTERNS);
  const policyHits = countPatternHits(goal, POLICY_PATTERNS);
  const dependencyHits = countPatternHits(goal, DEPENDENCY_PATTERNS);
  const ownershipHits = countPatternHits(goal, OWNERSHIP_PATTERNS);
  const verificationHits = countPatternHits(goal, VERIFICATION_PATTERNS);
  const roleHits = countPatternHits(goal, ROLE_PATTERNS);
  const clauseCount = semantic.clauses.length || 1;
  const activeCategories = Object.values(semantic.categoryScores).filter((value) => value > 0).length;

  return [
    createDimension(
      'scene_span',
      1 + Math.min(4, roleHits + (clauseCount >= 4 ? 1 : 0)),
      roleHits >= 2 || clauseCount >= 4
        ? 'problem spans multiple scene/role concerns instead of one narrow execution path'
        : 'problem appears to stay within one narrow scene path',
      [`clauses=${clauseCount}`, `role_hits=${roleHits}`]
    ),
    createDimension(
      'domain_span',
      1 + Math.min(4, activeCategories + (clauseCount >= 3 ? 1 : 0)),
      activeCategories >= 3 || clauseCount >= 3
        ? 'goal already implies multiple implementation or domain tracks'
        : 'goal scope is still narrow enough for one bounded context',
      [`active_categories=${activeCategories}`, `clauses=${clauseCount}`]
    ),
    createDimension(
      'contract_clarity',
      1 + Math.min(4, (contractHits > 0 ? 1 : 0) + uncertaintyHits),
      contractHits > 0 && uncertaintyHits > 0
        ? 'API/interface contract concerns exist but remain unclear'
        : contractHits > 0
          ? 'contract constraints exist and should be made explicit'
          : 'goal does not currently show strong contract ambiguity',
      [`contract_hits=${contractHits}`, `uncertainty_hits=${uncertaintyHits}`]
    ),
    createDimension(
      'policy_clarity',
      1 + Math.min(4, (policyHits > 0 ? 1 : 0) + (uncertaintyHits > 1 ? 1 : 0)),
      policyHits > 0 && uncertaintyHits > 0
        ? 'business rules or policy constraints are mentioned but not yet stable'
        : policyHits > 0
          ? 'policy or rule constraints are present and should be clarified before execution'
          : 'policy scope does not dominate this goal',
      [`policy_hits=${policyHits}`, `uncertainty_hits=${uncertaintyHits}`]
    ),
    createDimension(
      'dependency_entanglement',
      1 + Math.min(4, dependencyHits + (clauseCount >= 3 ? 1 : 0)),
      dependencyHits >= 2 || clauseCount >= 3
        ? 'goal depends on multiple subsystems or coordinated tracks'
        : 'dependency surface looks limited',
      [`dependency_hits=${dependencyHits}`, `clauses=${clauseCount}`]
    ),
    createDimension(
      'ownership_clarity',
      1 + Math.min(4, (ownershipHits > 0 ? 1 : 0) + (roleHits >= 2 ? 1 : 0) + (uncertaintyHits > 0 ? 1 : 0)),
      ownershipHits > 0 && uncertaintyHits > 0
        ? 'responsibility boundaries are present but not yet clear'
        : roleHits >= 2
          ? 'multiple roles imply cross-owner coordination'
          : 'ownership boundary appears relatively clear',
      [`ownership_hits=${ownershipHits}`, `role_hits=${roleHits}`]
    ),
    createDimension(
      'verification_readiness',
      verificationHits > 0 ? 2 : (clauseCount >= 3 ? 4 : 3),
      verificationHits > 0
        ? 'goal already mentions verification or acceptance signals'
        : 'verification path is not yet explicit for this goal',
      [`verification_hits=${verificationHits}`]
    ),
    createDimension(
      'decomposition_stability',
      1 + Math.min(4, (clauseCount >= 3 ? 1 : 0) + activeCategories + uncertaintyHits),
      uncertaintyHits > 0 || clauseCount >= 4
        ? 'direct task breakdown is likely unstable until the goal is disentangled'
        : 'direct task breakdown should be relatively stable',
      [`clauses=${clauseCount}`, `uncertainty_hits=${uncertaintyHits}`, `active_categories=${activeCategories}`]
    )
  ];
}

function computeSpecDimensions(specId, evidence) {
  const corpus = [
    evidence.contents.requirements,
    evidence.contents.design,
    evidence.contents.tasks,
    evidence.contents.sceneSpec,
    evidence.contents.domainMap
  ].filter(Boolean).join('\n');
  const uncertaintyHits = countPatternHits(corpus, UNCERTAINTY_PATTERNS);
  const contractHits = countPatternHits(corpus, CONTRACT_PATTERNS);
  const policyHits = countPatternHits(corpus, POLICY_PATTERNS);
  const dependencyHits = countPatternHits(corpus, DEPENDENCY_PATTERNS);
  const ownershipHits = countPatternHits(corpus, OWNERSHIP_PATTERNS);
  const verificationHits = countPatternHits(corpus, VERIFICATION_PATTERNS);
  const roleHits = countPatternHits(corpus, ROLE_PATTERNS);
  const taskCount = countChecklistItems(evidence.contents.tasks || '');
  const coverage = evidence.coverage;
  const coverageRatio = coverage ? Number(coverage.coverage_ratio || 0) : 0;
  const uncovered = coverage && Array.isArray(coverage.uncovered) ? coverage.uncovered : [];
  const ontology = evidence.domainChainPayload && typeof evidence.domainChainPayload === 'object'
    ? evidence.domainChainPayload.ontology || {}
    : {};
  const ontologyBreadth = ['entity', 'relation', 'business_rule', 'decision_policy', 'execution_flow']
    .reduce((sum, key) => {
      const value = Array.isArray(ontology[key]) ? ontology[key].length : 0;
      return sum + value;
    }, 0);

  return [
    createDimension(
      'scene_span',
      1 + Math.min(4, (roleHits >= 3 ? 2 : roleHits >= 1 ? 1 : 0) + (dependencyHits >= 3 ? 1 : 0)),
      roleHits >= 2
        ? `Spec ${specId} appears to cover multiple user/owner perspectives`
        : `Spec ${specId} still looks centered on one primary scene`,
      [`role_hits=${roleHits}`]
    ),
    createDimension(
      'domain_span',
      1 + Math.min(4, Math.ceil(ontologyBreadth / 3)),
      ontologyBreadth >= 8
        ? `Spec ${specId} already carries a broad ontology/problem surface`
        : `Spec ${specId} keeps a relatively bounded ontology surface`,
      [`ontology_breadth=${ontologyBreadth}`]
    ),
    createDimension(
      'contract_clarity',
      1 + Math.min(4, (contractHits > 0 ? 1 : 0) + (uncertaintyHits > 0 ? 1 : 0) + (uncovered.includes('relation') ? 1 : 0)),
      contractHits > 0 && (uncertaintyHits > 0 || uncovered.includes('relation'))
        ? `Spec ${specId} still has unresolved contract/interface ambiguity`
        : `Spec ${specId} does not currently show severe contract ambiguity`,
      [`contract_hits=${contractHits}`, `uncertainty_hits=${uncertaintyHits}`]
    ),
    createDimension(
      'policy_clarity',
      1 + Math.min(4, (policyHits > 0 ? 1 : 0) + (uncovered.includes('business_rule') ? 1 : 0) + (uncovered.includes('decision_policy') ? 1 : 0)),
      policyHits > 0 && (uncovered.includes('business_rule') || uncovered.includes('decision_policy'))
        ? `Spec ${specId} still has unresolved business-rule or decision-policy gaps`
        : `Spec ${specId} has manageable policy scope`,
      [`policy_hits=${policyHits}`, `uncovered=${uncovered.filter((item) => item === 'business_rule' || item === 'decision_policy').join('|') || 'none'}`]
    ),
    createDimension(
      'dependency_entanglement',
      1 + Math.min(4, dependencyHits + (ontologyBreadth >= 8 ? 1 : 0)),
      dependencyHits >= 2 || ontologyBreadth >= 8
        ? `Spec ${specId} shows significant dependency coordination pressure`
        : `Spec ${specId} dependency surface is still manageable`,
      [`dependency_hits=${dependencyHits}`, `ontology_breadth=${ontologyBreadth}`]
    ),
    createDimension(
      'ownership_clarity',
      1 + Math.min(4, (ownershipHits > 0 ? 1 : 0) + (roleHits >= 2 ? 1 : 0) + (uncertaintyHits > 1 ? 1 : 0)),
      roleHits >= 2 || (ownershipHits > 0 && uncertaintyHits > 0)
        ? `Spec ${specId} likely needs clearer ownership boundaries`
        : `Spec ${specId} ownership boundary appears acceptable`,
      [`ownership_hits=${ownershipHits}`, `role_hits=${roleHits}`]
    ),
    createDimension(
      'verification_readiness',
      clampScore(5 - (coverageRatio * 4) + (verificationHits > 0 ? -1 : 0)),
      coverageRatio < 0.6
        ? `Spec ${specId} lacks enough domain/verification evidence for stable execution`
        : `Spec ${specId} has a workable verification baseline`,
      [`coverage_ratio=${coverageRatio.toFixed(2)}`, `verification_hits=${verificationHits}`]
    ),
    createDimension(
      'decomposition_stability',
      taskCount === 0
        ? 5
        : clampScore(1 + (uncertaintyHits > 1 ? 2 : uncertaintyHits > 0 ? 1 : 0) + (taskCount < 3 ? 1 : 0) + (coverageRatio < 0.6 ? 1 : 0)),
      taskCount === 0
        ? `Spec ${specId} has no executable task breakdown yet`
        : uncertaintyHits > 0 || coverageRatio < 0.6
          ? `Spec ${specId} task breakdown is likely unstable without more clarification`
          : `Spec ${specId} task breakdown is reasonably stable`,
      [`task_count=${taskCount}`, `uncertainty_hits=${uncertaintyHits}`, `coverage_ratio=${coverageRatio.toFixed(2)}`]
    )
  ];
}

function decideStrategy(dimensions = []) {
  const byKey = Object.fromEntries(dimensions.map((item) => [item.key, item]));
  const clarityPressure = average([
    byKey.contract_clarity && byKey.contract_clarity.score,
    byKey.policy_clarity && byKey.policy_clarity.score,
    byKey.ownership_clarity && byKey.ownership_clarity.score,
    byKey.verification_readiness && byKey.verification_readiness.score,
    byKey.decomposition_stability && byKey.decomposition_stability.score
  ]);
  const breadthPressure = average([
    byKey.scene_span && byKey.scene_span.score,
    byKey.domain_span && byKey.domain_span.score,
    byKey.dependency_entanglement && byKey.dependency_entanglement.score
  ]);
  const highest = [...dimensions].sort((left, right) => right.score - left.score)[0] || null;
  const criticalClarificationCount = [
    byKey.contract_clarity && byKey.contract_clarity.score,
    byKey.policy_clarity && byKey.policy_clarity.score,
    byKey.ownership_clarity && byKey.ownership_clarity.score,
    byKey.verification_readiness && byKey.verification_readiness.score,
    byKey.decomposition_stability && byKey.decomposition_stability.score
  ].filter((value) => Number(value) >= 4).length;

  if (
    (clarityPressure >= 3.6 && breadthPressure >= 2.5)
    || (clarityPressure >= 3.6 && criticalClarificationCount >= 3)
  ) {
    return {
      decision: 'research-program',
      reason: 'problem breadth is high and core clarification dimensions are still unstable',
      clarity_pressure: clarityPressure,
      breadth_pressure: breadthPressure,
      highest_dimension: highest ? highest.key : null
    };
  }

  if (
    breadthPressure >= 3
    || average(dimensions.map((item) => item.score)) >= 3.1
    || (highest && highest.score >= 5)
  ) {
    return {
      decision: 'multi-spec-program',
      reason: 'problem is broad enough that coordinated multi-Spec execution is safer than one oversized Spec',
      clarity_pressure: clarityPressure,
      breadth_pressure: breadthPressure,
      highest_dimension: highest ? highest.key : null
    };
  }

  return {
    decision: 'single-spec',
    reason: 'problem still fits one Spec with manageable complexity and clarification pressure',
    clarity_pressure: clarityPressure,
    breadth_pressure: breadthPressure,
    highest_dimension: highest ? highest.key : null
  };
}

function buildPayload(source, dimensions, decisionInfo) {
  const topology = selectTopology(decisionInfo.decision, dimensions);
  return {
    mode: 'spec-strategy-assess',
    generated_at: new Date().toISOString(),
    source,
    summary: {
      assessment_source: source.type,
      decision: decisionInfo.decision,
      single_spec_fit: decisionInfo.decision === 'single-spec',
      highest_pressure_dimension: decisionInfo.highest_dimension,
      reason_count: listHighPressureSignals(dimensions).length,
      recommended_program_specs: recommendProgramSpecCount(decisionInfo.decision, dimensions)
    },
    decision: decisionInfo.decision,
    decision_reason: decisionInfo.reason,
    pressures: {
      clarity: Number(decisionInfo.clarity_pressure.toFixed(2)),
      breadth: Number(decisionInfo.breadth_pressure.toFixed(2))
    },
    dimensions,
    signals: listHighPressureSignals(dimensions),
    recommended_topology: topology,
    next_actions: buildNextActions(decisionInfo.decision, source.type, source.id || null)
  };
}

async function assessComplexityStrategy(options = {}, dependencies = {}) {
  const goal = normalizeText(options.goal);
  const specId = normalizeText(options.spec);
  if (!goal && !specId) {
    throw new Error('One selector is required: --goal or --spec');
  }
  if (goal && specId) {
    throw new Error('Use either --goal or --spec, not both');
  }

  if (goal) {
    const dimensions = computeGoalDimensions(goal);
    const decisionInfo = decideStrategy(dimensions);
    return buildPayload({
      type: 'goal',
      goal
    }, dimensions, decisionInfo);
  }

  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const specRoot = path.join(projectPath, '.sce', 'specs', specId);
  if (!await fileSystem.pathExists(specRoot)) {
    throw new Error(`Spec not found: ${specId}`);
  }
  const evidence = await buildSpecEvidence(projectPath, specId, fileSystem);
  const dimensions = computeSpecDimensions(specId, evidence);
  const decisionInfo = decideStrategy(dimensions);
  const payload = buildPayload({
    type: 'spec',
    id: specId,
    spec_root: specRoot,
    evidence_files: [
      path.join(specRoot, 'requirements.md'),
      path.join(specRoot, 'design.md'),
      path.join(specRoot, 'tasks.md'),
      path.join(specRoot, DOMAIN_MAP_RELATIVE_PATH),
      path.join(specRoot, SCENE_SPEC_RELATIVE_PATH),
      path.join(specRoot, DOMAIN_CHAIN_RELATIVE_PATH),
      path.join(specRoot, PROBLEM_CONTRACT_RELATIVE_PATH)
    ]
  }, dimensions, decisionInfo);
  if (evidence.coverage) {
    payload.spec_coverage = {
      passed: evidence.coverage.passed,
      coverage_ratio: evidence.coverage.coverage_ratio,
      covered_count: evidence.coverage.covered_count,
      total_count: evidence.coverage.total_count,
      uncovered: evidence.coverage.uncovered
    };
  }
  return payload;
}

module.exports = {
  assessComplexityStrategy
};
