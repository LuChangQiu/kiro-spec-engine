const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const {
  SteeringContract,
  DEFAULT_LAYER_FILES,
  normalizeToolName,
} = require('../../../lib/runtime/steering-contract');

describe('SteeringContract', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-steering-contract-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('ensureContract creates manifest and layer files', async () => {
    const contract = new SteeringContract(tempDir);
    const result = await contract.ensureContract();
    expect(result.manifestPath).toBe('.sce/steering/manifest.yaml');

    const manifestExists = await fs.pathExists(path.join(tempDir, '.sce/steering/manifest.yaml'));
    expect(manifestExists).toBe(true);

    for (const filename of Object.values(DEFAULT_LAYER_FILES)) {
      const exists = await fs.pathExists(path.join(tempDir, '.sce/steering', filename));
      expect(exists).toBe(true);
    }
  });

  test('ensureContract creates template content for missing layers', async () => {
    const contract = new SteeringContract(tempDir);
    await contract.ensureContract();
    const content = await fs.readFile(path.join(tempDir, '.sce/steering/CORE_PRINCIPLES.md'), 'utf8');
    expect(content).toContain('Managed by SCE universal steering contract');
  });

  test('buildCompilePayload returns codex runtime defaults, source mode, and compatibility', async () => {
    const contract = new SteeringContract(tempDir);
    await contract.ensureContract();

    const payload = await contract.buildCompilePayload('codex', '1.2.3');
    expect(payload.tool).toBe('codex');
    expect(payload.agent_version).toBe('1.2.3');
    expect(payload.runtime.default_permission_args).toEqual([
      '--sandbox',
      'danger-full-access',
      '--ask-for-approval',
      'never',
    ]);
    expect(payload.source_mode).toBe('sce');
    expect(payload.compatibility.supported).toBe(true);
    expect(payload.layers.core_principles.content).toContain('Managed by SCE universal steering contract');
  });

  test('renderMarkdown includes runtime profile and layer sections', async () => {
    const contract = new SteeringContract(tempDir);
    await contract.ensureContract();
    const payload = await contract.buildCompilePayload('claude');
    const markdown = contract.renderMarkdown(payload);
    expect(markdown).toContain('SCE Steering Compile');
    expect(markdown).toContain('Runtime Permission Profile');
    expect(markdown).toContain('claude --dangerously-skip-permission');
    expect(markdown).toContain('core_principles');
  });

  test('normalizeToolName keeps known tools and falls back to generic', () => {
    expect(normalizeToolName('codex')).toBe('codex');
    expect(normalizeToolName('claude-code')).toBe('claude');
    expect(normalizeToolName('cursor')).toBe('cursor');
    expect(normalizeToolName('unknown-agent')).toBe('generic');
  });
});
