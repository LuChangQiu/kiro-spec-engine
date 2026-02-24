const fs = require('fs').promises;
const path = require('path');

/**
 * MetadataManager handles CRUD operations on collaboration.json files
 * Provides atomic updates and schema validation
 */
class MetadataManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.specsDir = path.join(workspaceRoot, '.sce', 'specs');
  }

  /**
   * Read collaboration metadata for a spec
   * @param {string} specName - Name of the spec
   * @returns {Promise<Object|null>} Metadata object or null if not found
   */
  async readMetadata(specName) {
    const metadataPath = this._getMetadataPath(specName);
    
    try {
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to read metadata for ${specName}: ${error.message}`);
    }
  }

  /**
   * Write collaboration metadata for a spec
   * @param {string} specName - Name of the spec
   * @param {Object} metadata - Metadata object to write
   * @returns {Promise<void>}
   */
  async writeMetadata(specName, metadata) {
    // Validate metadata before writing
    this.validateMetadata(metadata);
    
    const metadataPath = this._getMetadataPath(specName);
    const specDir = path.dirname(metadataPath);
    
    // Ensure spec directory exists
    await fs.mkdir(specDir, { recursive: true });
    
    // Write with pretty formatting
    const content = JSON.stringify(metadata, null, 2);
    await fs.writeFile(metadataPath, content, 'utf8');
  }

  /**
   * Validate metadata against schema
   * @param {Object} metadata - Metadata to validate
   * @throws {Error} If metadata is invalid
   */
  validateMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Metadata must be an object');
    }

    // Required fields
    if (!metadata.version) {
      throw new Error('Missing required field: version');
    }

    
    if (!metadata.type || !['master', 'sub'].includes(metadata.type)) {
      throw new Error('Invalid or missing type: must be "master" or "sub"');
    }

    // Validate dependencies array
    if (metadata.dependencies) {
      if (!Array.isArray(metadata.dependencies)) {
        throw new Error('dependencies must be an array');
      }
      
      for (const dep of metadata.dependencies) {
        if (!dep.spec || typeof dep.spec !== 'string') {
          throw new Error('Each dependency must have a spec name');
        }
        
        if (!dep.type || !['requires-completion', 'requires-interface', 'optional'].includes(dep.type)) {
          throw new Error(`Invalid dependency type: ${dep.type}`);
        }
      }
    }

    // Validate status
    if (metadata.status) {
      const validStatuses = ['not-started', 'in-progress', 'completed', 'blocked'];
      if (!metadata.status.current || !validStatuses.includes(metadata.status.current)) {
        throw new Error(`Invalid status: ${metadata.status.current}`);
      }
      
      if (!metadata.status.updatedAt) {
        throw new Error('Status must have updatedAt timestamp');
      }
    }

    // Validate interfaces
    if (metadata.interfaces) {
      if (!Array.isArray(metadata.interfaces.provides)) {
        throw new Error('interfaces.provides must be an array');
      }
      if (!Array.isArray(metadata.interfaces.consumes)) {
        throw new Error('interfaces.consumes must be an array');
      }
    }
  }

  /**
   * Delete collaboration metadata for a spec
   * @param {string} specName - Name of the spec
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteMetadata(specName) {
    const metadataPath = this._getMetadataPath(specName);
    
    try {
      await fs.unlink(metadataPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw new Error(`Failed to delete metadata for ${specName}: ${error.message}`);
    }
  }

  /**
   * List all specs with collaboration metadata
   * @returns {Promise<Array<{name: string, metadata: Object}>>}
   */
  async listAllMetadata() {
    const specs = [];
    
    try {
      const specDirs = await fs.readdir(this.specsDir);
      
      for (const specName of specDirs) {
        const metadata = await this.readMetadata(specName);
        if (metadata) {
          specs.push({ name: specName, metadata });
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
    
    return specs;
  }

  /**
   * Perform atomic update on metadata
   * @param {string} specName - Name of the spec
   * @param {Function} updateFn - Function that receives current metadata and returns updated metadata
   * @returns {Promise<Object>} Updated metadata
   */
  async atomicUpdate(specName, updateFn) {
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Read current metadata
        const current = await this.readMetadata(specName) || this._getDefaultMetadata();
        
        // Apply update function
        const updated = await updateFn(current);
        
        // Write updated metadata
        await this.writeMetadata(specName, updated);
        
        return updated;
      } catch (error) {
        lastError = error;
        
        // Exponential backoff
        if (attempt < maxRetries - 1) {
          await this._sleep(Math.pow(2, attempt) * 100);
        }
      }
    }
    
    throw new Error(`Atomic update failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Get default metadata structure
   * @returns {Object}
   */
  _getDefaultMetadata() {
    return {
      version: '1.0.0',
      type: 'sub',
      dependencies: [],
      status: {
        current: 'not-started',
        updatedAt: new Date().toISOString()
      },
      interfaces: {
        provides: [],
        consumes: []
      }
    };
  }

  /**
   * Get metadata file path for a spec
   * @param {string} specName
   * @returns {string}
   */
  _getMetadataPath(specName) {
    return path.join(this.specsDir, specName, 'collaboration.json');
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MetadataManager;
