const MetadataManager = require('./metadata-manager');
const DependencyManager = require('./dependency-manager');
const ContractManager = require('./contract-manager');
const IntegrationManager = require('./integration-manager');
const Visualizer = require('./visualizer');

/**
 * CollaborationManager orchestrates all collaboration operations
 */
class CollaborationManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    
    // Initialize managers
    this.metadataManager = new MetadataManager(workspaceRoot);
    this.dependencyManager = new DependencyManager(this.metadataManager);
    this.contractManager = new ContractManager(workspaceRoot, this.metadataManager);
    this.integrationManager = new IntegrationManager(workspaceRoot, this.metadataManager);
    this.visualizer = new Visualizer();
  }

  /**
   * Initialize a Master Spec with Sub-Specs
   * @param {string} masterName - Name of the master spec
   * @param {Array<Object>} subSpecs - Array of {name, dependencies}
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Creation result
   */
  async initMasterSpec(masterName, subSpecs, options = {}) {
    // Create master spec metadata
    const masterMetadata = {
      version: '1.0.0',
      type: 'master',
      subSpecs: subSpecs.map(s => s.name),
      dependencies: [],
      status: {
        current: 'in-progress',
        updatedAt: new Date().toISOString()
      },
      interfaces: {
        provides: [],
        consumes: []
      }
    };

    await this.metadataManager.writeMetadata(masterName, masterMetadata);

    // Create sub-spec metadata
    const created = [];
    for (const subSpec of subSpecs) {
      const subMetadata = {
        version: '1.0.0',
        type: 'sub',
        masterSpec: masterName,
        dependencies: subSpec.dependencies || [],
        status: {
          current: 'not-started',
          updatedAt: new Date().toISOString()
        },
        interfaces: {
          provides: [],
          consumes: []
        }
      };

      await this.metadataManager.writeMetadata(subSpec.name, subMetadata);
      created.push(subSpec.name);
    }

    // Validate dependencies
    const graph = await this.dependencyManager.buildDependencyGraph();
    const cycle = this.dependencyManager.detectCircularDependencies(graph);
    
    if (cycle) {
      return {
        success: false,
        error: `Circular dependency detected: ${cycle.join(' → ')}`,
        created: [masterName, ...created]
      };
    }

    return {
      success: true,
      master: masterName,
      subSpecs: created,
      message: `Created master spec '${masterName}' with ${created.length} sub-specs`
    };
  }

  /**
   * Get collaboration status for all specs or a specific spec
   * @param {string} specName - Optional spec name
   * @returns {Promise<Object>} Status information
   */
  async getCollaborationStatus(specName = null) {
    if (specName) {
      const metadata = await this.metadataManager.readMetadata(specName);
      if (!metadata) {
        return {
          found: false,
          error: `Spec '${specName}' not found`
        };
      }

      return {
        found: true,
        spec: specName,
        metadata
      };
    }

    // Get all specs
    const allSpecs = await this.metadataManager.listAllMetadata();
    const graph = await this.dependencyManager.buildDependencyGraph();
    const ready = this.dependencyManager.getReadySpecs(graph);

    return {
      total: allSpecs.length,
      specs: allSpecs,
      ready,
      graph
    };
  }

  /**
   * Assign a spec to a Kiro instance
   * @param {string} specName - Name of the spec
   * @param {string} kiroInstance - Kiro instance identifier
   * @returns {Promise<Object>} Assignment result
   */
  async assignSpec(specName, kiroInstance) {
    const metadata = await this.metadataManager.readMetadata(specName);
    
    if (!metadata) {
      return {
        success: false,
        error: `Spec '${specName}' not found`
      };
    }

    // Check if blocked
    if (metadata.status.current === 'blocked') {
      return {
        success: false,
        error: `Cannot assign blocked spec (reason: ${metadata.status.blockReason || 'unknown'})`
      };
    }

    // Update assignment
    const updated = await this.metadataManager.atomicUpdate(specName, (meta) => {
      meta.assignment = {
        kiroInstance,
        assignedAt: new Date().toISOString()
      };
      return meta;
    });

    return {
      success: true,
      spec: specName,
      kiroInstance,
      message: `Assigned '${specName}' to '${kiroInstance}'`
    };
  }

  /**
   * Update spec status
   * @param {string} specName - Name of the spec
   * @param {string} status - New status
   * @param {string} reason - Optional reason (for blocked status)
   * @returns {Promise<Object>} Update result
   */
  async updateSpecStatus(specName, status, reason = null) {
    const validStatuses = ['not-started', 'in-progress', 'completed', 'blocked'];
    
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        error: `Invalid status: ${status}`
      };
    }

    const updated = await this.metadataManager.atomicUpdate(specName, (meta) => {
      meta.status = {
        current: status,
        updatedAt: new Date().toISOString()
      };
      
      if (status === 'blocked' && reason) {
        meta.status.blockReason = reason;
      }
      
      return meta;
    });

    // If completed, update dependent specs
    if (status === 'completed') {
      const nowReady = await this.dependencyManager.updateDependentSpecs(specName);
      return {
        success: true,
        spec: specName,
        status,
        nowReady,
        message: `Updated '${specName}' to '${status}'. ${nowReady.length} specs now ready.`
      };
    }

    return {
      success: true,
      spec: specName,
      status,
      message: `Updated '${specName}' to '${status}'`
    };
  }

  /**
   * Verify contracts for a spec
   * @param {string} specName - Name of the spec
   * @returns {Promise<Object>} Verification result
   */
  async verifyContracts(specName) {
    return await this.contractManager.verifyImplementation(specName);
  }

  /**
   * Run integration tests
   * @param {Array<string>} specNames - Specs to test
   * @returns {Promise<Object>} Test results
   */
  async runIntegrationTests(specNames) {
    return await this.integrationManager.runAllTests(specNames);
  }

  /**
   * Generate dependency graph visualization
   * @param {string} format - Format ('text' or 'mermaid')
   * @param {Object} options - Visualization options
   * @returns {Promise<string>} Graph visualization
   */
  async generateDependencyGraph(format = 'text', options = {}) {
    const graph = await this.dependencyManager.buildDependencyGraph();
    
    if (format === 'mermaid') {
      return this.visualizer.generateMermaidGraph(graph);
    }
    
    return this.visualizer.generateTextGraph(graph, options);
  }

  /**
   * Validate all dependencies
   * @param {string} specName - Optional spec name to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateDependencies(specName = null) {
    const graph = await this.dependencyManager.buildDependencyGraph(
      specName ? [specName] : null
    );
    
    const cycle = this.dependencyManager.detectCircularDependencies(graph);
    
    if (cycle) {
      return {
        valid: false,
        error: `Circular dependency detected: ${cycle.join(' → ')}`
      };
    }

    return {
      valid: true,
      message: 'All dependencies are valid'
    };
  }

  /**
   * Get ready specs (specs that can be started)
   * @returns {Promise<Array<string>>} List of ready spec names
   */
  async getReadySpecs() {
    const graph = await this.dependencyManager.buildDependencyGraph();
    return this.dependencyManager.getReadySpecs(graph);
  }
}

module.exports = CollaborationManager;
