/**
 * MachineIdentifier - Provides unique machine identification for lock ownership
 * @module lib/lock/machine-identifier
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class MachineIdentifier {
  /**
   * @param {string} configDir - Directory for storing machine ID
   */
  constructor(configDir) {
    this.configDir = configDir;
    this.configFile = path.join(configDir, 'machine-id.json');
    this._cachedId = null;
  }

  /**
   * Get the current machine's identifier
   * @returns {Promise<MachineId>}
   */
  async getMachineId() {
    if (this._cachedId) {
      return this._cachedId;
    }

    try {
      const data = await fs.readFile(this.configFile, 'utf8');
      const machineId = JSON.parse(data);
      if (this._isValidMachineId(machineId)) {
        this._cachedId = machineId;
        return machineId;
      }
    } catch (error) {
      // File doesn't exist or is corrupted, generate new ID
    }

    const newId = this.generateMachineId();
    await this._persistMachineId(newId);
    this._cachedId = newId;
    return newId;
  }

  /**
   * Generate a new machine ID
   * @returns {MachineId}
   */
  generateMachineId() {
    const hostname = this._getHostname();
    const uuid = crypto.randomUUID();
    
    return {
      id: `${hostname}-${uuid}`,
      hostname: hostname,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Get human-readable machine info
   * @returns {Promise<MachineInfo>}
   */
  async getMachineInfo() {
    const machineId = await this.getMachineId();
    return {
      id: machineId.id,
      hostname: machineId.hostname,
      createdAt: machineId.createdAt,
      platform: os.platform(),
      user: this._getUsername()
    };
  }

  /**
   * Get hostname safely
   * @returns {string}
   * @private
   */
  _getHostname() {
    try {
      return os.hostname() || 'unknown-host';
    } catch {
      return 'unknown-host';
    }
  }

  /**
   * Get username safely
   * @returns {string}
   * @private
   */
  _getUsername() {
    try {
      return os.userInfo().username || process.env.USER || process.env.USERNAME || 'unknown-user';
    } catch {
      return process.env.USER || process.env.USERNAME || 'unknown-user';
    }
  }

  /**
   * Validate machine ID structure
   * @param {Object} machineId
   * @returns {boolean}
   * @private
   */
  _isValidMachineId(machineId) {
    return (
      machineId &&
      typeof machineId.id === 'string' &&
      typeof machineId.hostname === 'string' &&
      typeof machineId.createdAt === 'string' &&
      machineId.id.length > 0
    );
  }

  /**
   * Persist machine ID to config file
   * @param {MachineId} machineId
   * @returns {Promise<void>}
   * @private
   */
  async _persistMachineId(machineId) {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      await fs.writeFile(this.configFile, JSON.stringify(machineId, null, 2), 'utf8');
    } catch (error) {
      console.warn(`Warning: Could not persist machine ID: ${error.message}`);
    }
  }
}

module.exports = { MachineIdentifier };
