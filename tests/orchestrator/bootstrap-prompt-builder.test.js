/**
 * BootstrapPromptBuilder Unit Tests
 *
 * Validates: Requirements 2.1-2.4
 * - 2.1: Prompt contains Spec path (.kiro/specs/{specName}/)
 * - 2.2: Prompt contains kse project norms and steering context
 * - 2.3: Prompt contains task execution instructions
 * - 2.4: Configurable template format via orchestrator.json
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { BootstrapPromptBuilder } = require('../../lib/orchestrator/bootstrap-prompt-builder');
const { OrchestratorConfig } = require('../../lib/orchestrator/orchestrator-config');

describe('BootstrapPromptBuilder', () => {
  let tempDir;
  let orchestratorConfig;
  let builder;

  beforeEach(() => {
    tempDir = path.join(
      os.tmpdir(),
      `kse-test-bpb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    fs.mkdirSync(tempDir, { recursive: true });
    orchestratorConfig = new OrchestratorConfig(tempDir);
    builder = new BootstrapPromptBuilder(tempDir, orchestratorConfig);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Create steering files in the temp workspace. */
  function createSteeringFiles(files = {}) {
    const steeringDir = path.join(tempDir, '.kiro', 'steering');
    fs.mkdirSync(steeringDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(steeringDir, name), content);
    }
  }

  /** Create a Spec directory with optional doc files. */
  function createSpecFiles(specName, docs = {}) {
    const specDir = path.join(tempDir, '.kiro', 'specs', specName);
    fs.mkdirSync(specDir, { recursive: true });
    for (const [name, content] of Object.entries(docs)) {
      fs.writeFileSync(path.join(specDir, name), content);
    }
  }

  /** Create a README.md in .kiro/ */
  function createReadme(content) {
    const kiroDir = path.join(tempDir, '.kiro');
    fs.mkdirSync(kiroDir, { recursive: true });
    fs.writeFileSync(path.join(kiroDir, 'README.md'), content);
  }

  /** Write a custom template file and configure orchestrator to use it. */
  async function setCustomTemplate(templateContent) {
    fs.writeFileSync(path.join(tempDir, 'custom-template.md'), templateContent);
    await orchestratorConfig.updateConfig({ bootstrapTemplate: 'custom-template.md' });
  }

  // ---------------------------------------------------------------------------
  // Default template generation
  // ---------------------------------------------------------------------------

  describe('default template generation', () => {
    test('generates a prompt with all required sections', async () => {
      createSteeringFiles({ 'CORE_PRINCIPLES.md': 'Core rules here' });
      createSpecFiles('my-spec', {
        'requirements.md': '# Requirements',
        'design.md': '# Design',
        'tasks.md': '# Tasks',
      });

      const prompt = await builder.buildPrompt('my-spec');

      // Should contain structural sections
      expect(prompt).toContain('# Bootstrap Prompt');
      expect(prompt).toContain('## Project Overview');
      expect(prompt).toContain('## Target Spec');
      expect(prompt).toContain('## Spec Documents');
      expect(prompt).toContain('## Steering Context');
      expect(prompt).toContain('## Task Execution Instructions');
    });

    test('includes README summary in project overview', async () => {
      createReadme('# kse Project\n\nSome overview text.\n\n---\n\nCapabilities\n\n---\n\nMore');

      const prompt = await builder.buildPrompt('any-spec');

      expect(prompt).toContain('# kse Project');
      expect(prompt).toContain('Some overview text.');
    });

    test('falls back to default summary when README is missing', async () => {
      const prompt = await builder.buildPrompt('any-spec');

      expect(prompt).toContain('kse (Kiro Spec Engine)');
    });
  });

  // ---------------------------------------------------------------------------
  // Spec path inclusion (Req 2.1)
  // ---------------------------------------------------------------------------

  describe('Spec path inclusion (Req 2.1)', () => {
    test('prompt contains the Spec path', async () => {
      const prompt = await builder.buildPrompt('96-00-agent-orchestrator');

      expect(prompt).toContain('.kiro/specs/96-00-agent-orchestrator/');
    });

    test('prompt contains the Spec name', async () => {
      const prompt = await builder.buildPrompt('my-feature');

      expect(prompt).toContain('my-feature');
    });

    test('includes Spec documents when they exist', async () => {
      createSpecFiles('test-spec', {
        'requirements.md': 'Requirement content here',
        'design.md': 'Design content here',
        'tasks.md': 'Task content here',
      });

      const prompt = await builder.buildPrompt('test-spec');

      expect(prompt).toContain('Requirement content here');
      expect(prompt).toContain('Design content here');
      expect(prompt).toContain('Task content here');
    });

    test('marks missing Spec documents as not found', async () => {
      // No spec files created
      const prompt = await builder.buildPrompt('nonexistent-spec');

      expect(prompt).toContain('(not found)');
    });
  });

  // ---------------------------------------------------------------------------
  // Steering context inclusion (Req 2.2)
  // ---------------------------------------------------------------------------

  describe('steering context inclusion (Req 2.2)', () => {
    test('includes all steering files when present', async () => {
      createSteeringFiles({
        'CORE_PRINCIPLES.md': 'Principle A',
        'ENVIRONMENT.md': 'Env config',
        'CURRENT_CONTEXT.md': 'Current state',
        'RULES_GUIDE.md': 'Rules index',
      });

      const prompt = await builder.buildPrompt('any-spec');

      expect(prompt).toContain('Principle A');
      expect(prompt).toContain('Env config');
      expect(prompt).toContain('Current state');
      expect(prompt).toContain('Rules index');
    });

    test('includes steering file names as headers', async () => {
      createSteeringFiles({
        'CORE_PRINCIPLES.md': 'content',
      });

      const prompt = await builder.buildPrompt('any-spec');

      expect(prompt).toContain('### CORE_PRINCIPLES.md');
    });

    test('silently skips missing steering files', async () => {
      // Only create one steering file
      createSteeringFiles({
        'CORE_PRINCIPLES.md': 'Only this one',
      });

      const prompt = await builder.buildPrompt('any-spec');

      expect(prompt).toContain('Only this one');
      // Should not throw or contain error messages about missing files
      expect(prompt).not.toContain('ENVIRONMENT.md');
    });

    test('works when no steering files exist', async () => {
      const prompt = await builder.buildPrompt('any-spec');

      // Should still produce a valid prompt
      expect(prompt).toContain('## Steering Context');
    });
  });

  // ---------------------------------------------------------------------------
  // Task execution instructions (Req 2.3)
  // ---------------------------------------------------------------------------

  describe('task execution instructions (Req 2.3)', () => {
    test('includes sub-agent role description', async () => {
      const prompt = await builder.buildPrompt('my-spec');

      expect(prompt).toContain('sub-agent responsible for executing the Spec "my-spec"');
    });

    test('includes step-by-step instructions', async () => {
      const prompt = await builder.buildPrompt('my-spec');

      expect(prompt).toContain('Read the task list');
      expect(prompt).toContain('Execute each task in order');
      expect(prompt).toContain('Mark each task as completed');
    });

    test('includes quality requirements', async () => {
      const prompt = await builder.buildPrompt('my-spec');

      expect(prompt).toContain('Quality requirements');
      expect(prompt).toContain('compile and pass linting');
      expect(prompt).toContain('must have tests');
    });

    test('references the correct tasks.md path', async () => {
      const prompt = await builder.buildPrompt('96-00-agent-orchestrator');

      expect(prompt).toContain('.kiro/specs/96-00-agent-orchestrator/tasks.md');
    });
  });

  // ---------------------------------------------------------------------------
  // Custom template (Req 2.4)
  // ---------------------------------------------------------------------------

  describe('custom template (Req 2.4)', () => {
    test('uses custom template when configured', async () => {
      createSteeringFiles({ 'CORE_PRINCIPLES.md': 'My principles' });
      await setCustomTemplate(
        'Spec: {{specName}}\nPath: {{specPath}}\nSteering: {{steeringContext}}\nInstructions: {{taskInstructions}}'
      );

      const prompt = await builder.buildPrompt('custom-spec');

      expect(prompt).toContain('Spec: custom-spec');
      expect(prompt).toContain('Path: .kiro/specs/custom-spec/');
      expect(prompt).toContain('Steering:');
      expect(prompt).toContain('My principles');
      expect(prompt).toContain('Instructions:');
    });

    test('replaces all placeholder occurrences', async () => {
      await setCustomTemplate('{{specName}} is {{specName}}');

      const prompt = await builder.buildPrompt('double-spec');

      expect(prompt).toBe('double-spec is double-spec');
    });

    test('preserves literal text in custom template', async () => {
      await setCustomTemplate('HEADER\n{{specName}}\nFOOTER');

      const prompt = await builder.buildPrompt('test');

      expect(prompt).toContain('HEADER');
      expect(prompt).toContain('FOOTER');
    });

    test('falls back to default template when custom template file is missing', async () => {
      // Configure a template path that doesn't exist
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
        bootstrapTemplate: 'nonexistent-template.md',
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const prompt = await builder.buildPrompt('fallback-spec');

      // Should use default template (contains structural sections)
      expect(prompt).toContain('# Bootstrap Prompt');
      expect(prompt).toContain('fallback-spec');
      warnSpy.mockRestore();
    });

    test('custom template does not include Spec documents or README', async () => {
      createSpecFiles('isolated-spec', { 'requirements.md': 'SECRET_REQ' });
      createReadme('SECRET_README');
      await setCustomTemplate('Only: {{specName}} at {{specPath}}');

      const prompt = await builder.buildPrompt('isolated-spec');

      // Custom template only renders the 4 placeholders
      expect(prompt).toBe('Only: isolated-spec at .kiro/specs/isolated-spec/');
      expect(prompt).not.toContain('SECRET_REQ');
      expect(prompt).not.toContain('SECRET_README');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles Spec name with special characters', async () => {
      const prompt = await builder.buildPrompt('01-00-my-feature');

      expect(prompt).toContain('.kiro/specs/01-00-my-feature/');
      expect(prompt).toContain('"01-00-my-feature"');
    });

    test('trims whitespace from steering file content', async () => {
      createSteeringFiles({
        'CORE_PRINCIPLES.md': '  \n  Trimmed content  \n  ',
      });

      const prompt = await builder.buildPrompt('any-spec');

      expect(prompt).toContain('Trimmed content');
      // Should not have leading/trailing whitespace in the section
      expect(prompt).toContain('### CORE_PRINCIPLES.md\n\nTrimmed content');
    });

    test('README summary stops at second separator', async () => {
      createReadme(
        'Line 1\n---\nLine 2\n---\nLine 3 should not appear'
      );

      const prompt = await builder.buildPrompt('any-spec');

      expect(prompt).toContain('Line 1');
      expect(prompt).toContain('Line 2');
      expect(prompt).not.toContain('Line 3 should not appear');
    });
  });
});
