const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

const ALLOWED_DOMAINS = new Set(['erp', 'robot', 'hybrid']);
const ALLOWED_RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical']);

class SceneLoader {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
  }

  async loadFromSpec(specName, relativePath = 'custom/scene.yaml') {
    const filePath = path.join(this.projectPath, '.kiro', 'specs', specName, relativePath);
    return this.loadFromFile(filePath);
  }

  async loadFromFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const manifest = this.parseManifest(content, filePath);
    const validation = this.validateManifest(manifest);

    if (!validation.valid) {
      const error = new Error(`Invalid scene manifest: ${validation.errors.join('; ')}`);
      error.validationErrors = validation.errors;
      throw error;
    }

    return manifest;
  }

  parseManifest(content, filePath = '') {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.json') {
      return JSON.parse(content);
    }

    return yaml.load(content);
  }

  validateManifest(manifest) {
    const errors = [];

    if (!manifest || typeof manifest !== 'object') {
      return { valid: false, errors: ['manifest must be an object'] };
    }

    if (typeof manifest.apiVersion !== 'string' || !manifest.apiVersion.startsWith('kse.scene/')) {
      errors.push('apiVersion must start with kse.scene/');
    }

    if (manifest.kind !== 'scene') {
      errors.push('kind must be scene');
    }

    const metadata = manifest.metadata || {};
    const spec = manifest.spec || {};
    const intent = spec.intent || {};
    const capabilityContract = spec.capability_contract || {};
    const governanceContract = spec.governance_contract || {};

    if (!metadata.obj_id || typeof metadata.obj_id !== 'string') {
      errors.push('metadata.obj_id is required');
    }

    if (!metadata.obj_version || typeof metadata.obj_version !== 'string') {
      errors.push('metadata.obj_version is required');
    }

    if (!metadata.title || typeof metadata.title !== 'string') {
      errors.push('metadata.title is required');
    }

    const domain = spec.domain || 'erp';
    if (!ALLOWED_DOMAINS.has(domain)) {
      errors.push(`spec.domain must be one of ${Array.from(ALLOWED_DOMAINS).join(', ')}`);
    }

    if (!intent.goal || typeof intent.goal !== 'string') {
      errors.push('spec.intent.goal is required');
    }

    if (!Array.isArray(capabilityContract.bindings) || capabilityContract.bindings.length === 0) {
      errors.push('spec.capability_contract.bindings must be a non-empty array');
    }

    if (governanceContract.risk_level && !ALLOWED_RISK_LEVELS.has(governanceContract.risk_level)) {
      errors.push(`spec.governance_contract.risk_level must be one of ${Array.from(ALLOWED_RISK_LEVELS).join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }
}

module.exports = SceneLoader;
