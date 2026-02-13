const DEFAULT_GATE_POLICY = {
  version: 1,
  thresholds: {
    go: 90,
    conditional_go: 70
  },
  strict_mode: {
    warning_as_failure: true
  },
  rules: {
    mandatory: { enabled: true, weight: 30, hard_fail: true },
    tests: { enabled: true, weight: 25, hard_fail: true },
    docs: { enabled: true, weight: 15, hard_fail: false },
    config_consistency: { enabled: true, weight: 15, hard_fail: false },
    traceability: { enabled: true, weight: 15, hard_fail: false }
  }
};

module.exports = {
  DEFAULT_GATE_POLICY
};

