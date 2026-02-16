'use strict';

const { OntologyGraph, VALID_RELATION_TYPES } = require('../../../lib/scene-runtime/scene-ontology');

describe('OntologyGraph', () => {
  describe('VALID_RELATION_TYPES', () => {
    test('exports correct relation types', () => {
      expect(VALID_RELATION_TYPES).toEqual(['depends_on', 'composes', 'extends', 'produces']);
    });
  });

  describe('addNode / getNode', () => {
    test('adds and retrieves a node with metadata', () => {
      const graph = new OntologyGraph();
      graph.addNode('moqui.Order.list', { type: 'query' });

      const node = graph.getNode('moqui.Order.list');
      expect(node).toEqual({ ref: 'moqui.Order.list', metadata: { type: 'query' } });
    });

    test('adds node with default empty metadata', () => {
      const graph = new OntologyGraph();
      graph.addNode('a.b.c');

      expect(graph.getNode('a.b.c')).toEqual({ ref: 'a.b.c', metadata: {} });
    });

    test('returns null for non-existent node', () => {
      const graph = new OntologyGraph();
      expect(graph.getNode('does.not.exist')).toBeNull();
    });

    test('overwrites node when adding same ref twice', () => {
      const graph = new OntologyGraph();
      graph.addNode('x', { v: 1 });
      graph.addNode('x', { v: 2 });

      expect(graph.getNode('x').metadata).toEqual({ v: 2 });
    });

    test('throws on non-string ref', () => {
      const graph = new OntologyGraph();
      expect(() => graph.addNode(123)).toThrow('non-empty string');
      expect(() => graph.addNode(null)).toThrow('non-empty string');
    });

    test('throws on empty string ref', () => {
      const graph = new OntologyGraph();
      expect(() => graph.addNode('')).toThrow('non-empty string');
    });
  });

  describe('getAllNodes', () => {
    test('returns empty array for empty graph', () => {
      const graph = new OntologyGraph();
      expect(graph.getAllNodes()).toEqual([]);
    });

    test('returns all added nodes', () => {
      const graph = new OntologyGraph();
      graph.addNode('a', { x: 1 });
      graph.addNode('b', { x: 2 });

      const nodes = graph.getAllNodes();
      expect(nodes).toHaveLength(2);
      expect(nodes).toEqual(expect.arrayContaining([
        { ref: 'a', metadata: { x: 1 } },
        { ref: 'b', metadata: { x: 2 } }
      ]));
    });
  });

  describe('addEdge', () => {
    test('adds edge between two existing nodes', () => {
      const graph = new OntologyGraph();
      graph.addNode('a');
      graph.addNode('b');
      graph.addEdge('a', 'b', 'depends_on');

      const edges = graph.getEdges('a');
      expect(edges).toEqual([{ source: 'a', target: 'b', type: 'depends_on' }]);
    });

    test('throws on invalid relation type', () => {
      const graph = new OntologyGraph();
      graph.addNode('a');
      graph.addNode('b');

      expect(() => graph.addEdge('a', 'b', 'invalid_type')).toThrow('Invalid relation type');
      expect(() => graph.addEdge('a', 'b', 'invalid_type')).toThrow('depends_on');
    });

    test('throws when source node does not exist', () => {
      const graph = new OntologyGraph();
      graph.addNode('b');

      expect(() => graph.addEdge('missing', 'b', 'composes')).toThrow('missing');
    });

    test('throws when target node does not exist', () => {
      const graph = new OntologyGraph();
      graph.addNode('a');

      expect(() => graph.addEdge('a', 'missing', 'extends')).toThrow('missing');
    });

    test('throws when both nodes do not exist', () => {
      const graph = new OntologyGraph();

      expect(() => graph.addEdge('x', 'y', 'produces')).toThrow('x');
      expect(() => graph.addEdge('x', 'y', 'produces')).toThrow('y');
    });

    test('accepts all valid relation types', () => {
      const graph = new OntologyGraph();
      graph.addNode('a');
      graph.addNode('b');

      for (const type of VALID_RELATION_TYPES) {
        expect(() => graph.addEdge('a', 'b', type)).not.toThrow();
      }
    });
  });

  describe('getEdges', () => {
    test('returns empty array for node with no edges', () => {
      const graph = new OntologyGraph();
      graph.addNode('a');

      expect(graph.getEdges('a')).toEqual([]);
    });

    test('returns empty array for non-existent node', () => {
      const graph = new OntologyGraph();
      expect(graph.getEdges('nope')).toEqual([]);
    });

    test('returns multiple outgoing edges', () => {
      const graph = new OntologyGraph();
      graph.addNode('a');
      graph.addNode('b');
      graph.addNode('c');
      graph.addEdge('a', 'b', 'depends_on');
      graph.addEdge('a', 'c', 'composes');

      const edges = graph.getEdges('a');
      expect(edges).toHaveLength(2);
      expect(edges[0]).toEqual({ source: 'a', target: 'b', type: 'depends_on' });
      expect(edges[1]).toEqual({ source: 'a', target: 'c', type: 'composes' });
    });

    test('only returns outgoing edges, not incoming', () => {
      const graph = new OntologyGraph();
      graph.addNode('a');
      graph.addNode('b');
      graph.addEdge('a', 'b', 'depends_on');

      expect(graph.getEdges('b')).toEqual([]);
    });
  });

  describe('getAllEdges', () => {
    test('returns empty array for graph with no edges', () => {
      const graph = new OntologyGraph();
      expect(graph.getAllEdges()).toEqual([]);
    });

    test('returns all edges from all nodes', () => {
      const graph = new OntologyGraph();
      graph.addNode('a');
      graph.addNode('b');
      graph.addNode('c');
      graph.addEdge('a', 'b', 'depends_on');
      graph.addEdge('b', 'c', 'produces');

      const edges = graph.getAllEdges();
      expect(edges).toHaveLength(2);
      expect(edges).toEqual(expect.arrayContaining([
        { source: 'a', target: 'b', type: 'depends_on' },
        { source: 'b', target: 'c', type: 'produces' }
      ]));
    });
  });

  describe('toJSON', () => {
    test('serializes empty graph', () => {
      const graph = new OntologyGraph();
      expect(graph.toJSON()).toEqual({ nodes: [], edges: [] });
    });

    test('serializes graph with nodes only', () => {
      const graph = new OntologyGraph();
      graph.addNode('a', { type: 'query' });
      graph.addNode('b', { type: 'mutation' });

      const json = graph.toJSON();
      expect(json.nodes).toHaveLength(2);
      expect(json.nodes).toEqual(expect.arrayContaining([
        { ref: 'a', metadata: { type: 'query' } },
        { ref: 'b', metadata: { type: 'mutation' } }
      ]));
      expect(json.edges).toEqual([]);
    });

    test('serializes graph with nodes and edges', () => {
      const graph = new OntologyGraph();
      graph.addNode('moqui.OrderHeader.list', { type: 'query' });
      graph.addNode('moqui.OrderHeader.update', { type: 'mutation' });
      graph.addEdge('moqui.OrderHeader.update', 'moqui.OrderHeader.list', 'depends_on');

      const json = graph.toJSON();
      expect(json.nodes).toHaveLength(2);
      expect(json.edges).toEqual([
        { source: 'moqui.OrderHeader.update', target: 'moqui.OrderHeader.list', type: 'depends_on' }
      ]);
    });
  });

  describe('fromJSON', () => {
    test('rebuilds empty graph from empty JSON', () => {
      const graph = OntologyGraph.fromJSON({ nodes: [], edges: [] });
      expect(graph.getAllNodes()).toEqual([]);
      expect(graph.getAllEdges()).toEqual([]);
    });

    test('rebuilds graph with nodes only', () => {
      const json = {
        nodes: [
          { ref: 'a', metadata: { type: 'query' } },
          { ref: 'b', metadata: {} }
        ],
        edges: []
      };
      const graph = OntologyGraph.fromJSON(json);
      expect(graph.getNode('a')).toEqual({ ref: 'a', metadata: { type: 'query' } });
      expect(graph.getNode('b')).toEqual({ ref: 'b', metadata: {} });
    });

    test('rebuilds graph with nodes and edges', () => {
      const json = {
        nodes: [
          { ref: 'x', metadata: {} },
          { ref: 'y', metadata: {} }
        ],
        edges: [
          { source: 'x', target: 'y', type: 'composes' }
        ]
      };
      const graph = OntologyGraph.fromJSON(json);
      expect(graph.getEdges('x')).toEqual([{ source: 'x', target: 'y', type: 'composes' }]);
    });

    test('handles null/undefined input gracefully', () => {
      const graph1 = OntologyGraph.fromJSON(null);
      expect(graph1.getAllNodes()).toEqual([]);

      const graph2 = OntologyGraph.fromJSON(undefined);
      expect(graph2.getAllNodes()).toEqual([]);
    });

    test('handles missing metadata in nodes', () => {
      const json = {
        nodes: [{ ref: 'a' }],
        edges: []
      };
      const graph = OntologyGraph.fromJSON(json);
      expect(graph.getNode('a')).toEqual({ ref: 'a', metadata: {} });
    });
  });

  describe('toJSON / fromJSON round-trip', () => {
    test('round-trip preserves empty graph', () => {
      const original = new OntologyGraph();
      const restored = OntologyGraph.fromJSON(original.toJSON());
      expect(restored.getAllNodes()).toEqual(original.getAllNodes());
      expect(restored.getAllEdges()).toEqual(original.getAllEdges());
    });

    test('round-trip preserves nodes and metadata', () => {
      const original = new OntologyGraph();
      original.addNode('moqui.Order.list', { type: 'query', timeout_ms: 2000 });
      original.addNode('moqui.Order.create', { type: 'mutation' });

      const restored = OntologyGraph.fromJSON(original.toJSON());
      expect(restored.getAllNodes()).toEqual(original.getAllNodes());
    });

    test('round-trip preserves edges', () => {
      const original = new OntologyGraph();
      original.addNode('a', { type: 'query' });
      original.addNode('b', { type: 'mutation' });
      original.addNode('c', {});
      original.addEdge('a', 'b', 'depends_on');
      original.addEdge('b', 'c', 'produces');
      original.addEdge('a', 'c', 'composes');

      const restored = OntologyGraph.fromJSON(original.toJSON());
      expect(restored.getAllNodes()).toEqual(original.getAllNodes());
      expect(restored.getAllEdges()).toEqual(original.getAllEdges());
    });

    test('round-trip preserves complex metadata', () => {
      const original = new OntologyGraph();
      original.addNode('ref1', {
        type: 'query',
        intent: 'Fetch orders',
        preconditions: ['user.isAuthenticated()'],
        postconditions: ['result.length >= 0']
      });

      const restored = OntologyGraph.fromJSON(original.toJSON());
      expect(restored.getNode('ref1')).toEqual(original.getNode('ref1'));
    });
  });
});


const { buildOntologyFromManifest } = require('../../../lib/scene-runtime/scene-ontology');

describe('buildOntologyFromManifest', () => {
  // Requirement 2.4: empty/missing bindings → empty graph
  test('returns empty graph when contract has no capability_contract', () => {
    const graph = buildOntologyFromManifest({});
    expect(graph.getAllNodes()).toEqual([]);
    expect(graph.getAllEdges()).toEqual([]);
  });

  test('returns empty graph when bindings is empty array', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: { bindings: [] }
    });
    expect(graph.getAllNodes()).toEqual([]);
    expect(graph.getAllEdges()).toEqual([]);
  });

  test('returns empty graph when bindings is not an array', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: { bindings: 'not-array' }
    });
    expect(graph.getAllNodes()).toEqual([]);
  });

  // Requirement 2.1: create node for each binding ref
  test('creates a node for each binding ref with metadata', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', ref: 'moqui.OrderHeader.list', timeout_ms: 2000 },
          { type: 'mutation', ref: 'moqui.OrderHeader.update', timeout_ms: 3000 }
        ]
      }
    });

    expect(graph.getAllNodes()).toHaveLength(2);

    const node1 = graph.getNode('moqui.OrderHeader.list');
    expect(node1).not.toBeNull();
    expect(node1.metadata.type).toBe('query');
    expect(node1.metadata.timeout_ms).toBe(2000);

    const node2 = graph.getNode('moqui.OrderHeader.update');
    expect(node2).not.toBeNull();
    expect(node2.metadata.type).toBe('mutation');
    expect(node2.metadata.timeout_ms).toBe(3000);
  });

  test('stores action abstraction fields in node metadata', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          {
            type: 'query',
            ref: 'moqui.Order.list',
            timeout_ms: 2000,
            intent: 'Fetch orders',
            preconditions: ['user.isAuthenticated()'],
            postconditions: ['result.length >= 0']
          }
        ]
      }
    });

    const node = graph.getNode('moqui.Order.list');
    expect(node.metadata.intent).toBe('Fetch orders');
    expect(node.metadata.preconditions).toEqual(['user.isAuthenticated()']);
    expect(node.metadata.postconditions).toEqual(['result.length >= 0']);
  });

  test('defaults action fields when not provided', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', ref: 'a.b.c', timeout_ms: 1000 }
        ]
      }
    });

    const node = graph.getNode('a.b.c');
    expect(node.metadata.intent).toBeNull();
    expect(node.metadata.preconditions).toEqual([]);
    expect(node.metadata.postconditions).toEqual([]);
  });

  // Requirement 2.2: shared prefix → composes relationship
  test('infers composes edges for refs sharing a prefix', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', ref: 'moqui.OrderHeader.list', timeout_ms: 2000 },
          { type: 'mutation', ref: 'moqui.OrderHeader.update', timeout_ms: 3000 }
        ]
      }
    });

    const edges1 = graph.getEdges('moqui.OrderHeader.list');
    const edges2 = graph.getEdges('moqui.OrderHeader.update');

    // Bidirectional composes
    expect(edges1).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: 'moqui.OrderHeader.update', type: 'composes' })
    ]));
    expect(edges2).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: 'moqui.OrderHeader.list', type: 'composes' })
    ]));
  });

  test('does not infer composes for refs with different prefixes', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', ref: 'moqui.OrderHeader.list', timeout_ms: 2000 },
          { type: 'query', ref: 'moqui.Product.list', timeout_ms: 2000 }
        ]
      }
    });

    const edges1 = graph.getEdges('moqui.OrderHeader.list');
    const edges2 = graph.getEdges('moqui.Product.list');

    expect(edges1).toEqual([]);
    expect(edges2).toEqual([]);
  });

  test('infers composes for three refs sharing same prefix', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', ref: 'moqui.Order.list', timeout_ms: 1000 },
          { type: 'mutation', ref: 'moqui.Order.create', timeout_ms: 2000 },
          { type: 'mutation', ref: 'moqui.Order.delete', timeout_ms: 2000 }
        ]
      }
    });

    // Each node should have composes edges to the other two
    const edgesList = graph.getEdges('moqui.Order.list').filter(e => e.type === 'composes');
    const edgesCreate = graph.getEdges('moqui.Order.create').filter(e => e.type === 'composes');
    const edgesDelete = graph.getEdges('moqui.Order.delete').filter(e => e.type === 'composes');

    expect(edgesList).toHaveLength(2);
    expect(edgesCreate).toHaveLength(2);
    expect(edgesDelete).toHaveLength(2);
  });

  test('does not infer composes for single-segment refs', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', ref: 'singleRef', timeout_ms: 1000 }
        ]
      }
    });

    expect(graph.getAllEdges()).toEqual([]);
    expect(graph.getAllNodes()).toHaveLength(1);
  });

  // Requirement 2.3: explicit depends_on
  test('creates depends_on edge when binding declares depends_on', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', ref: 'moqui.Auth.validate', timeout_ms: 1000 },
          { type: 'query', ref: 'moqui.Order.list', timeout_ms: 2000, depends_on: 'moqui.Auth.validate' }
        ]
      }
    });

    const edges = graph.getEdges('moqui.Order.list');
    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: 'moqui.Auth.validate', type: 'depends_on' })
    ]));
  });

  test('ignores depends_on when target ref does not exist in bindings', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', ref: 'moqui.Order.list', timeout_ms: 2000, depends_on: 'nonexistent.ref' }
        ]
      }
    });

    const edges = graph.getEdges('moqui.Order.list');
    const dependsOnEdges = edges.filter(e => e.type === 'depends_on');
    expect(dependsOnEdges).toEqual([]);
  });

  // Combined scenario
  test('handles both composes and depends_on in same contract', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', ref: 'moqui.Auth.validate', timeout_ms: 1000 },
          { type: 'query', ref: 'moqui.OrderHeader.list', timeout_ms: 2000, depends_on: 'moqui.Auth.validate' },
          { type: 'mutation', ref: 'moqui.OrderHeader.update', timeout_ms: 3000, depends_on: 'moqui.Auth.validate' }
        ]
      }
    });

    expect(graph.getAllNodes()).toHaveLength(3);

    // composes between OrderHeader.list and OrderHeader.update
    const listEdges = graph.getEdges('moqui.OrderHeader.list');
    expect(listEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: 'moqui.OrderHeader.update', type: 'composes' }),
      expect.objectContaining({ target: 'moqui.Auth.validate', type: 'depends_on' })
    ]));

    const updateEdges = graph.getEdges('moqui.OrderHeader.update');
    expect(updateEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: 'moqui.OrderHeader.list', type: 'composes' }),
      expect.objectContaining({ target: 'moqui.Auth.validate', type: 'depends_on' })
    ]));
  });

  test('skips bindings with missing or invalid ref', () => {
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', timeout_ms: 1000 },           // no ref
          { type: 'query', ref: '', timeout_ms: 1000 },   // empty ref
          { type: 'query', ref: 123, timeout_ms: 1000 },  // non-string ref
          { type: 'query', ref: 'valid.ref', timeout_ms: 1000 }
        ]
      }
    });

    expect(graph.getAllNodes()).toHaveLength(1);
    expect(graph.getNode('valid.ref')).not.toBeNull();
  });
});


const { validateOntology } = require('../../../lib/scene-runtime/scene-ontology');

describe('validateOntology', () => {
  // Requirement 3.5: valid graph returns { valid: true, errors: [] }
  test('returns valid for empty graph', () => {
    const graph = new OntologyGraph();
    const result = validateOntology(graph);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('returns valid for graph with nodes only', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    const result = validateOntology(graph);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('returns valid for graph with valid edges and no depends_on cycles', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'c', 'depends_on');

    const result = validateOntology(graph);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('returns valid for graph with composes cycle (only depends_on cycles matter)', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b', 'composes');
    graph.addEdge('b', 'a', 'composes');

    const result = validateOntology(graph);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  // Requirement 3.1, 3.2: detect dangling edge targets
  test('detects dangling edge target from corrupted fromJSON data', () => {
    // Simulate corrupted data by building via fromJSON with a node that
    // we then conceptually "remove" — we construct the scenario directly
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b', 'depends_on');

    // Simulate corruption: remove node 'b' from internal map
    graph._nodes.delete('b');

    const result = validateOntology(graph);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'DANGLING_EDGE_TARGET',
      message: "Edge target 'b' does not exist as a node",
      details: { source: 'a', target: 'b' }
    });
  });

  test('detects multiple dangling edge targets', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('a', 'c', 'produces');

    // Corrupt: remove both targets
    graph._nodes.delete('b');
    graph._nodes.delete('c');

    const result = validateOntology(graph);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.every(e => e.code === 'DANGLING_EDGE_TARGET')).toBe(true);
    expect(result.errors.map(e => e.details.target).sort()).toEqual(['b', 'c']);
  });

  // Requirement 3.3, 3.4: detect depends_on cycles
  test('detects simple two-node depends_on cycle', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'a', 'depends_on');

    const result = validateOntology(graph);
    expect(result.valid).toBe(false);
    const cycleErrors = result.errors.filter(e => e.code === 'CYCLE_DETECTED');
    expect(cycleErrors.length).toBeGreaterThanOrEqual(1);

    // The cycle path should contain both nodes
    const cycle = cycleErrors[0].details.cycle;
    expect(cycle).toContain('a');
    expect(cycle).toContain('b');
    // Cycle should start and end with same node
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
  });

  test('detects three-node depends_on cycle', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'c', 'depends_on');
    graph.addEdge('c', 'a', 'depends_on');

    const result = validateOntology(graph);
    expect(result.valid).toBe(false);
    const cycleErrors = result.errors.filter(e => e.code === 'CYCLE_DETECTED');
    expect(cycleErrors.length).toBeGreaterThanOrEqual(1);

    const cycle = cycleErrors[0].details.cycle;
    expect(cycle).toContain('a');
    expect(cycle).toContain('b');
    expect(cycle).toContain('c');
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
  });

  test('detects self-loop depends_on cycle', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addEdge('a', 'a', 'depends_on');

    const result = validateOntology(graph);
    expect(result.valid).toBe(false);
    const cycleErrors = result.errors.filter(e => e.code === 'CYCLE_DETECTED');
    expect(cycleErrors.length).toBeGreaterThanOrEqual(1);
    expect(cycleErrors[0].details.cycle).toContain('a');
  });

  // Combined: dangling + cycle
  test('detects both dangling edges and cycles', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'a', 'depends_on');
    graph.addEdge('a', 'c', 'extends');

    // Corrupt: remove node c to create dangling
    graph._nodes.delete('c');

    const result = validateOntology(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'DANGLING_EDGE_TARGET')).toBe(true);
    expect(result.errors.some(e => e.code === 'CYCLE_DETECTED')).toBe(true);
  });

  test('message format matches design spec for CYCLE_DETECTED', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'a', 'depends_on');

    const result = validateOntology(graph);
    const cycleError = result.errors.find(e => e.code === 'CYCLE_DETECTED');
    expect(cycleError.message).toMatch(/Cycle detected in depends_on:/);
    expect(cycleError.message).toContain('→');
  });

  test('does not report cycle for linear depends_on chain', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addNode('d');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'c', 'depends_on');
    graph.addEdge('c', 'd', 'depends_on');

    const result = validateOntology(graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});


const { queryDependencyChain } = require('../../../lib/scene-runtime/scene-ontology');

describe('queryDependencyChain', () => {
  // Requirement 4.2: ref not in graph → error result
  test('returns error when ref does not exist in graph', () => {
    const graph = new OntologyGraph();
    const result = queryDependencyChain(graph, 'nonexistent');
    expect(result).toEqual({
      ref: 'nonexistent',
      chain: [],
      hasCycle: false,
      error: 'Node not found'
    });
  });

  test('returns error for non-existent ref in non-empty graph', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    const result = queryDependencyChain(graph, 'missing');
    expect(result).toEqual({
      ref: 'missing',
      chain: [],
      hasCycle: false,
      error: 'Node not found'
    });
  });

  // Requirement 4.1: direct depends_on dependencies
  test('returns direct depends_on dependency', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b', 'depends_on');

    const result = queryDependencyChain(graph, 'a');
    expect(result.ref).toBe('a');
    expect(result.chain).toEqual(['b']);
    expect(result.hasCycle).toBe(false);
    expect(result.error).toBeUndefined();
  });

  // Requirement 4.1: transitive depends_on dependencies
  test('returns transitive depends_on chain', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addNode('d');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'c', 'depends_on');
    graph.addEdge('c', 'd', 'depends_on');

    const result = queryDependencyChain(graph, 'a');
    expect(result.ref).toBe('a');
    expect(result.chain).toEqual(['b', 'c', 'd']);
    expect(result.hasCycle).toBe(false);
  });

  test('returns empty chain for node with no depends_on edges', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b', 'composes'); // not depends_on

    const result = queryDependencyChain(graph, 'a');
    expect(result.ref).toBe('a');
    expect(result.chain).toEqual([]);
    expect(result.hasCycle).toBe(false);
  });

  test('only follows depends_on edges, ignores other types', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('a', 'c', 'composes');

    const result = queryDependencyChain(graph, 'a');
    expect(result.chain).toEqual(['b']);
    expect(result.chain).not.toContain('c');
  });

  // Requirement 4.3: cycle detection
  test('detects simple two-node cycle and sets hasCycle true', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'a', 'depends_on');

    const result = queryDependencyChain(graph, 'a');
    expect(result.ref).toBe('a');
    expect(result.hasCycle).toBe(true);
    expect(result.chain).toContain('b');
  });

  test('detects three-node cycle', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'c', 'depends_on');
    graph.addEdge('c', 'a', 'depends_on');

    const result = queryDependencyChain(graph, 'a');
    expect(result.hasCycle).toBe(true);
    expect(result.chain).toContain('b');
    expect(result.chain).toContain('c');
  });

  test('detects self-loop cycle', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addEdge('a', 'a', 'depends_on');

    const result = queryDependencyChain(graph, 'a');
    expect(result.hasCycle).toBe(true);
    expect(result.chain).toEqual([]);
  });

  // Diamond dependency (no cycle)
  test('handles diamond dependency without duplication', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addNode('d');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('a', 'c', 'depends_on');
    graph.addEdge('b', 'd', 'depends_on');
    graph.addEdge('c', 'd', 'depends_on');

    const result = queryDependencyChain(graph, 'a');
    expect(result.hasCycle).toBe(false);
    // d should appear only once
    expect(result.chain.filter(r => r === 'd')).toHaveLength(1);
    expect(result.chain).toContain('b');
    expect(result.chain).toContain('c');
    expect(result.chain).toContain('d');
  });

  // Empty graph with single node
  test('returns empty chain for isolated node', () => {
    const graph = new OntologyGraph();
    graph.addNode('lonely');

    const result = queryDependencyChain(graph, 'lonely');
    expect(result).toEqual({ ref: 'lonely', chain: [], hasCycle: false });
  });
});


const { findImpactRadius, findRelationPath } = require('../../../lib/scene-runtime/scene-ontology');

describe('findImpactRadius', () => {
  test('returns error when ref does not exist in graph', () => {
    const graph = new OntologyGraph();
    const result = findImpactRadius(graph, 'missing');
    expect(result.error).toBe('Node not found');
    expect(result.total).toBe(0);
  });

  test('returns reverse depends_on impacted refs transitively', () => {
    const graph = new OntologyGraph();
    graph.addNode('service.checkout');
    graph.addNode('service.pay');
    graph.addNode('service.ship');
    graph.addEdge('service.pay', 'service.checkout', 'depends_on');
    graph.addEdge('service.ship', 'service.pay', 'depends_on');

    const result = findImpactRadius(graph, 'service.checkout');
    expect(result.ref).toBe('service.checkout');
    expect(result.relationTypes).toEqual(['depends_on']);
    expect(result.impacted).toEqual(['service.pay', 'service.ship']);
    expect(result.total).toBe(2);
    expect(result.details[0]).toMatchObject({ ref: 'service.pay', depth: 1, via: 'depends_on', through: 'service.checkout' });
  });

  test('respects maxDepth when provided', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('b', 'a', 'depends_on');
    graph.addEdge('c', 'b', 'depends_on');

    const result = findImpactRadius(graph, 'a', { maxDepth: 1 });
    expect(result.impacted).toEqual(['b']);
    expect(result.total).toBe(1);
  });

  test('supports filtering by relation type', () => {
    const graph = new OntologyGraph();
    graph.addNode('root');
    graph.addNode('mod.a');
    graph.addNode('mod.b');
    graph.addEdge('mod.a', 'root', 'composes');
    graph.addEdge('mod.b', 'root', 'depends_on');

    const result = findImpactRadius(graph, 'root', { relationTypes: ['composes'] });
    expect(result.impacted).toEqual(['mod.a']);
    expect(result.total).toBe(1);
  });

  test('returns error on invalid relation type', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    const result = findImpactRadius(graph, 'a', { relationTypes: ['bad_type'] });
    expect(result.error).toContain('Invalid relation type');
  });
});

describe('findRelationPath', () => {
  test('returns error when source node does not exist', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    const result = findRelationPath(graph, 'missing', 'a');
    expect(result.error).toBe('Source node not found');
    expect(result.found).toBe(false);
  });

  test('returns error when target node does not exist', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    const result = findRelationPath(graph, 'a', 'missing');
    expect(result.error).toBe('Target node not found');
    expect(result.found).toBe(false);
  });

  test('finds shortest directed path by default', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'c', 'depends_on');

    const result = findRelationPath(graph, 'a', 'c');
    expect(result.found).toBe(true);
    expect(result.hops).toBe(2);
    expect(result.nodes).toEqual(['a', 'b', 'c']);
    expect(result.edges).toHaveLength(2);
  });

  test('returns not found for reverse direction in directed mode', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b', 'depends_on');

    const result = findRelationPath(graph, 'b', 'a');
    expect(result.found).toBe(false);
    expect(result.hops).toBeNull();
  });

  test('finds path in undirected mode using incoming edge traversal', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b', 'depends_on');

    const result = findRelationPath(graph, 'b', 'a', { undirected: true });
    expect(result.found).toBe(true);
    expect(result.hops).toBe(1);
    expect(result.edges[0]).toMatchObject({ source: 'b', target: 'a', type: 'depends_on', direction: 'incoming' });
  });

  test('supports relation type filtering', () => {
    const graph = new OntologyGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('a', 'b', 'depends_on');
    graph.addEdge('b', 'c', 'composes');

    const filtered = findRelationPath(graph, 'a', 'c', { relationTypes: ['depends_on'] });
    expect(filtered.found).toBe(false);

    const all = findRelationPath(graph, 'a', 'c', { relationTypes: ['depends_on', 'composes'] });
    expect(all.found).toBe(true);
    expect(all.nodes).toEqual(['a', 'b', 'c']);
  });
});


const { getActionInfo } = require('../../../lib/scene-runtime/scene-ontology');

describe('getActionInfo', () => {
  // Requirement 5.4: ref not in graph → default action info
  test('returns defaults when ref does not exist in graph', () => {
    const graph = new OntologyGraph();
    const result = getActionInfo(graph, 'nonexistent');
    expect(result).toEqual({
      ref: 'nonexistent',
      intent: null,
      preconditions: [],
      postconditions: []
    });
  });

  // Requirement 5.4: node exists but no action fields in metadata
  test('returns defaults when node has no action fields in metadata', () => {
    const graph = new OntologyGraph();
    graph.addNode('a.b.c', { type: 'query', timeout_ms: 2000 });

    const result = getActionInfo(graph, 'a.b.c');
    expect(result).toEqual({
      ref: 'a.b.c',
      intent: null,
      preconditions: [],
      postconditions: []
    });
  });

  // Requirement 5.3: returns stored action fields
  test('returns intent, preconditions, postconditions from metadata', () => {
    const graph = new OntologyGraph();
    graph.addNode('moqui.Order.list', {
      type: 'query',
      intent: 'Fetch all pending orders',
      preconditions: ['user.hasRole("viewer")'],
      postconditions: ['result.length >= 0']
    });

    const result = getActionInfo(graph, 'moqui.Order.list');
    expect(result).toEqual({
      ref: 'moqui.Order.list',
      intent: 'Fetch all pending orders',
      preconditions: ['user.hasRole("viewer")'],
      postconditions: ['result.length >= 0']
    });
  });

  // Requirement 5.1, 5.2: round-trip via buildOntologyFromManifest
  test('round-trip: buildOntologyFromManifest stores action fields retrievable by getActionInfo', () => {
    const { buildOntologyFromManifest } = require('../../../lib/scene-runtime/scene-ontology');
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          {
            type: 'mutation',
            ref: 'moqui.OrderHeader.update',
            timeout_ms: 3000,
            intent: 'Update order status',
            preconditions: ['order.exists()', 'user.hasPermission("write")'],
            postconditions: ['order.status == newStatus']
          }
        ]
      }
    });

    const result = getActionInfo(graph, 'moqui.OrderHeader.update');
    expect(result.ref).toBe('moqui.OrderHeader.update');
    expect(result.intent).toBe('Update order status');
    expect(result.preconditions).toEqual(['order.exists()', 'user.hasPermission("write")']);
    expect(result.postconditions).toEqual(['order.status == newStatus']);
  });

  // Requirement 5.4: binding without action fields → defaults via buildOntologyFromManifest
  test('round-trip: binding without action fields returns defaults', () => {
    const { buildOntologyFromManifest } = require('../../../lib/scene-runtime/scene-ontology');
    const graph = buildOntologyFromManifest({
      capability_contract: {
        bindings: [
          { type: 'query', ref: 'simple.ref', timeout_ms: 1000 }
        ]
      }
    });

    const result = getActionInfo(graph, 'simple.ref');
    expect(result).toEqual({
      ref: 'simple.ref',
      intent: null,
      preconditions: [],
      postconditions: []
    });
  });

  // Edge case: node with empty metadata
  test('returns defaults when node metadata is empty object', () => {
    const graph = new OntologyGraph();
    graph.addNode('empty.meta');

    const result = getActionInfo(graph, 'empty.meta');
    expect(result).toEqual({
      ref: 'empty.meta',
      intent: null,
      preconditions: [],
      postconditions: []
    });
  });

  // Edge case: partial action fields
  test('returns defaults for missing fields when only intent is set', () => {
    const graph = new OntologyGraph();
    graph.addNode('partial', { intent: 'Do something' });

    const result = getActionInfo(graph, 'partial');
    expect(result).toEqual({
      ref: 'partial',
      intent: 'Do something',
      preconditions: [],
      postconditions: []
    });
  });

  // Edge case: non-array preconditions/postconditions in metadata
  test('returns empty arrays when preconditions/postconditions are not arrays', () => {
    const graph = new OntologyGraph();
    graph.addNode('bad.types', {
      intent: 'Test',
      preconditions: 'not-an-array',
      postconditions: 42
    });

    const result = getActionInfo(graph, 'bad.types');
    expect(result.intent).toBe('Test');
    expect(result.preconditions).toEqual([]);
    expect(result.postconditions).toEqual([]);
  });

  // Edge case: non-string intent in metadata
  test('returns null intent when intent is not a string', () => {
    const graph = new OntologyGraph();
    graph.addNode('bad.intent', { intent: 123 });

    const result = getActionInfo(graph, 'bad.intent');
    expect(result.intent).toBeNull();
  });
});


const { parseDataLineage, getLineageInfo } = require('../../../lib/scene-runtime/scene-ontology');

describe('parseDataLineage', () => {
  // Requirement 7.1: parse optional data_lineage field
  test('returns null when contract has no governance_contract', () => {
    expect(parseDataLineage({})).toBeNull();
  });

  test('returns null when governance_contract has no data_lineage', () => {
    expect(parseDataLineage({ governance_contract: {} })).toBeNull();
  });

  test('returns null when data_lineage is not an object', () => {
    expect(parseDataLineage({ governance_contract: { data_lineage: 'invalid' } })).toBeNull();
    expect(parseDataLineage({ governance_contract: { data_lineage: 42 } })).toBeNull();
    expect(parseDataLineage({ governance_contract: { data_lineage: null } })).toBeNull();
  });

  test('parses valid data_lineage with sources, transforms, sinks', () => {
    const contract = {
      governance_contract: {
        data_lineage: {
          sources: [
            { ref: 'moqui.OrderHeader.list', fields: ['orderId', 'statusId'] }
          ],
          transforms: [
            { operation: 'filter', condition: "statusId == 'APPROVED'" }
          ],
          sinks: [
            { ref: 'moqui.OrderItem.create', fields: ['orderId'] }
          ]
        }
      }
    };

    const result = parseDataLineage(contract);
    expect(result).not.toBeNull();
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toEqual({ ref: 'moqui.OrderHeader.list', fields: ['orderId', 'statusId'] });
    expect(result.transforms).toHaveLength(1);
    expect(result.transforms[0]).toEqual({ operation: 'filter', condition: "statusId == 'APPROVED'" });
    expect(result.sinks).toHaveLength(1);
    expect(result.sinks[0]).toEqual({ ref: 'moqui.OrderItem.create', fields: ['orderId'] });
  });

  test('returns empty arrays when data_lineage has no sources/transforms/sinks', () => {
    const result = parseDataLineage({ governance_contract: { data_lineage: {} } });
    expect(result).toEqual({ sources: [], transforms: [], sinks: [] });
  });

  // Requirement 7.2: validate source has ref (string) and fields (string array)
  test('filters out sources missing ref or fields', () => {
    const contract = {
      governance_contract: {
        data_lineage: {
          sources: [
            { ref: 'valid.ref', fields: ['f1'] },
            { fields: ['f2'] },                    // missing ref
            { ref: 'another.ref' },                // missing fields
            { ref: 123, fields: ['f3'] },          // non-string ref
            { ref: 'ok.ref', fields: 'not-array' } // fields not array
          ],
          transforms: [],
          sinks: []
        }
      }
    };

    const result = parseDataLineage(contract);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].ref).toBe('valid.ref');
  });

  // Requirement 7.3: validate transform has operation (string)
  test('filters out transforms missing operation', () => {
    const contract = {
      governance_contract: {
        data_lineage: {
          sources: [],
          transforms: [
            { operation: 'filter', condition: 'x > 0' },
            { condition: 'y > 0' },                  // missing operation
            { operation: 123 },                       // non-string operation
            null                                      // null entry
          ],
          sinks: []
        }
      }
    };

    const result = parseDataLineage(contract);
    expect(result.transforms).toHaveLength(1);
    expect(result.transforms[0].operation).toBe('filter');
  });

  // Requirement 7.4: validate sink has ref (string) and fields (string array)
  test('filters out sinks missing ref or fields', () => {
    const contract = {
      governance_contract: {
        data_lineage: {
          sources: [],
          transforms: [],
          sinks: [
            { ref: 'valid.sink', fields: ['f1'] },
            { ref: 'bad.sink' },                     // missing fields
            { fields: ['f2'] },                      // missing ref
            null                                     // null entry
          ]
        }
      }
    };

    const result = parseDataLineage(contract);
    expect(result.sinks).toHaveLength(1);
    expect(result.sinks[0].ref).toBe('valid.sink');
  });

  test('preserves extra properties on source/transform/sink entries', () => {
    const contract = {
      governance_contract: {
        data_lineage: {
          sources: [{ ref: 's1', fields: ['a'], extra: 'data' }],
          transforms: [{ operation: 'map', target: 'x' }],
          sinks: [{ ref: 'k1', fields: ['b'], label: 'output' }]
        }
      }
    };

    const result = parseDataLineage(contract);
    expect(result.sources[0].extra).toBe('data');
    expect(result.transforms[0].target).toBe('x');
    expect(result.sinks[0].label).toBe('output');
  });
});

describe('getLineageInfo', () => {
  // Requirement 7.5: query ref as source or sink
  test('returns empty arrays when contract has no data_lineage', () => {
    const result = getLineageInfo({}, 'any.ref');
    expect(result).toEqual({ ref: 'any.ref', asSource: [], asSink: [] });
  });

  test('returns matching source entries for ref', () => {
    const contract = {
      governance_contract: {
        data_lineage: {
          sources: [
            { ref: 'moqui.Order.list', fields: ['orderId'] },
            { ref: 'moqui.Product.list', fields: ['productId'] }
          ],
          transforms: [],
          sinks: []
        }
      }
    };

    const result = getLineageInfo(contract, 'moqui.Order.list');
    expect(result.ref).toBe('moqui.Order.list');
    expect(result.asSource).toHaveLength(1);
    expect(result.asSource[0]).toEqual({ ref: 'moqui.Order.list', fields: ['orderId'] });
    expect(result.asSink).toEqual([]);
  });

  test('returns matching sink entries for ref', () => {
    const contract = {
      governance_contract: {
        data_lineage: {
          sources: [],
          transforms: [],
          sinks: [
            { ref: 'moqui.OrderItem.create', fields: ['orderId'] },
            { ref: 'moqui.Audit.log', fields: ['action'] }
          ]
        }
      }
    };

    const result = getLineageInfo(contract, 'moqui.OrderItem.create');
    expect(result.ref).toBe('moqui.OrderItem.create');
    expect(result.asSource).toEqual([]);
    expect(result.asSink).toHaveLength(1);
    expect(result.asSink[0]).toEqual({ ref: 'moqui.OrderItem.create', fields: ['orderId'] });
  });

  test('returns both source and sink entries when ref appears in both', () => {
    const contract = {
      governance_contract: {
        data_lineage: {
          sources: [
            { ref: 'shared.ref', fields: ['input1'] }
          ],
          transforms: [],
          sinks: [
            { ref: 'shared.ref', fields: ['output1'] }
          ]
        }
      }
    };

    const result = getLineageInfo(contract, 'shared.ref');
    expect(result.asSource).toHaveLength(1);
    expect(result.asSink).toHaveLength(1);
    expect(result.asSource[0].fields).toEqual(['input1']);
    expect(result.asSink[0].fields).toEqual(['output1']);
  });

  test('returns empty arrays when ref does not match any source or sink', () => {
    const contract = {
      governance_contract: {
        data_lineage: {
          sources: [{ ref: 'other.ref', fields: ['x'] }],
          transforms: [{ operation: 'filter' }],
          sinks: [{ ref: 'another.ref', fields: ['y'] }]
        }
      }
    };

    const result = getLineageInfo(contract, 'nonexistent.ref');
    expect(result).toEqual({ ref: 'nonexistent.ref', asSource: [], asSink: [] });
  });

  test('returns multiple source entries when ref appears multiple times', () => {
    const contract = {
      governance_contract: {
        data_lineage: {
          sources: [
            { ref: 'dup.ref', fields: ['a'] },
            { ref: 'dup.ref', fields: ['b'] }
          ],
          transforms: [],
          sinks: []
        }
      }
    };

    const result = getLineageInfo(contract, 'dup.ref');
    expect(result.asSource).toHaveLength(2);
    expect(result.asSource[0].fields).toEqual(['a']);
    expect(result.asSource[1].fields).toEqual(['b']);
  });
});


const { getAgentHints } = require('../../../lib/scene-runtime/scene-ontology');

describe('getAgentHints', () => {
  // Requirement 9.4: agent_hints not present → return null
  test('returns null when contract has no agent_hints', () => {
    expect(getAgentHints({})).toBeNull();
  });

  test('returns null when contract is null', () => {
    expect(getAgentHints(null)).toBeNull();
  });

  test('returns null when contract is undefined', () => {
    expect(getAgentHints(undefined)).toBeNull();
  });

  test('returns null when agent_hints is not an object', () => {
    expect(getAgentHints({ agent_hints: 'string' })).toBeNull();
    expect(getAgentHints({ agent_hints: 42 })).toBeNull();
    expect(getAgentHints({ agent_hints: true })).toBeNull();
    expect(getAgentHints({ agent_hints: null })).toBeNull();
  });

  test('returns null when agent_hints is an array', () => {
    expect(getAgentHints({ agent_hints: [] })).toBeNull();
    expect(getAgentHints({ agent_hints: ['a', 'b'] })).toBeNull();
  });

  // Requirement 9.1, 9.3: agent_hints exists and is object → return it
  test('returns agent_hints object when present', () => {
    const hints = {
      summary: 'Order approval workflow',
      complexity: 'medium',
      estimated_duration_ms: 5000,
      required_permissions: ['order.approve'],
      suggested_sequence: ['check-inventory', 'approve-order'],
      rollback_strategy: 'reverse-sequence'
    };
    const result = getAgentHints({ agent_hints: hints });
    expect(result).toEqual(hints);
  });

  test('returns agent_hints even with partial fields', () => {
    const hints = { summary: 'Simple task' };
    expect(getAgentHints({ agent_hints: hints })).toEqual(hints);
  });

  test('returns empty object when agent_hints is empty object', () => {
    expect(getAgentHints({ agent_hints: {} })).toEqual({});
  });

  // Requirement 9.2: valid complexity values
  test('returns agent_hints with valid complexity values', () => {
    for (const complexity of ['low', 'medium', 'high']) {
      const hints = { complexity };
      expect(getAgentHints({ agent_hints: hints })).toEqual(hints);
    }
  });

  test('returns agent_hints with all fields populated', () => {
    const contract = {
      metadata: { name: 'test-scene' },
      agent_hints: {
        summary: 'Full workflow test',
        complexity: 'high',
        estimated_duration_ms: 10000,
        required_permissions: ['admin.read', 'admin.write'],
        suggested_sequence: ['step1', 'step2', 'step3'],
        rollback_strategy: 'manual-review'
      }
    };
    const result = getAgentHints(contract);
    expect(result).toBe(contract.agent_hints);
    expect(result.summary).toBe('Full workflow test');
    expect(result.complexity).toBe('high');
    expect(result.estimated_duration_ms).toBe(10000);
    expect(result.required_permissions).toEqual(['admin.read', 'admin.write']);
    expect(result.suggested_sequence).toEqual(['step1', 'step2', 'step3']);
    expect(result.rollback_strategy).toBe('manual-review');
  });
});

const {
  parseEntityRelationshipModel,
  parseBusinessRules,
  parseDecisionLogic,
  evaluateOntologySemanticQuality
} = require('../../../lib/scene-runtime/scene-ontology');

describe('parseEntityRelationshipModel', () => {
  test('parses entities and relations from ontology_model', () => {
    const contract = {
      ontology_model: {
        entities: [
          { id: 'entity:OrderHeader' },
          { ref: 'entity:OrderItem' }
        ],
        relations: [
          { source: 'entity:OrderItem', target: 'entity:OrderHeader', type: 'belongs_to' }
        ]
      }
    };
    const result = parseEntityRelationshipModel(contract);
    expect(result.summary.entity_count).toBe(2);
    expect(result.summary.relation_count).toBe(1);
  });

  test('supports relation aliases from/to', () => {
    const contract = {
      semantic_model: {
        entities: [{ name: 'entity:Product' }, { name: 'entity:Category' }],
        relations: [{ from: 'entity:Product', to: 'entity:Category', relation: 'belongs_to' }]
      }
    };
    const result = parseEntityRelationshipModel(contract);
    expect(result.relations[0]).toEqual(expect.objectContaining({
      source: 'entity:Product',
      target: 'entity:Category',
      type: 'belongs_to'
    }));
  });
});

describe('parseBusinessRules', () => {
  test('parses rule mapping and pass status', () => {
    const contract = {
      governance_contract: {
        business_rules: [
          { id: 'rule-1', entity_ref: 'entity:Order', status: 'enforced' },
          { id: 'rule-2', status: 'draft' }
        ]
      }
    };
    const result = parseBusinessRules(contract);
    expect(result.summary.total).toBe(2);
    expect(result.summary.mapped).toBe(1);
    expect(result.summary.unmapped).toBe(1);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.failed).toBe(1);
  });
});

describe('parseDecisionLogic', () => {
  test('parses decision resolved and automated status', () => {
    const contract = {
      governance_contract: {
        decision_logic: [
          { id: 'decision-1', status: 'resolved', tested: true },
          { id: 'decision-2', status: 'pending' }
        ]
      }
    };
    const result = parseDecisionLogic(contract);
    expect(result.summary.total).toBe(2);
    expect(result.summary.resolved).toBe(1);
    expect(result.summary.pending).toBe(1);
    expect(result.summary.automated).toBe(1);
  });
});

describe('evaluateOntologySemanticQuality', () => {
  test('returns semantic quality score and metrics', () => {
    const contract = {
      ontology_model: {
        entities: [{ id: 'entity:Order' }, { id: 'entity:OrderItem' }],
        relations: [{ source: 'entity:OrderItem', target: 'entity:Order' }]
      },
      governance_contract: {
        business_rules: [
          { id: 'rule-1', entity_ref: 'entity:Order', status: 'enforced' },
          { id: 'rule-2', entity_ref: 'entity:OrderItem', status: 'active' }
        ],
        decision_logic: [
          { id: 'decision-1', status: 'resolved' }
        ]
      }
    };
    const result = evaluateOntologySemanticQuality(contract);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.level).toBe('high');
    expect(result.metrics).toEqual(expect.objectContaining({
      entity_count: 2,
      relation_count: 1,
      business_rule_total: 2,
      business_rule_unmapped: 0,
      decision_total: 1,
      decision_undecided: 0
    }));
  });
});
