/**
 * Property 2: Bootstrap Prompt 包含所有必要上下文
 *
 * *对于任何* Spec 名称，BootstrapPromptBuilder 生成的 prompt 应同时包含：
 * 该 Spec 的路径（`.kiro/specs/{specName}/`）、sce 项目规范/steering 上下文引用、
 * 以及任务执行指令。
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */

const fc = require('fast-check');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { BootstrapPromptBuilder } = require('../../lib/orchestrator/bootstrap-prompt-builder');
const { OrchestratorConfig } = require('../../lib/orchestrator/orchestrator-config');

// --- Arbitraries ---

/**
 * Generate valid kebab-case Spec names: starts with a lowercase letter,
 * followed by lowercase alphanumeric characters and hyphens, 1-50 chars total.
 */
const arbSpecName = fc.stringMatching(/^[a-z][a-z0-9-]{0,49}$/).filter((s) => s.length >= 1);

// --- Helpers ---

let tempCounter = 0;

function createTempDir() {
  const dir = path.join(
    os.tmpdir(),
    `sce-pbt-bpb-${Date.now()}-${++tempCounter}-${Math.random().toString(36).substr(2, 6)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createSteeringFiles(tempDir) {
  const steeringDir = path.join(tempDir, '.kiro', 'steering');
  fs.mkdirSync(steeringDir, { recursive: true });
  fs.writeFileSync(path.join(steeringDir, 'CORE_PRINCIPLES.md'), 'Core principles content');
  fs.writeFileSync(path.join(steeringDir, 'ENVIRONMENT.md'), 'Environment content');
  fs.writeFileSync(path.join(steeringDir, 'CURRENT_CONTEXT.md'), 'Current context content');
  fs.writeFileSync(path.join(steeringDir, 'RULES_GUIDE.md'), 'Rules guide content');
}

// --- Property Tests ---

describe('Property 2: Bootstrap Prompt 完整性 (Bootstrap Prompt Completeness)', () => {

  test('prompt contains the Spec path for any valid Spec name (Req 2.1)', async () => {
    await fc.assert(
      fc.asyncProperty(arbSpecName, async (specName) => {
        const tempDir = createTempDir();
        try {
          createSteeringFiles(tempDir);
          const config = new OrchestratorConfig(tempDir);
          const builder = new BootstrapPromptBuilder(tempDir, config);

          const prompt = await builder.buildPrompt(specName);
          const expectedPath = `.kiro/specs/${specName}/`;

          expect(prompt).toContain(expectedPath);
        } finally {
          fs.removeSync(tempDir);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('prompt contains sce steering context references for any valid Spec name (Req 2.2)', async () => {
    await fc.assert(
      fc.asyncProperty(arbSpecName, async (specName) => {
        const tempDir = createTempDir();
        try {
          createSteeringFiles(tempDir);
          const config = new OrchestratorConfig(tempDir);
          const builder = new BootstrapPromptBuilder(tempDir, config);

          const prompt = await builder.buildPrompt(specName);

          // Prompt must reference steering context section
          expect(prompt).toContain('Steering Context');
          // Prompt must include actual steering file content
          expect(prompt).toContain('Core principles content');
          expect(prompt).toContain('CORE_PRINCIPLES.md');
        } finally {
          fs.removeSync(tempDir);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('prompt contains task execution instructions for any valid Spec name (Req 2.3)', async () => {
    await fc.assert(
      fc.asyncProperty(arbSpecName, async (specName) => {
        const tempDir = createTempDir();
        try {
          createSteeringFiles(tempDir);
          const config = new OrchestratorConfig(tempDir);
          const builder = new BootstrapPromptBuilder(tempDir, config);

          const prompt = await builder.buildPrompt(specName);

          // Must contain sub-agent role description referencing the spec
          expect(prompt).toContain('sub-agent responsible for executing the Spec');
          // Must contain task reading instruction
          expect(prompt).toContain('Read the task list');
          // Must contain sequential execution instruction
          expect(prompt).toContain('Execute each task in order');
        } finally {
          fs.removeSync(tempDir);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('prompt simultaneously contains all three required elements for any valid Spec name', async () => {
    await fc.assert(
      fc.asyncProperty(arbSpecName, async (specName) => {
        const tempDir = createTempDir();
        try {
          createSteeringFiles(tempDir);
          const config = new OrchestratorConfig(tempDir);
          const builder = new BootstrapPromptBuilder(tempDir, config);

          const prompt = await builder.buildPrompt(specName);

          // All three must be present simultaneously:
          // 1. Spec path (Req 2.1)
          const hasSpecPath = prompt.includes(`.kiro/specs/${specName}/`);
          // 2. Steering context (Req 2.2)
          const hasSteeringContext = prompt.includes('Steering Context') &&
            prompt.includes('CORE_PRINCIPLES.md');
          // 3. Task instructions (Req 2.3)
          const hasTaskInstructions = prompt.includes('sub-agent responsible for executing the Spec') &&
            prompt.includes('Read the task list') &&
            prompt.includes('Execute each task in order');

          expect(hasSpecPath).toBe(true);
          expect(hasSteeringContext).toBe(true);
          expect(hasTaskInstructions).toBe(true);
        } finally {
          fs.removeSync(tempDir);
        }
      }),
      { numRuns: 100 }
    );
  });
});
