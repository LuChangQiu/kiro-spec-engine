const fs = require('fs').promises;
const path = require('path');

/**
 * ContractManager handles interface contract definition and verification
 */
class ContractManager {
  constructor(workspaceRoot, metadataManager) {
    this.workspaceRoot = workspaceRoot;
    this.metadataManager = metadataManager;
    this.specsDir = path.join(workspaceRoot, '.sce', 'specs');
  }

  /**
   * Define an interface contract for a spec
   * @param {string} specName - Name of the spec
   * @param {Object} contract - Contract definition
   * @returns {Promise<void>}
   */
  async defineContract(specName, contract) {
    // Validate contract structure
    this._validateContract(contract);
    
    const contractPath = this._getContractPath(specName, contract.interfaces[0].name);
    const contractDir = path.dirname(contractPath);
    
    // Ensure interfaces directory exists
    await fs.mkdir(contractDir, { recursive: true });
    
    // Write contract
    const content = JSON.stringify(contract, null, 2);
    await fs.writeFile(contractPath, content, 'utf8');
    
    // Update metadata to include this interface
    await this.metadataManager.atomicUpdate(specName, (metadata) => {
      if (!metadata.interfaces) {
        metadata.interfaces = { provides: [], consumes: [] };
      }
      
      const interfaceName = `${contract.interfaces[0].name}.json`;
      if (!metadata.interfaces.provides.includes(interfaceName)) {
        metadata.interfaces.provides.push(interfaceName);
      }
      
      return metadata;
    });
  }

  /**
   * Read an interface contract
   * @param {string} specName - Name of the spec
   * @param {string} interfaceName - Name of the interface
   * @returns {Promise<Object|null>} Contract or null if not found
   */
  async readContract(specName, interfaceName) {
    const contractPath = this._getContractPath(specName, interfaceName);
    
    try {
      const content = await fs.readFile(contractPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to read contract ${interfaceName} for ${specName}: ${error.message}`);
    }
  }

  /**
   * Verify that a spec's implementation matches its contracts
   * @param {string} specName - Name of the spec
   * @returns {Promise<Object>} Verification result
   */
  async verifyImplementation(specName) {
    const metadata = await this.metadataManager.readMetadata(specName);
    
    if (!metadata || !metadata.interfaces || !metadata.interfaces.provides) {
      return {
        valid: true,
        message: 'No interfaces to verify'
      };
    }

    const results = [];
    
    for (const interfaceFile of metadata.interfaces.provides) {
      const interfaceName = path.basename(interfaceFile, '.json');
      const contract = await this.readContract(specName, interfaceName);
      
      if (!contract) {
        results.push({
          interface: interfaceName,
          valid: false,
          error: 'Contract file not found'
        });
        continue;
      }

      // Try to verify implementation
      const verification = await this._verifyJSImplementation(specName, contract);
      results.push({
        interface: interfaceName,
        ...verification
      });
    }

    const allValid = results.every(r => r.valid);
    
    return {
      valid: allValid,
      results,
      message: allValid ? 'All interfaces verified' : 'Some interfaces have mismatches'
    };
  }

  /**
   * Verify JavaScript/TypeScript implementation against contract
   * @param {string} specName - Name of the spec
   * @param {Object} contract - Contract definition
   * @returns {Promise<Object>} Verification result
   */
  async _verifyJSImplementation(specName, contract) {
    const libPath = path.join(this.specsDir, specName, 'lib');
    
    try {
      // Check if lib directory exists
      await fs.access(libPath);
    } catch (error) {
      return {
        valid: false,
        error: 'Implementation directory not found (lib/)',
        mismatches: []
      };
    }

    const mismatches = [];
    
    for (const interfaceDef of contract.interfaces) {
      // Try to find the implementation file
      const possibleFiles = [
        path.join(libPath, `${interfaceDef.name.toLowerCase()}.js`),
        path.join(libPath, `${this._kebabCase(interfaceDef.name)}.js`),
        path.join(libPath, 'index.js')
      ];

      let implementationFound = false;
      let implementationContent = '';
      
      for (const filePath of possibleFiles) {
        try {
          implementationContent = await fs.readFile(filePath, 'utf8');
          implementationFound = true;
          break;
        } catch (error) {
          // Try next file
        }
      }

      if (!implementationFound) {
        mismatches.push({
          type: 'missing-implementation',
          interface: interfaceDef.name,
          message: `Implementation file not found`
        });
        continue;
      }

      // Check for exported members
      for (const exportDef of interfaceDef.exports) {
        if (exportDef.required) {
          // Simple check: look for the export name in the file
          const exportPattern = new RegExp(`(module\\.exports\\s*=|exports\\.${exportDef.name}|export\\s+(function|class|const)\\s+${exportDef.name})`, 'i');
          
          if (!exportPattern.test(implementationContent)) {
            mismatches.push({
              type: 'missing-export',
              interface: interfaceDef.name,
              export: exportDef.name,
              message: `Required export '${exportDef.name}' not found`
            });
          }
        }
      }
    }

    return {
      valid: mismatches.length === 0,
      mismatches
    };
  }

  /**
   * Detect breaking changes between two contract versions
   * @param {Object} oldContract - Old contract version
   * @param {Object} newContract - New contract version
   * @returns {Array<Object>} List of breaking changes
   */
  detectBreakingChanges(oldContract, newContract) {
    const breakingChanges = [];

    // Check for removed interfaces
    for (const oldInterface of oldContract.interfaces) {
      const newInterface = newContract.interfaces.find(i => i.name === oldInterface.name);
      
      if (!newInterface) {
        breakingChanges.push({
          type: 'interface-removed',
          interface: oldInterface.name,
          message: `Interface '${oldInterface.name}' was removed`
        });
        continue;
      }

      // Check for removed exports
      for (const oldExport of oldInterface.exports) {
        if (oldExport.required) {
          const newExport = newInterface.exports.find(e => e.name === oldExport.name);
          
          if (!newExport) {
            breakingChanges.push({
              type: 'export-removed',
              interface: oldInterface.name,
              export: oldExport.name,
              message: `Required export '${oldExport.name}' was removed`
            });
          } else if (oldExport.signature && newExport.signature && oldExport.signature !== newExport.signature) {
            breakingChanges.push({
              type: 'signature-changed',
              interface: oldInterface.name,
              export: oldExport.name,
              oldSignature: oldExport.signature,
              newSignature: newExport.signature,
              message: `Signature changed for '${oldExport.name}'`
            });
          }
        }
      }
    }

    return breakingChanges;
  }

  /**
   * Get all specs that consume a specific interface
   * @param {string} providerSpec - Spec that provides the interface
   * @param {string} interfaceName - Name of the interface
   * @returns {Promise<Array<string>>} List of consumer spec names
   */
  async getConsumers(providerSpec, interfaceName) {
    const allSpecs = await this.metadataManager.listAllMetadata();
    const consumers = [];

    const interfaceRef = `${providerSpec}/interfaces/${interfaceName}.json`;
    
    for (const { name, metadata } of allSpecs) {
      if (metadata.interfaces && metadata.interfaces.consumes) {
        if (metadata.interfaces.consumes.includes(interfaceRef)) {
          consumers.push(name);
        }
      }
    }

    return consumers;
  }

  /**
   * Validate contract structure
   * @param {Object} contract - Contract to validate
   * @throws {Error} If contract is invalid
   */
  _validateContract(contract) {
    if (!contract.version) {
      throw new Error('Contract must have a version');
    }

    if (!contract.spec) {
      throw new Error('Contract must specify the spec name');
    }

    if (!contract.interfaces || !Array.isArray(contract.interfaces)) {
      throw new Error('Contract must have an interfaces array');
    }

    for (const interfaceDef of contract.interfaces) {
      if (!interfaceDef.name) {
        throw new Error('Each interface must have a name');
      }

      if (!interfaceDef.type || !['class', 'function', 'module', 'object'].includes(interfaceDef.type)) {
        throw new Error(`Invalid interface type: ${interfaceDef.type}`);
      }

      if (!interfaceDef.exports || !Array.isArray(interfaceDef.exports)) {
        throw new Error(`Interface ${interfaceDef.name} must have an exports array`);
      }
    }
  }

  /**
   * Get contract file path
   * @param {string} specName - Name of the spec
   * @param {string} interfaceName - Name of the interface
   * @returns {string}
   */
  _getContractPath(specName, interfaceName) {
    const fileName = interfaceName.endsWith('.json') ? interfaceName : `${interfaceName}.json`;
    return path.join(this.specsDir, specName, 'interfaces', fileName);
  }

  /**
   * Convert string to kebab-case
   * @param {string} str
   * @returns {string}
   */
  _kebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}

module.exports = ContractManager;
