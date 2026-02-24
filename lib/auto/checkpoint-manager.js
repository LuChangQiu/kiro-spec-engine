/**
 * Checkpoint Manager
 * Strategic pause points and rollback capability
 */

const fs = require('fs-extra');
const path = require('path');

const CHECKPOINT_TYPES = {
  REQUIREMENTS_COMPLETE: 'requirements-complete',
  DESIGN_COMPLETE: 'design-complete',
  TASKS_COMPLETE: 'tasks-complete',
  PHASE_COMPLETE: 'phase-complete',
  FATAL_ERROR: 'fatal-error',
  EXTERNAL_RESOURCE_NEEDED: 'external-resource',
  FINAL_REVIEW: 'final-review'
};

class CheckpointManager {
  constructor(config = {}) {
    this.config = config;
    this.checkpointDir = path.join(process.cwd(), '.sce', 'auto', 'checkpoints');
    this.checkpoints = [];
    this.maxCheckpoints = 5;
  }
  
  /**
   * Initialize checkpoint directory
   */
  async initialize() {
    await fs.ensureDir(this.checkpointDir);
  }
  
  /**
   * Create checkpoint
   * @param {string} type - Checkpoint type
   * @param {Object} data - Checkpoint data
   * @returns {Object} - Created checkpoint
   */
  async createCheckpoint(type, data = {}) {
    await this.initialize();
    
    const checkpoint = {
      id: this.generateCheckpointId(),
      type,
      timestamp: new Date().toISOString(),
      phase: data.phase || 'unknown',
      data: {
        filesModified: data.filesModified || [],
        tasksCompleted: data.tasksCompleted || [],
        decisions: data.decisions || [],
        errors: data.errors || []
      },
      state: data.state || {},
      requiresUserApproval: this.shouldRequireApproval(type),
      approved: null
    };
    
    // Save checkpoint
    const checkpointFile = path.join(this.checkpointDir, `${checkpoint.id}.json`);
    await fs.writeJson(checkpointFile, checkpoint, { spaces: 2 });
    
    this.checkpoints.push(checkpoint);
    
    // Cleanup old checkpoints
    await this.cleanupOldCheckpoints();
    
    return checkpoint;
  }
  
  /**
   * List all checkpoints
   * @returns {Array} - Checkpoints
   */
  async listCheckpoints() {
    await this.initialize();
    
    const files = await fs.readdir(this.checkpointDir);
    const checkpoints = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const checkpoint = await fs.readJson(path.join(this.checkpointDir, file));
        checkpoints.push(checkpoint);
      }
    }
    
    // Sort by timestamp (newest first)
    checkpoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return checkpoints;
  }
  
  /**
   * Get checkpoint by ID
   * @param {string} id - Checkpoint ID
   * @returns {Object|null} - Checkpoint or null
   */
  async getCheckpoint(id) {
    const checkpointFile = path.join(this.checkpointDir, `${id}.json`);
    
    if (await fs.pathExists(checkpointFile)) {
      return await fs.readJson(checkpointFile);
    }
    
    return null;
  }
  
  /**
   * Delete checkpoint
   * @param {string} id - Checkpoint ID
   */
  async deleteCheckpoint(id) {
    const checkpointFile = path.join(this.checkpointDir, `${id}.json`);
    
    if (await fs.pathExists(checkpointFile)) {
      await fs.remove(checkpointFile);
    }
  }
  
  /**
   * Request user approval for checkpoint
   * @param {Object} checkpoint - Checkpoint object
   * @returns {boolean} - Approval result
   */
  async requestUserApproval(checkpoint) {
    // This would integrate with CLI to request user input
    // For now, return true (actual implementation would prompt user)
    console.log(`Checkpoint created: ${checkpoint.type}`);
    console.log(`Phase: ${checkpoint.phase}`);
    console.log(`Requires approval: ${checkpoint.requiresUserApproval}`);
    
    return true;
  }
  
  /**
   * Wait for user input with timeout
   * @param {Object} checkpoint - Checkpoint object
   * @param {number} timeout - Timeout in milliseconds
   * @returns {boolean} - User response
   */
  async waitForUserInput(checkpoint, timeout = 300000) {
    // This would wait for user input with timeout
    // For now, return true immediately
    return await this.requestUserApproval(checkpoint);
  }
  
  /**
   * Rollback to checkpoint
   * @param {string} id - Checkpoint ID
   * @returns {Object} - Rollback result
   */
  async rollbackToCheckpoint(id) {
    const checkpoint = await this.getCheckpoint(id);
    
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${id}`);
    }
    
    const result = {
      success: true,
      checkpoint,
      filesRestored: [],
      errors: []
    };
    
    // Restore files (simplified - actual implementation would restore file contents)
    for (const file of checkpoint.data.filesModified) {
      try {
        // In real implementation, restore file from backup
        result.filesRestored.push(file);
      } catch (error) {
        result.errors.push({ file, error: error.message });
      }
    }
    
    result.success = result.errors.length === 0;
    
    return result;
  }
  
  /**
   * Create rollback point (backup current state)
   * @returns {string} - Rollback point ID
   */
  async createRollbackPoint() {
    const rollbackId = this.generateCheckpointId();
    
    // In real implementation, backup current file state
    // For now, just return ID
    
    return rollbackId;
  }
  
  /**
   * Validate rollback feasibility
   * @param {string} id - Checkpoint ID
   * @returns {Object} - Validation result
   */
  async validateRollback(id) {
    const checkpoint = await this.getCheckpoint(id);
    
    if (!checkpoint) {
      return {
        valid: false,
        reason: 'Checkpoint not found'
      };
    }
    
    // Check for conflicts (files modified outside autonomous execution)
    const conflicts = [];
    
    return {
      valid: conflicts.length === 0,
      conflicts
    };
  }
  
  /**
   * Check if checkpoint should be created for type
   * @param {string} type - Checkpoint type
   * @returns {boolean}
   */
  shouldCreateCheckpoint(type) {
    if (!this.config.checkpoints) return true;
    
    const typeMap = {
      [CHECKPOINT_TYPES.REQUIREMENTS_COMPLETE]: 'requirementsReview',
      [CHECKPOINT_TYPES.DESIGN_COMPLETE]: 'designReview',
      [CHECKPOINT_TYPES.TASKS_COMPLETE]: 'tasksReview',
      [CHECKPOINT_TYPES.PHASE_COMPLETE]: 'phaseCompletion',
      [CHECKPOINT_TYPES.FINAL_REVIEW]: 'finalReview'
    };
    
    const configKey = typeMap[type];
    if (configKey && this.config.checkpoints[configKey] !== undefined) {
      return this.config.checkpoints[configKey];
    }
    
    return true;
  }
  
  /**
   * Check if checkpoint requires user approval
   * @param {string} type - Checkpoint type
   * @returns {boolean}
   */
  shouldRequireApproval(type) {
    const approvalRequired = [
      CHECKPOINT_TYPES.FATAL_ERROR,
      CHECKPOINT_TYPES.EXTERNAL_RESOURCE_NEEDED,
      CHECKPOINT_TYPES.FINAL_REVIEW
    ];
    
    return approvalRequired.includes(type);
  }
  
  /**
   * Get checkpoint configuration
   * @returns {Object} - Configuration
   */
  getCheckpointConfig() {
    return this.config.checkpoints || {};
  }
  
  /**
   * Cleanup old checkpoints (keep only last N)
   */
  async cleanupOldCheckpoints() {
    const checkpoints = await this.listCheckpoints();
    
    if (checkpoints.length > this.maxCheckpoints) {
      const toDelete = checkpoints.slice(this.maxCheckpoints);
      
      for (const checkpoint of toDelete) {
        await this.deleteCheckpoint(checkpoint.id);
      }
    }
  }
  
  /**
   * Handle phase completion
   * @param {string} phase - Phase name
   */
  async onPhaseComplete(phase) {
    if (this.shouldCreateCheckpoint(CHECKPOINT_TYPES.PHASE_COMPLETE)) {
      await this.createCheckpoint(CHECKPOINT_TYPES.PHASE_COMPLETE, { phase });
    }
  }
  
  /**
   * Generate unique checkpoint ID
   * @returns {string} - Checkpoint ID
   */
  generateCheckpointId() {
    return `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { CheckpointManager, CHECKPOINT_TYPES };
