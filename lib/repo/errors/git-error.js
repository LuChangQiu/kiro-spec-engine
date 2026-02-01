/**
 * Error thrown when Git operations fail
 */
class GitError extends Error {
  constructor(message, command = null, exitCode = null, details = null) {
    super(message);
    this.name = 'GitError';
    this.command = command;
    this.exitCode = exitCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = GitError;
