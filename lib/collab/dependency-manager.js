/**
 * DependencyManager handles dependency graph analysis and validation
 */
class DependencyManager {
  constructor(metadataManager) {
    this.metadataManager = metadataManager;
  }

  /**
   * Build dependency graph from specs
   * @param {Array<string>} specNames - Optional list of spec names (defaults to all)
   * @returns {Promise<Object>} Graph with nodes and edges
   */
  async buildDependencyGraph(specNames = null) {
    const allSpecs = await this.metadataManager.listAllMetadata();
    const specsToInclude = specNames 
      ? allSpecs.filter(s => specNames.includes(s.name))
      : allSpecs;

    const nodes = [];
    const edges = [];

    for (const { name, metadata } of specsToInclude) {
      // Add node
      nodes.push({
        id: name,
        status: metadata.status?.current || 'not-started',
        kiroInstance: metadata.assignment?.kiroInstance || null,
        type: metadata.type
      });

      // Add edges from dependencies
      if (metadata.dependencies) {
        for (const dep of metadata.dependencies) {
          edges.push({
            from: name,
            to: dep.spec,
            type: dep.type,
            reason: dep.reason
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Detect circular dependencies in graph
   * @param {Object} graph - Graph with nodes and edges
   * @returns {Array<string>|null} Cycle path if found, null otherwise
   */
  detectCircularDependencies(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];

    const hasCycle = (nodeId) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      // Get outgoing edges
      const outgoing = graph.edges.filter(e => e.from === nodeId);
      
      for (const edge of outgoing) {
        if (!visited.has(edge.to)) {
          if (hasCycle(edge.to)) {
            return true;
          }
        } else if (recursionStack.has(edge.to)) {
          // Found cycle
          path.push(edge.to);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          return path;
        }
      }
    }

    return null;
  }

  /**
   * Get specs that are ready to start (all dependencies satisfied)
   * @param {Object} graph - Graph with nodes and edges
   * @returns {Array<string>} List of ready spec names
   */

  getReadySpecs(graph) {
    const ready = [];

    for (const node of graph.nodes) {
      // Skip if already completed or in progress
      if (node.status === 'completed' || node.status === 'in-progress') {
        continue;
      }

      // Skip if blocked
      if (node.status === 'blocked') {
        continue;
      }

      // Get dependencies for this node
      const dependencies = graph.edges.filter(e => e.from === node.id);
      
      // Check if all required dependencies are satisfied
      const allSatisfied = dependencies.every(dep => {
        // Optional dependencies don't block
        if (dep.type === 'optional') {
          return true;
        }

        // Find the dependency node
        const depNode = graph.nodes.find(n => n.id === dep.to);
        
        if (!depNode) {
          // Dependency not found - not ready
          return false;
        }

        // For requires-completion, dependency must be completed
        if (dep.type === 'requires-completion') {
          return depNode.status === 'completed';
        }

        // For requires-interface, dependency must have interface defined
        // (we'll check this in contract manager)
        if (dep.type === 'requires-interface') {
          return depNode.status === 'completed' || depNode.status === 'in-progress';
        }

        return false;
      });

      if (allSatisfied) {
        ready.push(node.id);
      }
    }

    return ready;
  }

  /**
   * Get critical path (longest dependency chain)
   * @param {Object} graph - Graph with nodes and edges
   * @returns {Array<string>} Spec names in critical path
   */
  getCriticalPath(graph) {
    const memo = new Map();

    const getLongestPath = (nodeId) => {
      if (memo.has(nodeId)) {
        return memo.get(nodeId);
      }

      // Get incoming edges (dependencies)
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
   * Validate a dependency relationship
   * @param {string} fromSpec - Spec that depends on another
   * @param {string} toSpec - Spec being depended on
   * @param {string} type - Dependency type
   * @returns {Promise<Object>} Validation result
   */
  async validateDependency(fromSpec, toSpec, type) {
    // Check if specs exist
    const fromMetadata = await this.metadataManager.readMetadata(fromSpec);
    const toMetadata = await this.metadataManager.readMetadata(toSpec);

    if (!fromMetadata) {
      return {
        valid: false,
        error: `Spec '${fromSpec}' not found`
      };
    }

    if (!toMetadata) {
      return {
        valid: false,
        error: `Dependency '${toSpec}' not found`
      };
    }

    // Check for self-dependency
    if (fromSpec === toSpec) {
      return {
        valid: false,
        error: 'Spec cannot depend on itself'
      };
    }

    // Build graph with new dependency and check for cycles
    const graph = await this.buildDependencyGraph();
    
    // Add the new edge temporarily
    graph.edges.push({ from: fromSpec, to: toSpec, type });
    
    const cycle = this.detectCircularDependencies(graph);
    if (cycle) {
      return {
        valid: false,
        error: `Circular dependency detected: ${cycle.join(' → ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Update dependent specs when a spec is completed
   * @param {string} completedSpec - Name of completed spec
   * @returns {Promise<Array<string>>} List of specs that became ready
   */
  async updateDependentSpecs(completedSpec) {
    const graph = await this.buildDependencyGraph();
    
    // Find specs that depend on the completed spec
    const dependents = graph.edges
      .filter(e => e.to === completedSpec)
      .map(e => e.from);

    // Check which dependents are now ready
    const nowReady = [];
    for (const depSpec of dependents) {
      const depMetadata = await this.metadataManager.readMetadata(depSpec);
      if (depMetadata && depMetadata.status.current === 'not-started') {
        // Check if all dependencies are satisfied
        const ready = this.getReadySpecs(graph);
        if (ready.includes(depSpec)) {
          nowReady.push(depSpec);
        }
      }
    }

    return nowReady;
  }
}

module.exports = DependencyManager;
