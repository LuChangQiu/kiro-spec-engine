'use strict';

// ─── Constants ─────────────────────────────────────────────────────

/** Known binding ref prefixes for validation */
const KNOWN_BINDING_REF_PREFIXES = ['moqui.', 'spec.erp.', 'kse.scene.'];

/** Valid risk levels for governance checks */
const VALID_RISK_LEVELS = ['low', 'medium', 'high'];

/** Pattern for kebab-case names */
const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Pattern for semver versions */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/** Required top-level fields in scene-package.json */
const REQUIRED_PACKAGE_FIELDS = ['apiVersion', 'kind', 'metadata', 'capabilities', 'artifacts', 'governance'];

/** Required top-level fields in scene.yaml */
const REQUIRED_MANIFEST_FIELDS = ['apiVersion', 'kind', 'metadata', 'spec'];

/** Score dimension weights (total = 100) */
const SCORE_WEIGHTS = {
  contractValidity: 30,
  lintPassRate: 30,
  documentationQuality: 20,
  governanceCompleteness: 20
};

// ─── Lint Engine Functions ─────────────────────────────────────────

/**
 * Create a single LintItem.
 * @param {'error'|'warning'|'info'} level - Severity level
 * @param {string} code - Machine-readable error code
 * @param {string} message - Human-readable description
 * @returns {{ level: string, code: string, message: string }}
 */
function createLintItem(level, code, message) {
  return { level, code, message };
}

/**
 * Check scene-package.json manifest completeness.
 * Verifies that all required top-level fields are present.
 * @param {Object} contract - Parsed scene-package.json object
 * @returns {Array<{ level: string, code: string, message: string }>}
 */
function checkManifestCompleteness(contract) {
  const items = [];
  for (const field of REQUIRED_PACKAGE_FIELDS) {
    if (contract[field] === undefined || contract[field] === null) {
      items.push(createLintItem('error', 'MISSING_PACKAGE_FIELD', `scene-package.json is missing required field: ${field}`));
    }
  }
  return items;
}

/**
 * Check scene.yaml manifest completeness.
 * Verifies that all required top-level fields are present.
 * @param {Object} manifest - Parsed scene.yaml object
 * @returns {Array<{ level: string, code: string, message: string }>}
 */
function checkSceneManifestCompleteness(manifest) {
  const items = [];
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (manifest[field] === undefined || manifest[field] === null) {
      items.push(createLintItem('warning', 'MISSING_MANIFEST_FIELD', `scene.yaml is missing required field: ${field}`));
    }
  }
  return items;
}

/**
 * Validate binding ref format.
 * Extracts refs from capability_contract.bindings (or spec.capability_contract.bindings)
 * and verifies each ref starts with a known prefix.
 * @param {Object} contract - scene-package.json or scene.yaml object
 * @returns {Array<{ level: string, code: string, message: string }>}
 */
function checkBindingRefFormat(contract) {
  const items = [];
  // Try both direct and nested paths for bindings
  const bindings =
    (contract.capability_contract && contract.capability_contract.bindings) ||
    (contract.spec && contract.spec.capability_contract && contract.spec.capability_contract.bindings);

  if (!bindings || typeof bindings !== 'object') {
    return items;
  }

  const bindingEntries = Array.isArray(bindings) ? bindings : Object.values(bindings);

  for (const binding of bindingEntries) {
    const ref = typeof binding === 'string' ? binding : (binding && binding.ref);
    if (!ref || typeof ref !== 'string') continue;

    const matchesKnownPrefix = KNOWN_BINDING_REF_PREFIXES.some(prefix => ref.startsWith(prefix));
    if (!matchesKnownPrefix) {
      items.push(createLintItem('warning', 'INVALID_BINDING_REF', `Binding ref "${ref}" does not match any known prefix (${KNOWN_BINDING_REF_PREFIXES.join(', ')})`));
    }
  }

  return items;
}

/**
 * Check governance contract reasonableness.
 * Validates risk_level, approval.required, and idempotency.required fields.
 * @param {Object} governance - governance object
 * @returns {Array<{ level: string, code: string, message: string }>}
 */
function checkGovernanceReasonableness(governance) {
  const items = [];

  if (!governance || typeof governance !== 'object') {
    return items;
  }

  // Check risk_level
  if (governance.risk_level !== undefined && governance.risk_level !== null) {
    if (!VALID_RISK_LEVELS.includes(governance.risk_level)) {
      items.push(createLintItem('error', 'INVALID_RISK_LEVEL', `governance.risk_level must be one of: ${VALID_RISK_LEVELS.join(', ')} (got "${governance.risk_level}")`));
    }
  }

  // Check approval.required
  if (!governance.approval || typeof governance.approval.required !== 'boolean') {
    items.push(createLintItem('warning', 'MISSING_APPROVAL', 'governance.approval.required is not set or is not a boolean'));
  }

  // Check idempotency.required
  if (!governance.idempotency || typeof governance.idempotency.required !== 'boolean') {
    items.push(createLintItem('warning', 'MISSING_IDEMPOTENCY', 'governance.idempotency.required is not set or is not a boolean'));
  }

  return items;
}

/**
 * Check package contract consistency.
 * Validates name is kebab-case, version is valid semver, and entry_scene file exists.
 * @param {Object} contract - scene-package.json object
 * @param {string} packageDir - Package directory path
 * @param {Object} [fileSystem] - fs-extra compatible file system
 * @returns {Promise<Array<{ level: string, code: string, message: string }>>}
 */
async function checkPackageConsistency(contract, packageDir, fileSystem) {
  const fs = fileSystem || require('fs-extra');
  const path = require('path');
  const semver = require('semver');
  const items = [];

  // Check metadata.name is kebab-case
  const name = contract.metadata && contract.metadata.name;
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string' || !KEBAB_CASE_PATTERN.test(name)) {
      items.push(createLintItem('error', 'NAME_NOT_KEBAB', `metadata.name "${name}" is not valid kebab-case`));
    }
  }

  // Check metadata.version is valid semver
  const version = contract.metadata && contract.metadata.version;
  if (version !== undefined && version !== null) {
    if (typeof version !== 'string' || !semver.valid(version)) {
      items.push(createLintItem('error', 'INVALID_VERSION', `metadata.version "${version}" is not valid semver`));
    }
  }

  // Check artifacts.entry_scene file exists
  const entryScene = contract.artifacts && contract.artifacts.entry_scene;
  if (entryScene && typeof entryScene === 'string') {
    const entryPath = path.resolve(packageDir, entryScene);
    const exists = await fs.pathExists(entryPath);
    if (!exists) {
      items.push(createLintItem('error', 'ENTRY_SCENE_MISSING', `artifacts.entry_scene file "${entryScene}" does not exist in package directory`));
    }
  }

  return items;
}

/**
 * Check template variables schema completeness.
 * Validates that each variable has a non-empty type and description field.
 * Looks in contract.variables, contract.parameters, or contract.spec.variables/parameters.
 * @param {Object} contract - scene-package.json object
 * @returns {Array<{ level: string, code: string, message: string }>}
 */
function checkTemplateVariables(contract) {
  const items = [];

  // Try multiple paths for variables
  const variables =
    contract.variables ||
    contract.parameters ||
    (contract.spec && (contract.spec.variables || contract.spec.parameters));

  if (!Array.isArray(variables) || variables.length === 0) {
    return items;
  }

  for (const variable of variables) {
    if (!variable || typeof variable !== 'object') continue;

    const varName = variable.name || variable.key || '(unnamed)';

    if (!variable.type || (typeof variable.type === 'string' && variable.type.trim() === '')) {
      items.push(createLintItem('warning', 'VARIABLE_MISSING_TYPE', `Template variable "${varName}" is missing a non-empty type field`));
    }

    if (!variable.description || (typeof variable.description === 'string' && variable.description.trim() === '')) {
      items.push(createLintItem('warning', 'VARIABLE_MISSING_DESC', `Template variable "${varName}" is missing a non-empty description field`));
    }
  }

  return items;
}

/**
 * Check documentation presence.
 * Verifies that README.md exists in packageDir or metadata.description is non-empty.
 * @param {Object} contract - scene-package.json object
 * @param {string} packageDir - Package directory path
 * @param {Object} [fileSystem] - fs-extra compatible file system
 * @returns {Promise<{ items: Array<{ level: string, code: string, message: string }>, hasReadme: boolean }>}
 */
async function checkDocumentation(contract, packageDir, fileSystem) {
  const fs = fileSystem || require('fs-extra');
  const path = require('path');
  const items = [];

  // Check README.md existence
  const readmePath = path.resolve(packageDir, 'README.md');
  const hasReadme = await fs.pathExists(readmePath);

  // Check metadata.description
  const description = contract.metadata && contract.metadata.description;
  const hasDescription = typeof description === 'string' && description.trim() !== '';

  if (hasReadme) {
    items.push(createLintItem('info', 'HAS_README', 'README.md is present'));
  }

  if (hasDescription) {
    items.push(createLintItem('info', 'HAS_DESCRIPTION', 'metadata.description is present'));
  }

  if (!hasReadme && !hasDescription) {
    items.push(createLintItem('warning', 'NO_DOCUMENTATION', 'No README.md found and metadata.description is empty; at least one form of documentation is recommended'));
  }

  return { items, hasReadme };
}

/**
 * Check action abstraction fields on bindings.
 * Validates intent, preconditions, and postconditions when present.
 * @param {Object} contract - Parsed scene-package.json object
 * @returns {Array<{ level: string, code: string, message: string }>}
 */
function checkActionAbstraction(contract) {
  const items = [];
  const bindings = contract && contract.capability_contract && contract.capability_contract.bindings;
  if (!Array.isArray(bindings)) return items;

  for (const binding of bindings) {
    if (!binding || typeof binding !== 'object') continue;
    const ref = binding.ref || '(unknown)';

    // Check EMPTY_INTENT: intent exists and is empty string
    if ('intent' in binding && binding.intent === '') {
      items.push(createLintItem('warning', 'EMPTY_INTENT', `Binding "${ref}" has an empty intent`));
    }

    // Check INVALID_PRECONDITIONS: preconditions exists but is not a string array
    if ('preconditions' in binding) {
      if (!Array.isArray(binding.preconditions) || !binding.preconditions.every(p => typeof p === 'string')) {
        items.push(createLintItem('error', 'INVALID_PRECONDITIONS', `Binding "${ref}" has invalid preconditions (must be a string array)`));
      }
    }

    // Check INVALID_POSTCONDITIONS: postconditions exists but is not a string array
    if ('postconditions' in binding) {
      if (!Array.isArray(binding.postconditions) || !binding.postconditions.every(p => typeof p === 'string')) {
        items.push(createLintItem('error', 'INVALID_POSTCONDITIONS', `Binding "${ref}" has invalid postconditions (must be a string array)`));
      }
    }
  }

  return items;
}

/**
 * Check data lineage consistency.
 * Validates that lineage source/sink refs exist in bindings.
 * @param {Object} contract - Parsed scene-package.json object
 * @returns {Array<{ level: string, code: string, message: string }>}
 */
function checkDataLineage(contract) {
  const items = [];

  // Collect binding refs
  const bindings = contract && contract.capability_contract && contract.capability_contract.bindings;
  const bindingRefs = new Set();
  if (Array.isArray(bindings)) {
    for (const b of bindings) {
      if (b && typeof b.ref === 'string') bindingRefs.add(b.ref);
    }
  }

  // Get data_lineage
  const lineage = contract && contract.governance_contract && contract.governance_contract.data_lineage;
  if (!lineage || typeof lineage !== 'object') return items;

  // Check sources
  if (Array.isArray(lineage.sources)) {
    for (const source of lineage.sources) {
      if (source && typeof source.ref === 'string' && !bindingRefs.has(source.ref)) {
        items.push(createLintItem('warning', 'LINEAGE_SOURCE_NOT_IN_BINDINGS', `Data lineage source ref "${source.ref}" is not found in capability_contract.bindings`));
      }
    }
  }

  // Check sinks
  if (Array.isArray(lineage.sinks)) {
    for (const sink of lineage.sinks) {
      if (sink && typeof sink.ref === 'string' && !bindingRefs.has(sink.ref)) {
        items.push(createLintItem('warning', 'LINEAGE_SINK_NOT_IN_BINDINGS', `Data lineage sink ref "${sink.ref}" is not found in capability_contract.bindings`));
      }
    }
  }

  return items;
}

/**
 * Check agent_hints field validity.
 * Validates summary, complexity, and estimated_duration_ms when present.
 * @param {Object} contract - Parsed scene-package.json object
 * @returns {Array<{ level: string, code: string, message: string }>}
 */
function checkAgentHints(contract) {
  const items = [];
  const hints = contract && contract.agent_hints;
  if (!hints || typeof hints !== 'object') return items;

  // Check EMPTY_AGENT_SUMMARY
  if ('summary' in hints && hints.summary === '') {
    items.push(createLintItem('warning', 'EMPTY_AGENT_SUMMARY', 'agent_hints.summary is empty'));
  }

  // Check INVALID_AGENT_COMPLEXITY
  if ('complexity' in hints) {
    const validComplexity = ['low', 'medium', 'high'];
    if (!validComplexity.includes(hints.complexity)) {
      items.push(createLintItem('error', 'INVALID_AGENT_COMPLEXITY', `agent_hints.complexity "${hints.complexity}" is not valid (must be low, medium, or high)`));
    }
  }

  // Check INVALID_AGENT_DURATION
  if ('estimated_duration_ms' in hints) {
    const val = hints.estimated_duration_ms;
    if (typeof val !== 'number' || !Number.isInteger(val) || val <= 0) {
      items.push(createLintItem('error', 'INVALID_AGENT_DURATION', `agent_hints.estimated_duration_ms must be a positive integer`));
    }
  }

  return items;
}

function normalizeSemanticItems(raw) {
  if (Array.isArray(raw)) {
    return raw.filter(item => item && typeof item === 'object');
  }
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const candidates = raw.items || raw.values || raw.list || raw.nodes;
  if (Array.isArray(candidates)) {
    return candidates.filter(item => item && typeof item === 'object');
  }
  return Object.values(raw).filter(item => item && typeof item === 'object');
}

/**
 * Check ontology semantic coverage and scene governance bridge.
 * Applies to scene-domain-profile packages to ensure ontology entities/relations,
 * business rules, and decision logic are present and propagated to scene manifest.
 * @param {Object} contract - Parsed scene-package.json object
 * @param {Object|null} manifest - Parsed scene.yaml object
 * @returns {Array<{ level: string, code: string, message: string }>}
 */
function checkOntologySemanticCoverage(contract, manifest = null) {
  const items = [];
  if (!contract || typeof contract !== 'object') {
    return items;
  }

  const kind = typeof contract.kind === 'string' ? contract.kind.trim() : '';
  if (kind !== 'scene-domain-profile') {
    return items;
  }

  const ontologyModel = contract.ontology_model && typeof contract.ontology_model === 'object'
    ? contract.ontology_model
    : {};
  const governanceContract = contract.governance_contract && typeof contract.governance_contract === 'object'
    ? contract.governance_contract
    : {};

  const entities = normalizeSemanticItems(ontologyModel.entities);
  const relations = normalizeSemanticItems(ontologyModel.relations);
  const businessRules = normalizeSemanticItems(governanceContract.business_rules);
  const decisionLogic = normalizeSemanticItems(governanceContract.decision_logic);

  if (entities.length === 0) {
    items.push(createLintItem('warning', 'ONTOLOGY_ENTITIES_MISSING', 'ontology_model.entities is empty or missing'));
  }
  if (relations.length === 0) {
    items.push(createLintItem('warning', 'ONTOLOGY_RELATIONS_MISSING', 'ontology_model.relations is empty or missing'));
  }
  if (businessRules.length === 0) {
    items.push(createLintItem('warning', 'ONTOLOGY_BUSINESS_RULES_MISSING', 'governance_contract.business_rules is empty or missing'));
  }
  if (decisionLogic.length === 0) {
    items.push(createLintItem('warning', 'ONTOLOGY_DECISION_LOGIC_MISSING', 'governance_contract.decision_logic is empty or missing'));
  }

  const sceneGovernance = manifest
    && manifest.spec
    && typeof manifest.spec === 'object'
    && manifest.spec.governance_contract
    && typeof manifest.spec.governance_contract === 'object'
    ? manifest.spec.governance_contract
    : null;
  if (!sceneGovernance) {
    items.push(createLintItem('warning', 'SCENE_GOVERNANCE_CONTRACT_MISSING', 'scene.yaml spec.governance_contract is missing for ontology bridge'));
    return items;
  }

  const sceneBusinessRules = normalizeSemanticItems(sceneGovernance.business_rules);
  const sceneDecisionLogic = normalizeSemanticItems(sceneGovernance.decision_logic);
  if (sceneBusinessRules.length === 0) {
    items.push(createLintItem('warning', 'SCENE_GOVERNANCE_RULES_MISSING', 'scene.yaml spec.governance_contract.business_rules is empty or missing'));
  }
  if (sceneDecisionLogic.length === 0) {
    items.push(createLintItem('warning', 'SCENE_GOVERNANCE_DECISIONS_MISSING', 'scene.yaml spec.governance_contract.decision_logic is empty or missing'));
  }

  const packageRuleIds = new Set(
    businessRules
      .map(rule => (typeof rule.id === 'string' ? rule.id.trim() : ''))
      .filter(Boolean)
  );
  const sceneRuleIds = new Set(
    sceneBusinessRules
      .map(rule => (typeof rule.id === 'string' ? rule.id.trim() : ''))
      .filter(Boolean)
  );
  const missingSceneRules = Array.from(packageRuleIds).filter(ruleId => !sceneRuleIds.has(ruleId));
  if (missingSceneRules.length > 0) {
    items.push(
      createLintItem(
        'warning',
        'SCENE_GOVERNANCE_RULES_UNALIGNED',
        `scene.yaml governance_contract is missing ${missingSceneRules.length} business rule id(s) from scene-package.json`
      )
    );
  }

  const packageDecisionIds = new Set(
    decisionLogic
      .map(item => (typeof item.id === 'string' ? item.id.trim() : ''))
      .filter(Boolean)
  );
  const sceneDecisionIds = new Set(
    sceneDecisionLogic
      .map(item => (typeof item.id === 'string' ? item.id.trim() : ''))
      .filter(Boolean)
  );
  const missingSceneDecisions = Array.from(packageDecisionIds).filter(decisionId => !sceneDecisionIds.has(decisionId));
  if (missingSceneDecisions.length > 0) {
    items.push(
      createLintItem(
        'warning',
        'SCENE_GOVERNANCE_DECISIONS_UNALIGNED',
        `scene.yaml governance_contract is missing ${missingSceneDecisions.length} decision_logic id(s) from scene-package.json`
      )
    );
  }

  return items;
}

/**
 * Execute full template lint checks.
 * Orchestrates all individual checks, reads scene-package.json and scene.yaml,
 * and returns a structured LintResult.
 * @param {string} packageDir - Scene package directory path
 * @param {Object} [options] - { fileSystem }
 * @returns {Promise<LintResult>}
 */
async function lintScenePackage(packageDir, options = {}) {
  const fs = options.fileSystem || require('fs-extra');
  const path = require('path');
  const yaml = require('js-yaml');

  const allItems = [];
  let contract = null;
  let manifest = null;
  let hasReadme = false;
  let contractErrors = [];
  let manifestErrors = [];

  // 1. Read scene-package.json
  try {
    const contractPath = path.resolve(packageDir, 'scene-package.json');
    contract = await fs.readJson(contractPath);
  } catch (err) {
    const errorItem = createLintItem('error', 'MANIFEST_READ_FAILED', `Failed to read scene-package.json: ${err.message}`);
    return {
      valid: false,
      errors: [errorItem],
      warnings: [],
      info: [],
      summary: { error_count: 1, warning_count: 0, info_count: 0, checks_run: 1 },
      _context: {
        contract: null,
        manifest: null,
        hasReadme: false,
        contractErrors: [errorItem],
        manifestErrors: []
      }
    };
  }

  // 2. Read scene.yaml
  try {
    const yamlPath = path.resolve(packageDir, 'scene.yaml');
    const yamlContent = await fs.readFile(yamlPath, 'utf8');
    manifest = yaml.load(yamlContent);
  } catch (err) {
    allItems.push(createLintItem('warning', 'SCENE_YAML_READ_FAILED', `Failed to read scene.yaml: ${err.message}`));
  }

  // 3. Check manifest completeness (scene-package.json)
  contractErrors = checkManifestCompleteness(contract);
  allItems.push(...contractErrors);

  // 4. Check scene.yaml manifest completeness (if loaded)
  if (manifest) {
    manifestErrors = checkSceneManifestCompleteness(manifest);
    allItems.push(...manifestErrors);
  }

  // 5. Check binding ref format on contract (and manifest if available)
  allItems.push(...checkBindingRefFormat(contract));
  if (manifest) {
    allItems.push(...checkBindingRefFormat(manifest));
  }

  // 6. Extract governance and check reasonableness
  const governance =
    (contract.governance) ||
    (contract.spec && contract.spec.governance_contract);
  allItems.push(...checkGovernanceReasonableness(governance));

  // 7. Check package consistency (async)
  allItems.push(...await checkPackageConsistency(contract, packageDir, fs));

  // 8. Check template variables
  allItems.push(...checkTemplateVariables(contract));

  // 9. Check documentation (async)
  const docResult = await checkDocumentation(contract, packageDir, fs);
  allItems.push(...docResult.items);
  hasReadme = docResult.hasReadme;

  // 10. Check action abstraction
  allItems.push(...checkActionAbstraction(contract));

  // 11. Check data lineage
  allItems.push(...checkDataLineage(contract));

  // 12. Check ontology semantic coverage and scene bridge
  allItems.push(...checkOntologySemanticCoverage(contract, manifest));

  // 13. Check agent hints
  allItems.push(...checkAgentHints(contract));

  // Separate items by level
  const errors = allItems.filter(item => item.level === 'error');
  const warnings = allItems.filter(item => item.level === 'warning');
  const info = allItems.filter(item => item.level === 'info');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
    summary: {
      error_count: errors.length,
      warning_count: warnings.length,
      info_count: info.length,
      checks_run: 10
    },
    _context: {
      contract,
      manifest,
      hasReadme,
      contractErrors,
      manifestErrors
    }
  };
}

// ─── Score Calculator Functions ────────────────────────────────────

/**
 * Calculate contract validity dimension score (max 30 points).
 * Awards 15 points for zero package contract errors and 15 points for zero manifest errors.
 * @param {Object} lintResult - LintResult from lintScenePackage
 * @returns {{ score: number, details: Object }}
 */
function scoreContractValidity(lintResult) {
  const ctx = lintResult._context || {};
  const contractErrors = ctx.contractErrors || [];
  const manifestErrors = ctx.manifestErrors || [];

  const packageContract = contractErrors.length === 0 ? 15 : 0;
  const sceneManifest = manifestErrors.length === 0 ? 15 : 0;

  return {
    score: packageContract + sceneManifest,
    details: {
      package_contract: packageContract,
      scene_manifest: sceneManifest
    }
  };
}

/**
 * Calculate lint pass rate dimension score (max 30 points).
 * Formula: max(0, 30 - 10 * errors - 3 * warnings)
 * @param {Object} lintResult - LintResult from lintScenePackage
 * @returns {{ score: number, details: Object }}
 */
function scoreLintPassRate(lintResult) {
  const errorCount = (lintResult.errors || []).length;
  const warningCount = (lintResult.warnings || []).length;

  const errorDeductions = 10 * errorCount;
  const warningDeductions = 3 * warningCount;
  const score = Math.max(0, 30 - errorDeductions - warningDeductions);

  return {
    score,
    details: {
      error_deductions: errorDeductions,
      warning_deductions: warningDeductions
    }
  };
}

/**
 * Calculate documentation quality dimension score (max 20 points).
 * Awards 10 for README, 5 for description, 5 for all variables having descriptions.
 * @param {Object} lintResult - LintResult from lintScenePackage
 * @returns {{ score: number, details: Object }}
 */
function scoreDocumentationQuality(lintResult) {
  const ctx = lintResult._context || {};

  // 10 points for README presence
  const readmePresent = ctx.hasReadme ? 10 : 0;

  // 5 points for metadata.description present
  const contract = ctx.contract || {};
  const description = contract.metadata && contract.metadata.description;
  const descriptionPresent = (typeof description === 'string' && description.trim() !== '') ? 5 : 0;

  // 5 points for all variables having descriptions (no VARIABLE_MISSING_DESC warnings)
  const warnings = lintResult.warnings || [];
  const hasMissingDesc = warnings.some(w => w.code === 'VARIABLE_MISSING_DESC');
  const variableDescriptions = hasMissingDesc ? 0 : 5;

  return {
    score: readmePresent + descriptionPresent + variableDescriptions,
    details: {
      readme_present: readmePresent,
      description_present: descriptionPresent,
      variable_descriptions: variableDescriptions
    }
  };
}

/**
 * Calculate governance completeness dimension score (max 20 points).
 * Awards 5 points each for risk_level, approval, idempotency, rollback_supported being set.
 * @param {Object} lintResult - LintResult from lintScenePackage
 * @returns {{ score: number, details: Object }}
 */
function scoreGovernanceCompleteness(lintResult) {
  const ctx = lintResult._context || {};
  const contract = ctx.contract || {};
  const governance = contract.governance || (contract.spec && contract.spec.governance_contract) || {};

  // 5 points for valid risk_level
  const riskLevel = (governance.risk_level && VALID_RISK_LEVELS.includes(governance.risk_level)) ? 5 : 0;

  // 5 points for approval.required being boolean
  const approval = (governance.approval && typeof governance.approval.required === 'boolean') ? 5 : 0;

  // 5 points for idempotency.required being boolean
  const idempotency = (governance.idempotency && typeof governance.idempotency.required === 'boolean') ? 5 : 0;

  // 5 points for rollback_supported being boolean
  const rollback = (typeof governance.rollback_supported === 'boolean') ? 5 : 0;

  return {
    score: riskLevel + approval + idempotency + rollback,
    details: {
      risk_level: riskLevel,
      approval,
      idempotency,
      rollback
    }
  };
}

/**
 * Score agent readiness based on agent_hints in the contract.
 * Optional bonus dimension (max 10 points):
 *   - summary non-empty string: +4
 *   - complexity valid (low/medium/high): +3
 *   - suggested_sequence non-empty array: +3
 * Returns 0 when agent_hints doesn't exist.
 * @param {Object} lintResult - LintResult from lintScenePackage
 * @returns {{ score: number, details: Object }}
 */
function scoreAgentReadiness(lintResult) {
  const ctx = lintResult._context || {};
  const contract = ctx.contract || {};
  const hints = contract.agent_hints;

  if (!hints || typeof hints !== 'object') {
    return { score: 0, details: {} };
  }

  const summary = (typeof hints.summary === 'string' && hints.summary.length > 0) ? 4 : 0;
  const complexity = (['low', 'medium', 'high'].includes(hints.complexity)) ? 3 : 0;
  const suggestedSequence = (Array.isArray(hints.suggested_sequence) && hints.suggested_sequence.length > 0) ? 3 : 0;

  return {
    score: summary + complexity + suggestedSequence,
    details: {
      summary,
      complexity,
      suggested_sequence: suggestedSequence
    }
  };
}

/**
 * Calculate overall quality score based on LintResult.
 * Aggregates four dimensions: contract validity, lint pass rate, documentation quality, governance completeness.
 * Plus optional bonus: agent_readiness (max 10, can exceed 100 base).
 * @param {Object} lintResult - LintResult from lintScenePackage
 * @param {Object} [options] - { threshold: number }
 * @returns {Object} ScoreResult
 */
function calculateQualityScore(lintResult, options = {}) {
  const threshold = typeof options.threshold === 'number' ? options.threshold : 60;

  const contractValidity = scoreContractValidity(lintResult);
  const lintPassRate = scoreLintPassRate(lintResult);
  const documentationQuality = scoreDocumentationQuality(lintResult);
  const governanceCompleteness = scoreGovernanceCompleteness(lintResult);
  const agentReadiness = scoreAgentReadiness(lintResult);

  const score = contractValidity.score + lintPassRate.score + documentationQuality.score + governanceCompleteness.score + agentReadiness.score;

  return {
    score,
    pass: score >= threshold,
    threshold,
    dimensions: {
      contract_validity: {
        score: contractValidity.score,
        max: SCORE_WEIGHTS.contractValidity,
        details: contractValidity.details
      },
      lint_pass_rate: {
        score: lintPassRate.score,
        max: SCORE_WEIGHTS.lintPassRate,
        details: lintPassRate.details
      },
      documentation_quality: {
        score: documentationQuality.score,
        max: SCORE_WEIGHTS.documentationQuality,
        details: documentationQuality.details
      },
      governance_completeness: {
        score: governanceCompleteness.score,
        max: SCORE_WEIGHTS.governanceCompleteness,
        details: governanceCompleteness.details
      },
      agent_readiness: {
        score: agentReadiness.score,
        max: 10,
        details: agentReadiness.details
      }
    }
  };
}

// ─── Module Exports ───────────────────────────────────────────────

module.exports = {
  // Constants
  KNOWN_BINDING_REF_PREFIXES,
  VALID_RISK_LEVELS,
  KEBAB_CASE_PATTERN,
  SEMVER_PATTERN,
  REQUIRED_PACKAGE_FIELDS,
  REQUIRED_MANIFEST_FIELDS,
  SCORE_WEIGHTS,
  // Lint Engine Functions
  createLintItem,
  checkManifestCompleteness,
  checkSceneManifestCompleteness,
  checkBindingRefFormat,
  checkGovernanceReasonableness,
  checkPackageConsistency,
  checkTemplateVariables,
  checkDocumentation,
  checkActionAbstraction,
  checkDataLineage,
  checkOntologySemanticCoverage,
  checkAgentHints,
  lintScenePackage,
  // Score Calculator Functions
  scoreContractValidity,
  scoreLintPassRate,
  scoreDocumentationQuality,
  scoreGovernanceCompleteness,
  scoreAgentReadiness,
  calculateQualityScore
};
