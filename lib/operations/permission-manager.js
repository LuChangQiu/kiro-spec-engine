/**
 * Permission Manager
 * 
 * Manages AI operation permissions and takeover levels
 */

const fs = require('fs-extra');
const path = require('path');
const { TakeoverLevel, SecurityEnvironment } = require('./models');

// Default environment policies
const DEFAULT_POLICIES = {
  [SecurityEnvironment.DEVELOPMENT]: {
    maxTakeoverLevel: TakeoverLevel.L5_FULLY_AUTONOMOUS,
    defaultLevel: TakeoverLevel.L3_SEMI_AUTO
  },
  [SecurityEnvironment.TEST]: {
    maxTakeoverLevel: TakeoverLevel.L4_AUTO,
    defaultLevel: TakeoverLevel.L2_SUGGESTION
  },
  [SecurityEnvironment.PRE_PRODUCTION]: {
    maxTakeoverLevel: TakeoverLevel.L3_SEMI_AUTO,
    defaultLevel: TakeoverLevel.L2_SUGGESTION
  },
  [SecurityEnvironment.PRODUCTION]: {
    maxTakeoverLevel: TakeoverLevel.L2_SUGGESTION,
    defaultLevel: TakeoverLevel.L1_OBSERVATION
  }
};

class PermissionManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
  }
  
  /**
   * Get takeover level for project and environment
   * 
   * @param {string} project - Project name
   * @param {string} environment - Security environment
   * @returns {Promise<string>} Current takeover level
   */
  async getTakeoverLevel(project, environment) {
    const config = await this.loadPermissionConfig(project);
    
    if (config.environments && config.environments[environment]) {
      return config.environments[environment].takeoverLevel;
    }
    
    // Return default for environment
    return DEFAULT_POLICIES[environment].defaultLevel;
  }
  
  /**
   * Set takeover level for project and environment
   * 
   * @param {string} project - Project name
   * @param {string} environment - Security environment
   * @param {string} level - New takeover level
   * @param {string} reason - Reason for change
   * @param {string} user - User making the change
   * @returns {Promise<void>}
   */
  async setTakeoverLevel(project, environment, level, reason, user) {
    const config = await this.loadPermissionConfig(project);
    
    // Validate level against environment policy
    const policy = DEFAULT_POLICIES[environment];
    if (!this.isLevelAllowed(level, policy.maxTakeoverLevel)) {
      throw new Error(`Level ${level} exceeds maximum ${policy.maxTakeoverLevel} for ${environment}`);
    }
    
    // Initialize environments if needed
    if (!config.environments) {
      config.environments = {};
    }
    
    if (!config.environments[environment]) {
      config.environments[environment] = {};
    }
    
    const oldLevel = config.environments[environment].takeoverLevel || policy.defaultLevel;
    
    // Update level
    config.environments[environment].takeoverLevel = level;
    config.environments[environment].maxLevel = policy.maxTakeoverLevel;
    
    // Record history
    if (!config.levelHistory) {
      config.levelHistory = [];
    }
    
    config.levelHistory.push({
      timestamp: new Date().toISOString(),
      environment,
      fromLevel: oldLevel,
      toLevel: level,
      reason,
      user
    });
    
    // Save config
    await this.savePermissionConfig(project, config);
  }
  
  /**
   * Check if operation is permitted
   * 
   * @param {string} project - Project name
   * @param {string} environment - Security environment
   * @param {string} operationType - Type of operation
   * @returns {Promise<Object>} Permission result
   */
  async checkPermission(project, environment, operationType) {
    const level = await this.getTakeoverLevel(project, environment);
    const policy = DEFAULT_POLICIES[environment];
    
    return {
      authorized: true,  // Simplified for MVP
      level,
      environment,
      requiresApproval: level === TakeoverLevel.L1_OBSERVATION || level === TakeoverLevel.L2_SUGGESTION
    };
  }
  
  /**
   * Load permission configuration
   * 
   * @param {string} project - Project name
   * @returns {Promise<Object>} Permission config
   */
  async loadPermissionConfig(project) {
    const configPath = path.join(
      this.projectRoot,
      '.kiro/specs',
      project,
      'operations/permissions.json'
    );
    
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }
    
    // Return default config
    return {
      project,
      environments: {}
    };
  }
  
  /**
   * Save permission configuration
   * 
   * @param {string} project - Project name
   * @param {Object} config - Permission config
   * @returns {Promise<void>}
   */
  async savePermissionConfig(project, config) {
    const configPath = path.join(
      this.projectRoot,
      '.kiro/specs',
      project,
      'operations/permissions.json'
    );
    
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, config, { spaces: 2 });
  }
  
  /**
   * Check if level is allowed
   * 
   * @param {string} level - Requested level
   * @param {string} maxLevel - Maximum allowed level
   * @returns {boolean} Whether level is allowed
   */
  isLevelAllowed(level, maxLevel) {
    const levels = Object.values(TakeoverLevel);
    const levelIndex = levels.indexOf(level);
    const maxIndex = levels.indexOf(maxLevel);
    
    return levelIndex <= maxIndex;
  }

  /**
   * Request permission elevation
   * 
   * @param {string} operation - Operation requiring elevation
   * @param {string} project - Project name
   * @param {string} environment - Security environment
   * @param {string} reason - Reason for elevation request
   * @param {string} user - User requesting elevation
   * @returns {Promise<Object>} Elevation result
   */
  async requestElevation(operation, project, environment, reason, user = 'system') {
    const config = await this.loadPermissionConfig(project);
    const currentLevel = await this.getTakeoverLevel(project, environment);
    
    // Create elevation request
    const request = {
      id: `elev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      project,
      environment,
      currentLevel,
      reason,
      requestedBy: user,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      outcome: null,
      approvedBy: null,
      approvedAt: null
    };
    
    // Initialize elevation requests array
    if (!config.elevationRequests) {
      config.elevationRequests = [];
    }
    
    // Add request
    config.elevationRequests.push(request);
    
    // Save config
    await this.savePermissionConfig(project, config);
    
    return {
      success: true,
      requestId: request.id,
      status: 'pending',
      message: 'Elevation request created. Awaiting approval.',
      request
    };
  }

  /**
   * Approve elevation request
   * 
   * @param {string} project - Project name
   * @param {string} requestId - Elevation request ID
   * @param {string} approver - User approving the request
   * @returns {Promise<Object>} Approval result
   */
  async approveElevation(project, requestId, approver) {
    const config = await this.loadPermissionConfig(project);
    
    if (!config.elevationRequests) {
      throw new Error('No elevation requests found');
    }
    
    const request = config.elevationRequests.find(r => r.id === requestId);
    
    if (!request) {
      throw new Error(`Elevation request not found: ${requestId}`);
    }
    
    if (request.status !== 'pending') {
      throw new Error(`Elevation request already ${request.status}`);
    }
    
    // Update request
    request.status = 'approved';
    request.outcome = 'approved';
    request.approvedBy = approver;
    request.approvedAt = new Date().toISOString();
    
    // Save config
    await this.savePermissionConfig(project, config);
    
    return {
      success: true,
      requestId,
      status: 'approved',
      message: 'Elevation request approved',
      request
    };
  }

  /**
   * Deny elevation request
   * 
   * @param {string} project - Project name
   * @param {string} requestId - Elevation request ID
   * @param {string} denier - User denying the request
   * @param {string} reason - Reason for denial
   * @returns {Promise<Object>} Denial result
   */
  async denyElevation(project, requestId, denier, reason) {
    const config = await this.loadPermissionConfig(project);
    
    if (!config.elevationRequests) {
      throw new Error('No elevation requests found');
    }
    
    const request = config.elevationRequests.find(r => r.id === requestId);
    
    if (!request) {
      throw new Error(`Elevation request not found: ${requestId}`);
    }
    
    if (request.status !== 'pending') {
      throw new Error(`Elevation request already ${request.status}`);
    }
    
    // Update request
    request.status = 'denied';
    request.outcome = 'denied';
    request.deniedBy = denier;
    request.deniedAt = new Date().toISOString();
    request.denialReason = reason;
    
    // Save config
    await this.savePermissionConfig(project, config);
    
    return {
      success: true,
      requestId,
      status: 'denied',
      message: 'Elevation request denied',
      request
    };
  }

  /**
   * List elevation requests
   * 
   * @param {string} project - Project name
   * @param {Object} filters - Filter criteria
   * @param {string} filters.status - Filter by status
   * @param {string} filters.environment - Filter by environment
   * @returns {Promise<Array>} Array of elevation requests
   */
  async listElevationRequests(project, filters = {}) {
    const config = await this.loadPermissionConfig(project);
    
    if (!config.elevationRequests) {
      return [];
    }
    
    let requests = config.elevationRequests;
    
    // Apply filters
    if (filters.status) {
      requests = requests.filter(r => r.status === filters.status);
    }
    
    if (filters.environment) {
      requests = requests.filter(r => r.environment === filters.environment);
    }
    
    return requests;
  }
}

module.exports = PermissionManager;
