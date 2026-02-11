'use strict';

const VALID_RELATION_TYPES = ['depends_on', 'composes', 'extends', 'produces'];

class OntologyGraph {
  constructor() {
    this._nodes = new Map();
    this._edges = new Map();
  }

  addNode(ref, metadata = {}) {
    if (typeof ref !== 'string' || !ref) {
      throw new Error('Node ref must be a non-empty string');
    }
    this._nodes.set(ref, { ref, metadata });
  }

  getNode(ref) {
    return this._nodes.get(ref) || null;
  }

  getAllNodes() {
    return Array.from(this._nodes.values());
  }

  addEdge(sourceRef, targetRef, relationType) {
    if (!VALID_RELATION_TYPES.includes(relationType)) {
      throw new Error(
        `Invalid relation type "${relationType}". Valid types: ${VALID_RELATION_TYPES.join(', ')}`
      );
    }

    const missingNodes = [];
    if (!this._nodes.has(sourceRef)) {
      missingNodes.push(sourceRef);
    }
    if (!this._nodes.has(targetRef)) {
      missingNodes.push(targetRef);
    }
    if (missingNodes.length > 0) {
      throw new Error(
        `Cannot add edge: node(s) not found: ${missingNodes.join(', ')}`
      );
    }

    const edges = this._edges.get(sourceRef) || [];
    edges.push({ source: sourceRef, target: targetRef, type: relationType });
    this._edges.set(sourceRef, edges);
  }

  getEdges(ref) {
    return this._edges.get(ref) || [];
  }

  getAllEdges() {
    const all = [];
    for (const edges of this._edges.values()) {
      all.push(...edges);
    }
    return all;
  }

  toJSON() {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges()
    };
  }

  static fromJSON(json) {
    const graph = new OntologyGraph();
    if (json && Array.isArray(json.nodes)) {
      for (const node of json.nodes) {
        graph.addNode(node.ref, node.metadata || {});
      }
    }
    if (json && Array.isArray(json.edges)) {
      for (const edge of json.edges) {
        graph.addEdge(edge.source, edge.target, edge.type);
      }
    }
    return graph;
  }

}

/**
 * 验证 OntologyGraph 一致性
 * @param {OntologyGraph} graph
 * @returns {{ valid: boolean, errors: Array<{ code: string, message: string, details: object }> }}
 */
function validateOntology(graph) {
  const errors = [];

  // Check 1: DANGLING_EDGE_TARGET — edge targets that don't exist as nodes
  const allEdges = graph.getAllEdges();
  for (const edge of allEdges) {
    if (!graph.getNode(edge.target)) {
      errors.push({
        code: 'DANGLING_EDGE_TARGET',
        message: `Edge target '${edge.target}' does not exist as a node`,
        details: { source: edge.source, target: edge.target }
      });
    }
  }

  // Check 2: CYCLE_DETECTED — cycles in depends_on relationships (DFS)
  const dependsAdj = new Map();
  for (const edge of allEdges) {
    if (edge.type === 'depends_on') {
      if (!dependsAdj.has(edge.source)) {
        dependsAdj.set(edge.source, []);
      }
      dependsAdj.get(edge.source).push(edge.target);
    }
  }

  const WHITE = 0; // unvisited
  const GRAY = 1;  // in current DFS path
  const BLACK = 2; // fully processed
  const color = new Map();
  const parent = new Map();

  for (const node of graph.getAllNodes()) {
    color.set(node.ref, WHITE);
  }

  function dfs(u) {
    color.set(u, GRAY);
    const neighbors = dependsAdj.get(u) || [];
    for (const v of neighbors) {
      if (color.get(v) === GRAY) {
        // Found a cycle — reconstruct the path
        const cycle = [v, u];
        let cur = u;
        while (cur !== v) {
          cur = parent.get(cur);
          if (cur === undefined) break;
          cycle.push(cur);
        }
        cycle.reverse();
        if (cycle[0] !== cycle[cycle.length - 1]) {
          cycle.push(cycle[0]);
        }
        errors.push({
          code: 'CYCLE_DETECTED',
          message: `Cycle detected in depends_on: ${cycle.join(' → ')}`,
          details: { cycle }
        });
        return;
      }
      if (color.get(v) === WHITE) {
        parent.set(v, u);
        dfs(v);
      }
    }
    color.set(u, BLACK);
  }

  for (const node of graph.getAllNodes()) {
    if (color.get(node.ref) === WHITE) {
      dfs(node.ref);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 查询 ref 的完整 depends_on 依赖链（BFS 遍历）
 * @param {OntologyGraph} graph
 * @param {string} ref
 * @returns {{ ref: string, chain: string[], hasCycle: boolean, error?: string }}
 */
function queryDependencyChain(graph, ref) {
  // Requirement 4.2: ref not found → return error
  if (!graph.getNode(ref)) {
    return { ref, chain: [], hasCycle: false, error: 'Node not found' };
  }

  // BFS to collect all transitive depends_on dependencies
  const chain = [];
  const visited = new Set();
  const queue = [ref];

  visited.add(ref);

  while (queue.length > 0) {
    const current = queue.shift();
    const edges = graph.getEdges(current);

    for (const edge of edges) {
      if (edge.type !== 'depends_on') continue;
      if (visited.has(edge.target)) continue;

      visited.add(edge.target);
      chain.push(edge.target);
      queue.push(edge.target);
    }
  }

  // DFS cycle detection on the depends_on subgraph reachable from ref
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const node of visited) {
    color.set(node, WHITE);
  }

  let hasCycle = false;

  function dfs(u) {
    if (hasCycle) return;
    color.set(u, GRAY);
    const edges = graph.getEdges(u);
    for (const edge of edges) {
      if (edge.type !== 'depends_on') continue;
      if (!color.has(edge.target)) continue;
      if (color.get(edge.target) === GRAY) {
        hasCycle = true;
        return;
      }
      if (color.get(edge.target) === WHITE) {
        dfs(edge.target);
      }
    }
    color.set(u, BLACK);
  }

  dfs(ref);

  return { ref, chain, hasCycle };
}

/**
 * 从 scene-package.json 构建 OntologyGraph
 * @param {Object} contract - 解析后的 scene-package.json 对象
 * @returns {OntologyGraph}
 */
function buildOntologyFromManifest(contract) {
  const graph = new OntologyGraph();

  const bindings = contract
    && contract.capability_contract
    && Array.isArray(contract.capability_contract.bindings)
    ? contract.capability_contract.bindings
    : [];

  if (bindings.length === 0) {
    return graph;
  }

  // Step 1: Create nodes for each binding
  const refSet = new Set();
  for (const binding of bindings) {
    if (!binding.ref || typeof binding.ref !== 'string') continue;
    refSet.add(binding.ref);
    graph.addNode(binding.ref, {
      type: binding.type || null,
      timeout_ms: binding.timeout_ms || null,
      intent: binding.intent || null,
      preconditions: Array.isArray(binding.preconditions) ? binding.preconditions : [],
      postconditions: Array.isArray(binding.postconditions) ? binding.postconditions : []
    });
  }

  // Step 2: Infer composes relationships from shared prefixes
  const prefixMap = new Map();
  for (const ref of refSet) {
    const segments = ref.split('.');
    if (segments.length >= 2) {
      const prefix = segments.slice(0, -1).join('.');
      if (!prefixMap.has(prefix)) {
        prefixMap.set(prefix, []);
      }
      prefixMap.get(prefix).push(ref);
    }
  }

  for (const [, refs] of prefixMap) {
    if (refs.length < 2) continue;
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        graph.addEdge(refs[i], refs[j], 'composes');
        graph.addEdge(refs[j], refs[i], 'composes');
      }
    }
  }

  // Step 3: Parse explicit depends_on fields
  for (const binding of bindings) {
    if (binding.depends_on && typeof binding.depends_on === 'string' && refSet.has(binding.depends_on)) {
      graph.addEdge(binding.ref, binding.depends_on, 'depends_on');
    }
  }

  return graph;
}

/**
 * 获取指定 ref 的 action abstraction 信息
 * @param {OntologyGraph} graph
 * @param {string} ref
 * @returns {{ ref: string, intent: string|null, preconditions: string[], postconditions: string[] }}
 */
function getActionInfo(graph, ref) {
  const node = graph.getNode(ref);
  if (!node) {
    return { ref, intent: null, preconditions: [], postconditions: [] };
  }
  const meta = node.metadata || {};
  return {
    ref,
    intent: typeof meta.intent === 'string' ? meta.intent : null,
    preconditions: Array.isArray(meta.preconditions) ? meta.preconditions : [],
    postconditions: Array.isArray(meta.postconditions) ? meta.postconditions : []
  };
}

/**
 * 解析 governance_contract.data_lineage
 * @param {Object} contract - scene-package.json 对象
 * @returns {{ sources: Array, transforms: Array, sinks: Array } | null}
 */
function parseDataLineage(contract) {
  const lineage = contract
    && contract.governance_contract
    && contract.governance_contract.data_lineage;

  if (!lineage || typeof lineage !== 'object') {
    return null;
  }

  const sources = Array.isArray(lineage.sources)
    ? lineage.sources.filter(s => s && typeof s.ref === 'string' && Array.isArray(s.fields))
    : [];

  const transforms = Array.isArray(lineage.transforms)
    ? lineage.transforms.filter(t => t && typeof t.operation === 'string')
    : [];

  const sinks = Array.isArray(lineage.sinks)
    ? lineage.sinks.filter(s => s && typeof s.ref === 'string' && Array.isArray(s.fields))
    : [];

  return { sources, transforms, sinks };
}

/**
 * 查询指定 ref 参与的 lineage 路径
 * @param {Object} contract - scene-package.json 对象
 * @param {string} ref
 * @returns {{ ref: string, asSource: Array, asSink: Array }}
 */
function getLineageInfo(contract, ref) {
  const lineage = parseDataLineage(contract);
  if (!lineage) {
    return { ref, asSource: [], asSink: [] };
  }

  const asSource = lineage.sources.filter(s => s.ref === ref);
  const asSink = lineage.sinks.filter(s => s.ref === ref);

  return { ref, asSource, asSink };
}

/**
 * 解析 agent_hints 字段
 * @param {Object} contract - scene-package.json 对象
 * @returns {Object|null}
 */
function getAgentHints(contract) {
  if (!contract || typeof contract !== 'object') return null;
  const hints = contract.agent_hints;
  if (!hints || typeof hints !== 'object' || Array.isArray(hints)) return null;
  return hints;
}

module.exports = {
  OntologyGraph,
  VALID_RELATION_TYPES,
  buildOntologyFromManifest,
  validateOntology,
  queryDependencyChain,
  getActionInfo,
  parseDataLineage,
  getLineageInfo,
  getAgentHints
};
