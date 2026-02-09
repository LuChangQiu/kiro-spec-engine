/**
 * Lock module exports
 * @module lib/lock
 */

const { LockManager, DEFAULT_TIMEOUT_HOURS } = require('./lock-manager');
const { MachineIdentifier } = require('./machine-identifier');
const { LockFile, LOCK_FILE_NAME, LOCK_VERSION } = require('./lock-file');

module.exports = {
  LockManager,
  MachineIdentifier,
  LockFile,
  DEFAULT_TIMEOUT_HOURS,
  LOCK_FILE_NAME,
  LOCK_VERSION
};
