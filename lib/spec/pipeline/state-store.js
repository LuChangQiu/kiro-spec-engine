const fs = require('fs-extra');
const path = require('path');
const { randomUUID } = require('crypto');

class PipelineStateStore {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
  }

  getStateDir(specId) {
    return path.join(this.projectPath, '.sce', 'state', 'spec-pipeline', specId);
  }

  getRunPath(specId, runId) {
    return path.join(this.getStateDir(specId), `${runId}.json`);
  }

  getLatestPath(specId) {
    return path.join(this.getStateDir(specId), 'latest.json');
  }

  async create(specId, options = {}) {
    const runId = options.runId || randomUUID();
    const state = {
      spec_id: specId,
      run_id: runId,
      status: 'running',
      strategy: {
        fail_fast: options.failFast !== false,
        continue_on_warning: !!options.continueOnWarning
      },
      stages: [],
      started_at: new Date().toISOString(),
      ended_at: null
    };

    await this.save(state);
    return state;
  }

  async save(state) {
    const runPath = this.getRunPath(state.spec_id, state.run_id);
    const latestPath = this.getLatestPath(state.spec_id);

    await fs.ensureDir(path.dirname(runPath));
    await fs.writeJson(runPath, state, { spaces: 2 });
    await fs.writeJson(latestPath, {
      spec_id: state.spec_id,
      run_id: state.run_id,
      updated_at: new Date().toISOString()
    }, { spaces: 2 });

    return runPath;
  }

  async loadLatest(specId) {
    const latestPath = this.getLatestPath(specId);
    if (!await fs.pathExists(latestPath)) {
      return null;
    }

    const latest = await fs.readJson(latestPath);
    const runPath = this.getRunPath(specId, latest.run_id);
    if (!await fs.pathExists(runPath)) {
      return null;
    }

    return fs.readJson(runPath);
  }

  async markStageStart(state, stageName) {
    const stage = this._getOrCreateStage(state, stageName);
    stage.status = 'running';
    stage.started_at = new Date().toISOString();
    stage.ended_at = null;
    stage.error = null;
    stage.warnings = [];

    await this.save(state);
  }

  async markStageResult(state, stageName, result) {
    const stage = this._getOrCreateStage(state, stageName);
    stage.status = result.status;
    stage.ended_at = new Date().toISOString();
    stage.error = result.error || null;
    stage.warnings = result.warnings || [];
    stage.output = result.output || null;

    await this.save(state);
  }

  async markFinished(state, status) {
    state.status = status;
    state.ended_at = new Date().toISOString();
    await this.save(state);
  }

  _getOrCreateStage(state, stageName) {
    let stage = state.stages.find(item => item.name === stageName);
    if (!stage) {
      stage = {
        name: stageName,
        status: 'pending',
        started_at: null,
        ended_at: null,
        warnings: []
      };
      state.stages.push(stage);
    }

    return stage;
  }
}

module.exports = {
  PipelineStateStore
};

