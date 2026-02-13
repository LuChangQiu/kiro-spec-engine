const { STAGE_ORDER } = require('./constants');

class StageRunner {
  constructor(options = {}) {
    this.stateStore = options.stateStore;
    this.adapters = options.adapters || {};
  }

  async run(context) {
    const selectedStages = this._selectStages({
      fromStage: context.fromStage,
      toStage: context.toStage
    });

    const stageResults = [];

    for (const stageName of selectedStages) {
      if (context.resume && this._isCompleted(context.state, stageName)) {
        stageResults.push({
          name: stageName,
          status: 'skipped',
          reason: 'already-completed'
        });
        continue;
      }

      const adapter = this.adapters[stageName];
      if (typeof adapter !== 'function') {
        const error = `No adapter registered for stage: ${stageName}`;
        await this.stateStore.markStageResult(context.state, stageName, {
          status: 'failed',
          error
        });
        stageResults.push({ name: stageName, status: 'failed', error });
        return {
          status: 'failed',
          stageResults,
          failure: { stage: stageName, error }
        };
      }

      await this.stateStore.markStageStart(context.state, stageName);

      let adapterResult;
      try {
        adapterResult = context.dryRun
          ? { success: true, details: { dry_run: true }, warnings: [] }
          : await adapter(context);
      } catch (error) {
        adapterResult = {
          success: false,
          error: error.message,
          warnings: []
        };
      }

      const normalized = this._normalizeResult(adapterResult);
      const status = normalized.success ? (normalized.warnings.length > 0 ? 'warning' : 'completed') : 'failed';

      await this.stateStore.markStageResult(context.state, stageName, {
        status,
        warnings: normalized.warnings,
        error: normalized.error,
        output: normalized.details
      });

      stageResults.push({
        name: stageName,
        status,
        warnings: normalized.warnings,
        error: normalized.error,
        output: normalized.details
      });

      if (status === 'failed' && context.failFast) {
        return {
          status: 'failed',
          stageResults,
          failure: {
            stage: stageName,
            error: normalized.error || 'stage failed'
          }
        };
      }

      if (status === 'warning' && !context.continueOnWarning) {
        return {
          status: 'failed',
          stageResults,
          failure: {
            stage: stageName,
            error: 'warning encountered with continue-on-warning disabled'
          }
        };
      }
    }

    return {
      status: 'completed',
      stageResults,
      failure: null
    };
  }

  _selectStages(range = {}) {
    const fromStage = range.fromStage || STAGE_ORDER[0];
    const toStage = range.toStage || STAGE_ORDER[STAGE_ORDER.length - 1];

    const fromIndex = STAGE_ORDER.indexOf(fromStage);
    const toIndex = STAGE_ORDER.indexOf(toStage);

    if (fromIndex < 0 || toIndex < 0 || fromIndex > toIndex) {
      throw new Error(`Invalid stage range: from=${fromStage}, to=${toStage}`);
    }

    return STAGE_ORDER.slice(fromIndex, toIndex + 1);
  }

  _normalizeResult(result) {
    if (!result || typeof result !== 'object') {
      return {
        success: false,
        warnings: [],
        error: 'Invalid stage result',
        details: null
      };
    }

    return {
      success: !!result.success,
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      error: result.error || null,
      details: result.details || null
    };
  }

  _isCompleted(state, stageName) {
    const stage = (state.stages || []).find(item => item.name === stageName);
    return !!stage && stage.status === 'completed';
  }
}

module.exports = {
  StageRunner
};

