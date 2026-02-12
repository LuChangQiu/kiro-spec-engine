/**
 * Bootstrap Prompt Builder
 *
 * Builds the initial prompt injected into each Codex CLI sub-agent so that it
 * has full context about the target Spec, kse conventions, steering rules, and
 * clear task-execution instructions.
 *
 * Requirements: 2.1 (Spec path), 2.2 (kse / steering context),
 *               2.3 (task execution instructions), 2.4 (configurable template)
 */

const path = require('path');
const fs = require('fs-extra');

// Steering files loaded into every prompt (order matters for readability)
const STEERING_FILES = [
  'CORE_PRINCIPLES.md',
  'ENVIRONMENT.md',
  'CURRENT_CONTEXT.md',
  'RULES_GUIDE.md',
];

class BootstrapPromptBuilder {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   * @param {import('./orchestrator-config').OrchestratorConfig} orchestratorConfig
   */
  constructor(workspaceRoot, orchestratorConfig) {
    this._workspaceRoot = workspaceRoot;
    this._orchestratorConfig = orchestratorConfig;
  }

  /**
   * Build the bootstrap prompt for a given Spec.
   *
   * When a custom template is configured (via orchestrator.json bootstrapTemplate),
   * the template is loaded and placeholders are replaced:
   *   {{specName}}          – the Spec name
   *   {{specPath}}          – relative path to the Spec directory
   *   {{steeringContext}}   – concatenated steering file contents
   *   {{taskInstructions}}  – task execution instructions block
   *
   * Otherwise a sensible built-in default template is used.
   *
   * @param {string} specName - Name of the Spec (e.g. "96-00-agent-orchestrator")
   * @returns {Promise<string>} The assembled prompt
   */
  async buildPrompt(specName) {
    const specPath = `.kiro/specs/${specName}/`;
    const steeringContext = await this._loadSteeringContext();
    const taskInstructions = this._buildTaskInstructions(specName, specPath);
    const readmeSummary = await this._loadReadmeSummary();
    const specContext = await this._loadSpecContext(specPath);

    const customTemplate = await this._orchestratorConfig.getBootstrapTemplate();

    if (customTemplate) {
      return this._renderTemplate(customTemplate, {
        specName,
        specPath,
        steeringContext,
        taskInstructions,
      });
    }

    return this._buildDefaultPrompt({
      specName,
      specPath,
      readmeSummary,
      specContext,
      steeringContext,
      taskInstructions,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Load and concatenate all steering files from `.kiro/steering/`.
   * Missing files are silently skipped.
   * @returns {Promise<string>}
   * @private
   */
  async _loadSteeringContext() {
    const steeringDir = path.join(this._workspaceRoot, '.kiro', 'steering');
    const sections = [];

    for (const filename of STEERING_FILES) {
      const filePath = path.join(steeringDir, filename);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        sections.push(`### ${filename}\n\n${content.trim()}`);
      } catch (_err) {
        // Steering file missing — skip silently
      }
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Load a short summary from `.kiro/README.md`.
   * Returns the first ~40 lines (up to the first `---` separator after the
   * opening block) to keep the prompt concise.
   * @returns {Promise<string>}
   * @private
   */
  async _loadReadmeSummary() {
    const readmePath = path.join(this._workspaceRoot, '.kiro', 'README.md');
    try {
      const content = await fs.readFile(readmePath, 'utf8');
      // Take the first meaningful section (up to the capabilities list)
      const lines = content.split('\n');
      const summaryLines = [];
      let separatorCount = 0;
      for (const line of lines) {
        if (line.trim() === '---') {
          separatorCount++;
          if (separatorCount >= 2) break; // stop after second separator
        }
        summaryLines.push(line);
      }
      return summaryLines.join('\n').trim();
    } catch (_err) {
      return 'kse (Kiro Spec Engine) — Spec-driven development project.';
    }
  }

  /**
   * Load the Spec's own documents (requirements.md, design.md, tasks.md).
   * Missing files are noted but do not cause failure.
   * @param {string} specPath - Relative Spec directory path
   * @returns {Promise<string>}
   * @private
   */
  async _loadSpecContext(specPath) {
    const specDir = path.join(this._workspaceRoot, specPath);
    const docs = ['requirements.md', 'design.md', 'tasks.md'];
    const sections = [];

    for (const doc of docs) {
      const filePath = path.join(specDir, doc);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        sections.push(`#### ${doc}\n\n${content.trim()}`);
      } catch (_err) {
        sections.push(`#### ${doc}\n\n(not found)`);
      }
    }

    return sections.join('\n\n');
  }

  /**
   * Build the task-execution instruction block.
   * @param {string} specName
   * @param {string} specPath
   * @returns {string}
   * @private
   */
  _buildTaskInstructions(specName, specPath) {
    return [
      `You are a sub-agent responsible for executing the Spec "${specName}".`,
      '',
      'Instructions:',
      `1. Read the task list at \`${specPath}tasks.md\`.`,
      '2. Execute each task in order, starting from the first uncompleted task.',
      '3. For each task, read the corresponding requirements and design sections.',
      '4. Write all required code, tests, and documentation.',
      '5. Mark each task as completed (change `[ ]` or `[-]` to `[x]`) after finishing.',
      '6. Run relevant tests to verify your implementation before moving on.',
      '7. If a task fails after multiple attempts, document the issue and continue.',
      '',
      'Quality requirements:',
      '- All code must compile and pass linting.',
      '- All new functionality must have tests.',
      '- Follow existing code patterns and conventions.',
      '- Do not break existing tests.',
    ].join('\n');
  }

  /**
   * Assemble the default (built-in) prompt from its constituent parts.
   * @param {object} parts
   * @returns {string}
   * @private
   */
  _buildDefaultPrompt({ specName, specPath, readmeSummary, specContext, steeringContext, taskInstructions }) {
    const sections = [
      '# Bootstrap Prompt',
      '',
      '## Project Overview',
      '',
      readmeSummary,
      '',
      '## Target Spec',
      '',
      `**Spec**: ${specName}`,
      `**Path**: \`${specPath}\``,
      '',
      '## Spec Documents',
      '',
      specContext,
      '',
      '## Steering Context (Project Rules)',
      '',
      steeringContext,
      '',
      '## Task Execution Instructions',
      '',
      taskInstructions,
    ];

    return sections.join('\n');
  }

  /**
   * Render a custom template by replacing `{{placeholder}}` tokens.
   * @param {string} template
   * @param {object} vars - { specName, specPath, steeringContext, taskInstructions }
   * @returns {string}
   * @private
   */
  _renderTemplate(template, vars) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      // Replace all occurrences of {{key}}
      result = result.split(`{{${key}}}`).join(value);
    }
    return result;
  }
}

module.exports = { BootstrapPromptBuilder };
