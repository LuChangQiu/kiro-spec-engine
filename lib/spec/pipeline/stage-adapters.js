const fs = require('fs-extra');
const path = require('path');
const { runSpecBootstrap } = require('../../commands/spec-bootstrap');
const { runSpecGate } = require('../../commands/spec-gate');

function createDefaultStageAdapters(projectPath = process.cwd()) {
  return {
    requirements: async context => {
      const specDir = path.join(projectPath, '.kiro', 'specs', context.specId);
      const requirementsPath = path.join(specDir, 'requirements.md');

      if (!await fs.pathExists(requirementsPath)) {
        await runSpecBootstrap({
          name: context.specId,
          nonInteractive: true,
          profile: 'pipeline',
          dryRun: false,
          json: false
        }, {
          projectPath
        });

        return {
          success: true,
          details: {
            action: 'bootstrap-generated'
          }
        };
      }

      return {
        success: true,
        details: {
          action: 'requirements-existing'
        }
      };
    },

    design: async context => {
      const designPath = path.join(projectPath, '.kiro', 'specs', context.specId, 'design.md');
      const exists = await fs.pathExists(designPath);

      if (!exists) {
        await runSpecBootstrap({
          name: context.specId,
          nonInteractive: true,
          profile: 'pipeline',
          dryRun: false,
          json: false
        }, {
          projectPath
        });
      }

      return {
        success: true,
        warnings: exists ? [] : ['design.md was created from bootstrap defaults'],
        details: {
          action: exists ? 'design-existing' : 'design-generated'
        }
      };
    },

    tasks: async context => {
      const tasksPath = path.join(projectPath, '.kiro', 'specs', context.specId, 'tasks.md');
      const exists = await fs.pathExists(tasksPath);

      if (!exists) {
        await runSpecBootstrap({
          name: context.specId,
          nonInteractive: true,
          profile: 'pipeline',
          dryRun: false,
          json: false
        }, {
          projectPath
        });
      }

      return {
        success: true,
        warnings: exists ? [] : ['tasks.md was created from bootstrap defaults'],
        details: {
          action: exists ? 'tasks-existing' : 'tasks-generated'
        }
      };
    },

    gate: async context => {
      const gateResult = await runSpecGate({
        spec: context.specId,
        json: false,
        strict: !!context.strict,
        out: context.gateOut,
        silent: true
      }, {
        projectPath
      });

      const success = gateResult.decision === 'go' || gateResult.decision === 'conditional-go';

      return {
        success,
        warnings: gateResult.warnings ? gateResult.warnings.map(item => item.message) : [],
        details: {
          decision: gateResult.decision,
          score: gateResult.score,
          failed_checks: gateResult.failed_checks || []
        }
      };
    }
  };
}

module.exports = {
  createDefaultStageAdapters
};

