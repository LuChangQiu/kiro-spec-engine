/**
 * Orchestrator Module — Barrel Export
 *
 * Re-exports all orchestrator components for convenient consumption.
 */

const { OrchestratorConfig } = require('./orchestrator-config');
const { BootstrapPromptBuilder } = require('./bootstrap-prompt-builder');
const { AgentSpawner } = require('./agent-spawner');
const { StatusMonitor } = require('./status-monitor');
const { OrchestrationEngine } = require('./orchestration-engine');

module.exports = {
  OrchestratorConfig,
  BootstrapPromptBuilder,
  AgentSpawner,
  StatusMonitor,
  OrchestrationEngine,
};
