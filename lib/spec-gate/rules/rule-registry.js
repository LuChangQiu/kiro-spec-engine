class RuleRegistry {
  constructor(initialRules = []) {
    this.rules = new Map();
    initialRules.forEach(rule => this.register(rule));
  }

  register(rule) {
    if (!rule || !rule.id || typeof rule.execute !== 'function') {
      throw new Error('Invalid gate rule: expected id and execute()');
    }

    this.rules.set(rule.id, rule);
  }

  setEnabled(ruleId, enabled) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    rule.enabled = !!enabled;
  }

  get(ruleId) {
    return this.rules.get(ruleId);
  }

  list() {
    return Array.from(this.rules.values());
  }

  listEnabled(policyRules = {}) {
    return this.list().filter(rule => {
      const policy = policyRules[rule.id];
      if (!policy) {
        return false;
      }

      if (typeof rule.enabled === 'boolean') {
        return rule.enabled;
      }

      return policy.enabled !== false;
    });
  }
}

module.exports = {
  RuleRegistry
};

