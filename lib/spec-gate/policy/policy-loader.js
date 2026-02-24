const fs = require('fs-extra');
const path = require('path');
const { DEFAULT_GATE_POLICY } = require('./default-policy');

class PolicyLoader {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
  }

  async load(options = {}) {
    const policyPath = this._resolvePolicyPath(options.policy);
    if (!policyPath) {
      return this._applyStrictMode(this._clone(DEFAULT_GATE_POLICY), options.strict);
    }

    const userPolicy = await fs.readJson(policyPath);
    this._validatePolicy(userPolicy, policyPath);

    const merged = this._deepMerge(this._clone(DEFAULT_GATE_POLICY), userPolicy);
    return this._applyStrictMode(merged, options.strict);
  }

  getTemplate() {
    return this._clone(DEFAULT_GATE_POLICY);
  }

  _resolvePolicyPath(explicitPath) {
    if (explicitPath) {
      return path.isAbsolute(explicitPath)
        ? explicitPath
        : path.join(this.projectPath, explicitPath);
    }

    const projectPolicy = path.join(this.projectPath, '.sce', 'config', 'spec-gate-policy.json');
    if (fs.existsSync(projectPolicy)) {
      return projectPolicy;
    }

    return null;
  }

  _applyStrictMode(policy, strict) {
    if (!strict) {
      return policy;
    }

    return {
      ...policy,
      strict_mode: {
        ...policy.strict_mode,
        warning_as_failure: true
      }
    };
  }

  _validatePolicy(policy, sourcePath) {
    if (!policy || typeof policy !== 'object') {
      throw new Error(`Invalid gate policy at ${sourcePath}: expected JSON object`);
    }

    if (!policy.rules || typeof policy.rules !== 'object') {
      throw new Error(`Invalid gate policy at ${sourcePath}: missing rules object`);
    }

    if (policy.thresholds) {
      const { go, conditional_go: conditionalGo } = policy.thresholds;
      if ((go !== undefined && typeof go !== 'number') ||
          (conditionalGo !== undefined && typeof conditionalGo !== 'number')) {
        throw new Error(`Invalid gate policy at ${sourcePath}: thresholds must be numeric`);
      }
    }
  }

  _clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  _deepMerge(base, override) {
    const result = { ...base };

    Object.keys(override || {}).forEach(key => {
      const baseValue = result[key];
      const overrideValue = override[key];

      if (this._isPlainObject(baseValue) && this._isPlainObject(overrideValue)) {
        result[key] = this._deepMerge(baseValue, overrideValue);
      } else {
        result[key] = overrideValue;
      }
    });

    return result;
  }

  _isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }
}

module.exports = {
  PolicyLoader
};

