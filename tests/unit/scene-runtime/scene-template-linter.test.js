'use strict';

const {
  checkActionAbstraction,
  checkDataLineage,
  checkOntologySemanticCoverage,
  checkAgentHints,
  scoreAgentReadiness,
  calculateQualityScore
} = require('../../../lib/scene-runtime/scene-template-linter');

// ─── checkActionAbstraction ───────────────────────────────────────

describe('checkActionAbstraction', () => {
  test('returns empty array when no bindings', () => {
    expect(checkActionAbstraction({})).toEqual([]);
    expect(checkActionAbstraction({ capability_contract: {} })).toEqual([]);
    expect(checkActionAbstraction({ capability_contract: { bindings: [] } })).toEqual([]);
  });

  test('returns empty array when bindings have no action fields', () => {
    const contract = {
      capability_contract: {
        bindings: [
          { ref: 'a.b.list', type: 'query' },
          { ref: 'a.b.update', type: 'mutation' }
        ]
      }
    };
    expect(checkActionAbstraction(contract)).toEqual([]);
  });

  test('EMPTY_INTENT warning when intent is empty string', () => {
    const contract = {
      capability_contract: {
        bindings: [{ ref: 'a.b.list', intent: '' }]
      }
    };
    const items = checkActionAbstraction(contract);
    expect(items).toHaveLength(1);
    expect(items[0].level).toBe('warning');
    expect(items[0].code).toBe('EMPTY_INTENT');
  });

  test('no warning when intent is non-empty', () => {
    const contract = {
      capability_contract: {
        bindings: [{ ref: 'a.b.list', intent: 'Fetch orders' }]
      }
    };
    expect(checkActionAbstraction(contract)).toEqual([]);
  });

  test('INVALID_PRECONDITIONS error when preconditions is not an array', () => {
    const contract = {
      capability_contract: {
        bindings: [{ ref: 'x.y', preconditions: 'not-array' }]
      }
    };
    const items = checkActionAbstraction(contract);
    expect(items).toHaveLength(1);
    expect(items[0].level).toBe('error');
    expect(items[0].code).toBe('INVALID_PRECONDITIONS');
  });

  test('INVALID_PRECONDITIONS error when preconditions contains non-strings', () => {
    const contract = {
      capability_contract: {
        bindings: [{ ref: 'x.y', preconditions: ['valid', 123] }]
      }
    };
    const items = checkActionAbstraction(contract);
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe('INVALID_PRECONDITIONS');
  });

  test('no error when preconditions is valid string array', () => {
    const contract = {
      capability_contract: {
        bindings: [{ ref: 'x.y', preconditions: ['user.isAdmin()'] }]
      }
    };
    expect(checkActionAbstraction(contract)).toEqual([]);
  });

  test('INVALID_POSTCONDITIONS error when postconditions is not an array', () => {
    const contract = {
      capability_contract: {
        bindings: [{ ref: 'x.y', postconditions: 42 }]
      }
    };
    const items = checkActionAbstraction(contract);
    expect(items).toHaveLength(1);
    expect(items[0].level).toBe('error');
    expect(items[0].code).toBe('INVALID_POSTCONDITIONS');
  });

  test('INVALID_POSTCONDITIONS error when postconditions contains non-strings', () => {
    const contract = {
      capability_contract: {
        bindings: [{ ref: 'x.y', postconditions: [null] }]
      }
    };
    const items = checkActionAbstraction(contract);
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe('INVALID_POSTCONDITIONS');
  });

  test('no error when postconditions is valid string array', () => {
    const contract = {
      capability_contract: {
        bindings: [{ ref: 'x.y', postconditions: ['result.length >= 0'] }]
      }
    };
    expect(checkActionAbstraction(contract)).toEqual([]);
  });

  test('multiple issues across multiple bindings', () => {
    const contract = {
      capability_contract: {
        bindings: [
          { ref: 'a', intent: '', preconditions: 'bad' },
          { ref: 'b', postconditions: [1, 2] }
        ]
      }
    };
    const items = checkActionAbstraction(contract);
    expect(items).toHaveLength(3);
    const codes = items.map(i => i.code);
    expect(codes).toContain('EMPTY_INTENT');
    expect(codes).toContain('INVALID_PRECONDITIONS');
    expect(codes).toContain('INVALID_POSTCONDITIONS');
  });
});

// ─── checkDataLineage ─────────────────────────────────────────────

describe('checkDataLineage', () => {
  test('returns empty array when no governance_contract', () => {
    expect(checkDataLineage({})).toEqual([]);
    expect(checkDataLineage({ governance_contract: {} })).toEqual([]);
  });

  test('returns empty array when lineage refs match bindings', () => {
    const contract = {
      capability_contract: {
        bindings: [
          { ref: 'moqui.Order.list' },
          { ref: 'moqui.Order.create' }
        ]
      },
      governance_contract: {
        data_lineage: {
          sources: [{ ref: 'moqui.Order.list', fields: ['orderId'] }],
          sinks: [{ ref: 'moqui.Order.create', fields: ['orderId'] }]
        }
      }
    };
    expect(checkDataLineage(contract)).toEqual([]);
  });

  test('LINEAGE_SOURCE_NOT_IN_BINDINGS when source ref missing', () => {
    const contract = {
      capability_contract: { bindings: [{ ref: 'a.b' }] },
      governance_contract: {
        data_lineage: {
          sources: [{ ref: 'unknown.ref', fields: ['x'] }]
        }
      }
    };
    const items = checkDataLineage(contract);
    expect(items).toHaveLength(1);
    expect(items[0].level).toBe('warning');
    expect(items[0].code).toBe('LINEAGE_SOURCE_NOT_IN_BINDINGS');
  });

  test('LINEAGE_SINK_NOT_IN_BINDINGS when sink ref missing', () => {
    const contract = {
      capability_contract: { bindings: [{ ref: 'a.b' }] },
      governance_contract: {
        data_lineage: {
          sinks: [{ ref: 'missing.sink', fields: ['y'] }]
        }
      }
    };
    const items = checkDataLineage(contract);
    expect(items).toHaveLength(1);
    expect(items[0].level).toBe('warning');
    expect(items[0].code).toBe('LINEAGE_SINK_NOT_IN_BINDINGS');
  });

  test('multiple warnings for multiple missing refs', () => {
    const contract = {
      capability_contract: { bindings: [] },
      governance_contract: {
        data_lineage: {
          sources: [{ ref: 's1', fields: [] }, { ref: 's2', fields: [] }],
          sinks: [{ ref: 'k1', fields: [] }]
        }
      }
    };
    const items = checkDataLineage(contract);
    expect(items).toHaveLength(3);
    expect(items.filter(i => i.code === 'LINEAGE_SOURCE_NOT_IN_BINDINGS')).toHaveLength(2);
    expect(items.filter(i => i.code === 'LINEAGE_SINK_NOT_IN_BINDINGS')).toHaveLength(1);
  });
});

// ─── checkOntologySemanticCoverage ────────────────────────────────

describe('checkOntologySemanticCoverage', () => {
  test('returns empty array for non scene-domain-profile package', () => {
    const contract = { kind: 'scene-capability' };
    expect(checkOntologySemanticCoverage(contract, null)).toEqual([]);
  });

  test('returns warnings when ontology model and scene bridge are missing', () => {
    const contract = {
      kind: 'scene-domain-profile',
      governance_contract: {}
    };
    const items = checkOntologySemanticCoverage(contract, null);
    const codes = items.map(item => item.code);
    expect(codes).toContain('ONTOLOGY_ENTITIES_MISSING');
    expect(codes).toContain('ONTOLOGY_RELATIONS_MISSING');
    expect(codes).toContain('ONTOLOGY_BUSINESS_RULES_MISSING');
    expect(codes).toContain('ONTOLOGY_DECISION_LOGIC_MISSING');
    expect(codes).toContain('SCENE_GOVERNANCE_CONTRACT_MISSING');
  });

  test('returns warnings when scene governance does not carry package rules and decisions', () => {
    const contract = {
      kind: 'scene-domain-profile',
      ontology_model: {
        entities: [{ id: 'order_header' }],
        relations: [{ source: 'order_header', target: 'order_item', type: 'composes' }]
      },
      governance_contract: {
        business_rules: [{ id: 'rule.order.read-allowed' }],
        decision_logic: [{ id: 'decision.order.empty-result' }]
      }
    };
    const manifest = {
      spec: {
        governance_contract: {
          business_rules: [],
          decision_logic: []
        }
      }
    };
    const items = checkOntologySemanticCoverage(contract, manifest);
    const codes = items.map(item => item.code);
    expect(codes).toContain('SCENE_GOVERNANCE_RULES_MISSING');
    expect(codes).toContain('SCENE_GOVERNANCE_DECISIONS_MISSING');
    expect(codes).toContain('SCENE_GOVERNANCE_RULES_UNALIGNED');
    expect(codes).toContain('SCENE_GOVERNANCE_DECISIONS_UNALIGNED');
  });

  test('returns empty array when ontology and scene bridge are aligned', () => {
    const contract = {
      kind: 'scene-domain-profile',
      ontology_model: {
        entities: [{ id: 'order_header' }],
        relations: [{ source: 'order_header', target: 'order_item', type: 'composes' }]
      },
      governance_contract: {
        business_rules: [{ id: 'rule.order.read-allowed' }],
        decision_logic: [{ id: 'decision.order.empty-result' }]
      }
    };
    const manifest = {
      spec: {
        governance_contract: {
          business_rules: [{ id: 'rule.order.read-allowed' }],
          decision_logic: [{ id: 'decision.order.empty-result' }]
        }
      }
    };
    expect(checkOntologySemanticCoverage(contract, manifest)).toEqual([]);
  });
});

// ─── checkAgentHints ──────────────────────────────────────────────

describe('checkAgentHints', () => {
  test('returns empty array when no agent_hints', () => {
    expect(checkAgentHints({})).toEqual([]);
    expect(checkAgentHints({ agent_hints: null })).toEqual([]);
  });

  test('returns empty array when agent_hints has valid fields', () => {
    const contract = {
      agent_hints: {
        summary: 'Order workflow',
        complexity: 'medium',
        estimated_duration_ms: 5000
      }
    };
    expect(checkAgentHints(contract)).toEqual([]);
  });

  test('EMPTY_AGENT_SUMMARY warning when summary is empty string', () => {
    const contract = { agent_hints: { summary: '' } };
    const items = checkAgentHints(contract);
    expect(items).toHaveLength(1);
    expect(items[0].level).toBe('warning');
    expect(items[0].code).toBe('EMPTY_AGENT_SUMMARY');
  });

  test('no warning when summary field is absent', () => {
    const contract = { agent_hints: { complexity: 'low' } };
    expect(checkAgentHints(contract)).toEqual([]);
  });

  test('INVALID_AGENT_COMPLEXITY error for invalid complexity', () => {
    const contract = { agent_hints: { complexity: 'extreme' } };
    const items = checkAgentHints(contract);
    expect(items).toHaveLength(1);
    expect(items[0].level).toBe('error');
    expect(items[0].code).toBe('INVALID_AGENT_COMPLEXITY');
  });

  test('no error for valid complexity values', () => {
    for (const val of ['low', 'medium', 'high']) {
      expect(checkAgentHints({ agent_hints: { complexity: val } })).toEqual([]);
    }
  });

  test('INVALID_AGENT_DURATION error for non-number', () => {
    const contract = { agent_hints: { estimated_duration_ms: 'fast' } };
    const items = checkAgentHints(contract);
    expect(items).toHaveLength(1);
    expect(items[0].level).toBe('error');
    expect(items[0].code).toBe('INVALID_AGENT_DURATION');
  });

  test('INVALID_AGENT_DURATION error for negative number', () => {
    const contract = { agent_hints: { estimated_duration_ms: -100 } };
    const items = checkAgentHints(contract);
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe('INVALID_AGENT_DURATION');
  });

  test('INVALID_AGENT_DURATION error for zero', () => {
    const contract = { agent_hints: { estimated_duration_ms: 0 } };
    const items = checkAgentHints(contract);
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe('INVALID_AGENT_DURATION');
  });

  test('INVALID_AGENT_DURATION error for float', () => {
    const contract = { agent_hints: { estimated_duration_ms: 3.14 } };
    const items = checkAgentHints(contract);
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe('INVALID_AGENT_DURATION');
  });

  test('no error when estimated_duration_ms is absent', () => {
    const contract = { agent_hints: { summary: 'test' } };
    expect(checkAgentHints(contract)).toEqual([]);
  });

  test('multiple issues at once', () => {
    const contract = {
      agent_hints: {
        summary: '',
        complexity: 'invalid',
        estimated_duration_ms: -5
      }
    };
    const items = checkAgentHints(contract);
    expect(items).toHaveLength(3);
    const codes = items.map(i => i.code);
    expect(codes).toContain('EMPTY_AGENT_SUMMARY');
    expect(codes).toContain('INVALID_AGENT_COMPLEXITY');
    expect(codes).toContain('INVALID_AGENT_DURATION');
  });
});


// ─── scoreAgentReadiness ──────────────────────────────────────────

describe('scoreAgentReadiness', () => {
  test('returns score 0 with empty details when agent_hints not present', () => {
    const lintResult = { _context: { contract: {} } };
    const result = scoreAgentReadiness(lintResult);
    expect(result.score).toBe(0);
    expect(result.details).toEqual({});
  });

  test('returns score 0 when _context is missing', () => {
    const result = scoreAgentReadiness({});
    expect(result.score).toBe(0);
    expect(result.details).toEqual({});
  });

  test('returns score 0 when agent_hints is null', () => {
    const lintResult = { _context: { contract: { agent_hints: null } } };
    expect(scoreAgentReadiness(lintResult).score).toBe(0);
  });

  test('returns max score 10 when all fields are valid', () => {
    const lintResult = {
      _context: {
        contract: {
          agent_hints: {
            summary: 'Order approval workflow',
            complexity: 'medium',
            suggested_sequence: ['step1', 'step2']
          }
        }
      }
    };
    const result = scoreAgentReadiness(lintResult);
    expect(result.score).toBe(10);
    expect(result.details.summary).toBe(4);
    expect(result.details.complexity).toBe(3);
    expect(result.details.suggested_sequence).toBe(3);
  });

  test('summary non-empty gives +4', () => {
    const lintResult = {
      _context: { contract: { agent_hints: { summary: 'test' } } }
    };
    const result = scoreAgentReadiness(lintResult);
    expect(result.score).toBe(4);
    expect(result.details.summary).toBe(4);
  });

  test('summary empty string gives 0', () => {
    const lintResult = {
      _context: { contract: { agent_hints: { summary: '' } } }
    };
    expect(scoreAgentReadiness(lintResult).details.summary).toBe(0);
  });

  test('complexity valid gives +3', () => {
    for (const val of ['low', 'medium', 'high']) {
      const lintResult = {
        _context: { contract: { agent_hints: { complexity: val } } }
      };
      expect(scoreAgentReadiness(lintResult).details.complexity).toBe(3);
    }
  });

  test('complexity invalid gives 0', () => {
    const lintResult = {
      _context: { contract: { agent_hints: { complexity: 'extreme' } } }
    };
    expect(scoreAgentReadiness(lintResult).details.complexity).toBe(0);
  });

  test('suggested_sequence non-empty array gives +3', () => {
    const lintResult = {
      _context: { contract: { agent_hints: { suggested_sequence: ['a'] } } }
    };
    expect(scoreAgentReadiness(lintResult).details.suggested_sequence).toBe(3);
  });

  test('suggested_sequence empty array gives 0', () => {
    const lintResult = {
      _context: { contract: { agent_hints: { suggested_sequence: [] } } }
    };
    expect(scoreAgentReadiness(lintResult).details.suggested_sequence).toBe(0);
  });

  test('suggested_sequence not an array gives 0', () => {
    const lintResult = {
      _context: { contract: { agent_hints: { suggested_sequence: 'not-array' } } }
    };
    expect(scoreAgentReadiness(lintResult).details.suggested_sequence).toBe(0);
  });

  test('partial fields: summary + complexity only = 7', () => {
    const lintResult = {
      _context: {
        contract: {
          agent_hints: { summary: 'workflow', complexity: 'high' }
        }
      }
    };
    expect(scoreAgentReadiness(lintResult).score).toBe(7);
  });
});

// ─── calculateQualityScore agent_readiness integration ────────────

describe('calculateQualityScore agent_readiness dimension', () => {
  const baseLintResult = {
    items: [],
    error: [],
    warning: [],
    info: [],
    summary: { error_count: 0, warning_count: 0, info_count: 0, checks_run: 10 },
    _context: {
      contract: {
        metadata: { name: 'test-pkg', version: '1.0.0', description: 'Test' },
        capabilities: { read: [], write: [] },
        governance: {
          risk_level: 'low',
          approval: { required: true },
          idempotency: { required: true },
          rollback_supported: true
        }
      },
      manifest: {
        apiVersion: 'kse.scene.manifest/v0.1',
        kind: 'SceneManifest',
        metadata: { name: 'test', version: '1.0.0' },
        spec: {}
      },
      contractErrors: [],
      manifestErrors: [],
      hasReadme: true
    }
  };

  test('includes agent_readiness dimension in result', () => {
    const result = calculateQualityScore(baseLintResult);
    expect(result.dimensions).toHaveProperty('agent_readiness');
    expect(result.dimensions.agent_readiness.max).toBe(10);
  });

  test('agent_readiness score is 0 when no agent_hints', () => {
    const result = calculateQualityScore(baseLintResult);
    expect(result.dimensions.agent_readiness.score).toBe(0);
  });

  test('agent_readiness bonus adds to total score', () => {
    const withHints = JSON.parse(JSON.stringify(baseLintResult));
    withHints._context.contract.agent_hints = {
      summary: 'Order workflow',
      complexity: 'medium',
      suggested_sequence: ['step1']
    };
    const withoutHints = calculateQualityScore(baseLintResult);
    const withHintsResult = calculateQualityScore(withHints);
    expect(withHintsResult.score).toBe(withoutHints.score + 10);
    expect(withHintsResult.dimensions.agent_readiness.score).toBe(10);
  });

  test('total score can exceed 100 with agent_readiness bonus', () => {
    const perfect = JSON.parse(JSON.stringify(baseLintResult));
    perfect._context.contract.agent_hints = {
      summary: 'Full workflow',
      complexity: 'high',
      suggested_sequence: ['a', 'b']
    };
    const result = calculateQualityScore(perfect);
    // Base max is 100, bonus adds up to 10
    expect(result.dimensions.agent_readiness.score).toBe(10);
    // Total includes the bonus
    expect(result.score).toBeGreaterThan(0);
  });
});
