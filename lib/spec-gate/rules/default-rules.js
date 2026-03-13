const fs = require('fs-extra');
const path = require('path');
const docsCommand = require('../../commands/docs');
const { validateSpecDomainArtifacts } = require('../../spec/domain-modeling');

function createDefaultRules(projectPath = process.cwd()) {
  return [
    {
      id: 'mandatory',
      description: 'Verify mandatory Spec files exist',
      async execute(context) {
        const specPath = path.join(projectPath, '.sce', 'specs', context.specId);
        const requiredFiles = ['requirements.md', 'design.md', 'tasks.md'];
        const checks = await Promise.all(requiredFiles.map(async fileName => {
          const filePath = path.join(specPath, fileName);
          const exists = await fs.pathExists(filePath);
          return { fileName, exists };
        }));

        const missing = checks.filter(item => !item.exists).map(item => item.fileName);
        const passRatio = checks.filter(item => item.exists).length / requiredFiles.length;

        return {
          passed: missing.length === 0,
          ratio: passRatio,
          details: {
            requiredFiles,
            missing
          },
          warnings: missing.length > 0 ? [`Missing files: ${missing.join(', ')}`] : []
        };
      }
    },
    {
      id: 'tests',
      description: 'Verify tasks include explicit validation intent',
      async execute(context) {
        const tasksPath = path.join(projectPath, '.sce', 'specs', context.specId, 'tasks.md');
        if (!await fs.pathExists(tasksPath)) {
          return {
            passed: false,
            ratio: 0,
            details: { reason: 'tasks.md missing' },
            warnings: ['tasks.md missing']
          };
        }

        const content = await fs.readFile(tasksPath, 'utf8');
        const hasValidationHints = /验证|Validation|Acceptance/i.test(content);

        return {
          passed: hasValidationHints,
          ratio: hasValidationHints ? 1 : 0,
          details: {
            hasValidationHints
          },
          warnings: hasValidationHints ? [] : ['No validation markers found in tasks.md']
        };
      }
    },
    {
      id: 'docs',
      description: 'Validate document structure compatibility',
      async execute(context) {
        const exitCode = await docsCommand('validate', {
          spec: context.specId
        });

        return {
          passed: exitCode === 0,
          ratio: exitCode === 0 ? 1 : 0,
          details: {
            exitCode
          },
          warnings: exitCode === 0 ? [] : [`docs validate returned exit code ${exitCode}`]
        };
      }
    },
    {
      id: 'domain_scene_modeling',
      description: 'Verify mandatory problem-domain mind map and scene-spec artifacts',
      async execute(context) {
        return validateSpecDomainArtifacts(projectPath, context.specId, fs);
      }
    },
    {
      id: 'config_consistency',
      description: 'Verify project-level sce config baseline exists',
      async execute() {
        const sceDir = path.join(projectPath, '.sce');
        const configDir = path.join(sceDir, 'config');
        const hasSceDir = await fs.pathExists(sceDir);
        const hasConfig = await fs.pathExists(configDir);

        const ratio = hasSceDir && hasConfig ? 1 : hasSceDir ? 0.5 : 0;
        const warnings = [];
        if (!hasSceDir) {
          warnings.push('.sce directory missing');
        }
        if (hasSceDir && !hasConfig) {
          warnings.push('.sce/config directory missing');
        }

        return {
          passed: hasSceDir,
          ratio,
          details: {
            hasSceDir,
            hasConfig
          },
          warnings
        };
      }
    },
    {
      id: 'traceability',
      description: 'Verify requirement-design-task traceability hints',
      async execute(context) {
        const specPath = path.join(projectPath, '.sce', 'specs', context.specId);
        const designPath = path.join(specPath, 'design.md');
        const tasksPath = path.join(specPath, 'tasks.md');

        const hasDesign = await fs.pathExists(designPath);
        const hasTasks = await fs.pathExists(tasksPath);

        if (!hasDesign || !hasTasks) {
          return {
            passed: false,
            ratio: 0,
            details: {
              hasDesign,
              hasTasks
            },
            warnings: ['design.md or tasks.md missing']
          };
        }

        const [designContent, tasksContent] = await Promise.all([
          fs.readFile(designPath, 'utf8'),
          fs.readFile(tasksPath, 'utf8')
        ]);

        const hasMapping = /Mapping|映射|Requirement/i.test(designContent);
        const hasTaskReferences = /Requirement|Design|需求|设计/i.test(tasksContent);
        const scoreParts = [hasMapping, hasTaskReferences].filter(Boolean).length;

        return {
          passed: hasMapping && hasTaskReferences,
          ratio: scoreParts / 2,
          details: {
            hasMapping,
            hasTaskReferences
          },
          warnings: hasMapping && hasTaskReferences ? [] : ['Traceability links are incomplete']
        };
      }
    }
  ];
}

module.exports = {
  createDefaultRules
};

