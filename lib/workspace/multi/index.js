/**
 * Multi-Workspace Management Module
 * 
 * Exports core components for multi-workspace functionality.
 * Part of Spec 16-00: Multi-Workspace Management.
 */

const Workspace = require('./workspace');
const WorkspaceRegistry = require('./workspace-registry');
const GlobalConfig = require('./global-config');
const WorkspaceContextResolver = require('./workspace-context-resolver');
const PathUtils = require('./path-utils');
const WorkspaceStateManager = require('./workspace-state-manager');

module.exports = {
  Workspace,
  WorkspaceRegistry,
  GlobalConfig,
  WorkspaceContextResolver,
  PathUtils,
  WorkspaceStateManager
};
