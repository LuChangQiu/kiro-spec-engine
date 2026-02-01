/**
 * Error thrown when repository operations fail
 */
class RepoError extends Error {
  constructor(message, repoName = null, details = null) {
    super(message);
    this.name = 'RepoError';
    this.repoName = repoName;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = RepoError;
