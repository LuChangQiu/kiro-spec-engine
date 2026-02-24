/**
 * State Manager for Autonomous Execution
 * Handles persistence and loading of autonomous execution state
 */

const fs = require('fs-extra');
const path = require('path');

class StateManager {
  constructor(specName) {
    this.specName = specName;
    this.stateDir = path.join(process.cwd(), '.sce', 'auto');
    this.stateFile = path.join(this.stateDir, `${specName}-state.json`);
  }
  
  /**
   * Initialize state directory
   */
  async initialize() {
    await fs.ensureDir(this.stateDir);
  }
  
  /**
   * Save execution state
   * @param {Object} state - State to save
   */
  async saveState(state) {
    await this.initialize();
    
    const stateWithMetadata = {
      ...state,
      version: '1.0.0',
      specName: this.specName,
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeJson(this.stateFile, stateWithMetadata, { spaces: 2 });
  }
  
  /**
   * Load execution state
   * @returns {Object|null} - Loaded state or null if not found
   */
  async loadState() {
    try {
      if (await fs.pathExists(this.stateFile)) {
        return await fs.readJson(this.stateFile);
      }
      return null;
    } catch (error) {
      console.error(`Failed to load state: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Check if state exists
   * @returns {boolean}
   */
  async hasState() {
    return await fs.pathExists(this.stateFile);
  }
  
  /**
   * Clear execution state
   */
  async clearState() {
    if (await fs.pathExists(this.stateFile)) {
      await fs.remove(this.stateFile);
    }
  }
  
  /**
   * Create initial state
   * @param {Object} options - Initial state options
   * @returns {Object} - Initial state
   */
  createInitialState(options = {}) {
    return {
      status: {
        phase: 'initialization',
        isRunning: false,
        isPaused: false,
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      
      taskQueue: {
        tasks: [],
        currentTask: null,
        completedCount: 0,
        failedCount: 0
      },
      
      progress: {
        overallProgress: 0,
        phaseProgress: {
          requirements: 0,
          design: 0,
          tasks: 0,
          implementation: 0,
          qa: 0
        },
        estimatedCompletion: null
      },
      
      errors: {
        total: 0,
        resolved: 0,
        unresolved: []
      },
      
      checkpoints: {
        latest: null,
        history: []
      },
      
      decisions: [],
      executionLog: [],
      
      config: options.config || {}
    };
  }
}

module.exports = StateManager;
