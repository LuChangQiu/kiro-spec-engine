/**
 * Visualizer generates dependency graph visualizations
 */
class Visualizer {
  /**
   * Generate text-based dependency graph
   * @param {Object} graph - Graph with nodes and edges
   * @param {Object} options - Visualization options
   * @returns {string} Text-based graph
   */
  generateTextGraph(graph, options = {}) {
    const lines = [];
    const { showCriticalPath = false } = options;
    
    // Get critical path if requested
    let criticalPath = [];
    if (showCriticalPath) {
      criticalPath = this._getCriticalPath(graph);
    }

    // Group by master specs
    const masterSpecs = graph.nodes.filter(n => n.type === 'master');
    const subSpecs = graph.nodes.filter(n => n.type === 'sub');
    
    if (masterSpecs.length > 0) {
      for (const master of masterSpecs) {
        lines.push(this._formatNode(master, criticalPath));
        
        // Find sub-specs of this master
        const children = this._getChildren(master.id, graph);
        for (const child of children) {
          lines.push(`  ${this._formatNode(child, criticalPath)}`);
          
          // Show dependencies
          const deps = graph.edges.filter(e => e.from === child.id);
          for (const dep of deps) {
            lines.push(`    └─ requires: ${dep.to} (${dep.type})`);
          }
        }
        lines.push('');
      }
    }

    // Show standalone specs
    const standalone = subSpecs.filter(s => {
      const hasParent = graph.edges.some(e => e.to === s.id && graph.nodes.find(n => n.id === e.from && n.type === 'master'));
      return !hasParent;
    });

    if (standalone.length > 0) {
      lines.push('Standalone Specs:');
      for (const spec of standalone) {
        lines.push(this._formatNode(spec, criticalPath));
        
        const deps = graph.edges.filter(e => e.from === spec.id);
        for (const dep of deps) {
          lines.push(`  └─ requires: ${dep.to} (${dep.type})`);
        }
      }
    }

    if (showCriticalPath && criticalPath.length > 0) {
      lines.push('');
      lines.push(`Critical Path: ${criticalPath.join(' → ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate Mermaid format graph
   * @param {Object} graph - Graph with nodes and edges
   * @returns {string} Mermaid graph definition
   */
  generateMermaidGraph(graph) {
    const lines = ['graph TD'];
    
    // Add nodes
    for (const node of graph.nodes) {
      const symbol = this._getStatusSymbol(node.status);
      const label = `${node.id} ${symbol}`;
      const nodeId = this._sanitizeId(node.id);
      
      // Use different shapes for different types
      if (node.type === 'master') {
        lines.push(`  ${nodeId}[["${label}"]]`);
      } else {
        lines.push(`  ${nodeId}["${label}"]`);
      }
    }

    // Add edges
    for (const edge of edges) {
      const fromId = this._sanitizeId(edge.from);
      const toId = this._sanitizeId(edge.to);
      const label = edge.type === 'requires-completion' ? 'requires' : edge.type;
      lines.push(`  ${fromId} -->|${label}| ${toId}`);
    }

    return lines.join('\n');
  }

  /**
   * Highlight critical path in graph
   * @param {Object} graph - Graph with nodes and edges
   * @returns {Array<string>} Critical path node IDs
   */
  highlightCriticalPath(graph) {
    return this._getCriticalPath(graph);
  }

  /**
   * Format a spec node for display
   * @param {Object} node - Node to format
   * @param {Array<string>} criticalPath - Critical path nodes
   * @returns {string} Formatted node string
   */
  _formatNode(node, criticalPath = []) {
    const symbol = this._getStatusSymbol(node.status);
    const assignment = node.kiroInstance ? ` (${node.kiroInstance})` : ' (unassigned)';
    const critical = criticalPath.includes(node.id) ? ' [CRITICAL]' : '';
    
    return `${symbol} ${node.id}${assignment}${critical}`;
  }

  /**
   * Get status symbol for a node
   * @param {string} status - Node status
   * @returns {string} Symbol
   */
  _getStatusSymbol(status) {
    const symbols = {
      'completed': '✓',
      'in-progress': '⧗',
      'not-started': '○',
      'blocked': '✗'
    };
    return symbols[status] || '?';
  }

  /**
   * Get children of a master spec
   * @param {string} masterId - Master spec ID
   * @param {Object} graph - Graph
   * @returns {Array<Object>} Child nodes
   */
  _getChildren(masterId, graph) {
    // In our model, children reference parent via metadata
    // For visualization, we can infer from naming or metadata
    // For now, return empty array (would need metadata access)
    return [];
  }

  /**
   * Get critical path (longest dependency chain)
   * @param {Object} graph - Graph
   * @returns {Array<string>} Node IDs in critical path
   */
  _getCriticalPath(graph) {
    const memo = new Map();

    const getLongestPath = (nodeId) => {
      if (memo.has(nodeId)) {
        return memo.get(nodeId);
      }

      const incoming = graph.edges.filter(e => e.to === nodeId);
      
      if (incoming.length === 0) {
        memo.set(nodeId, [nodeId]);
        return [nodeId];
      }

      let longestPath = [];
      for (const edge of incoming) {
        const path = getLongestPath(edge.from);
        if (path.length > longestPath.length) {
          longestPath = path;
        }
      }

      const result = [...longestPath, nodeId];
      memo.set(nodeId, result);
      return result;
    };

    let criticalPath = [];
    for (const node of graph.nodes) {
      const path = getLongestPath(node.id);
      if (path.length > criticalPath.length) {
        criticalPath = path;
      }
    }

    return criticalPath;
  }

  /**
   * Sanitize ID for Mermaid
   * @param {string} id - Node ID
   * @returns {string} Sanitized ID
   */
  _sanitizeId(id) {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }
}

module.exports = Visualizer;
