/**
 * Collab module exports
 * @module lib/collab
 */

const { AgentRegistry } = require('./agent-registry');
const { Coordinator } = require('./coordinator');
const { MergeCoordinator } = require('./merge-coordinator');
const { MultiAgentConfig } = require('./multi-agent-config');

module.exports = {
  AgentRegistry,
  Coordinator,
  MergeCoordinator,
  MultiAgentConfig
};
