/**
 * Error thrown when configuration operations fail
 */
class ConfigError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ConfigError';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ConfigError;
