/**
 * OrchestratorConfig Unit Tests
 *
 * Validates: Requirements 7.1-7.5
 * - 7.1: Read config from .kiro/config/orchestrator.json
 * - 7.2: Default values when config file missing
 * - 7.3: Supported config fields
 * - 7.4: Invalid JSON fallback to defaults
 * - 7.5: Unknown fields ignored
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { OrchestratorConfig, DEFAULT_CONFIG, KNOWN_KEYS } = require('../../lib/orchestrator/orchestrator-config');

describe('OrchestratorConfig', () => {
  let tempDir;
  let config;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `kse-test-oc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    config = new OrchestratorConfig(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  describe('DEFAULT_CONFIG', () => {
    test('has expected default values', () => {
      expect(DEFAULT_CONFIG).toEqual({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 600,
        maxRetries: 2,
        apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null,
        codexArgs: [],
        codexCommand: null,
      });
    });

    test('is frozen (immutable)', () => {
      expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
    });
  });

  describe('KNOWN_KEYS', () => {
    test('contains all expected config keys', () => {
      const expected = [
        'agentBackend', 'maxParallel', 'timeoutSeconds',
        'maxRetries', 'apiKeyEnvVar', 'bootstrapTemplate', 'codexArgs',
        'codexCommand',
      ];
      for (const key of expected) {
        expect(KNOWN_KEYS.has(key)).toBe(true);
      }
      expect(KNOWN_KEYS.size).toBe(expected.length);
    });
  });

  describe('getConfig()', () => {
    test('returns default config when file does not exist (Req 7.2)', async () => {
      const result = await config.getConfig();
      expect(result).toEqual({ ...DEFAULT_CONFIG });
    });

    test('returns a new object each time (not the frozen default)', async () => {
      const a = await config.getConfig();
      const b = await config.getConfig();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    test('reads config from .kiro/config/orchestrator.json (Req 7.1)', async () => {
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
        maxParallel: 5,
        timeoutSeconds: 1200,
      });

      const result = await config.getConfig();
      expect(result.maxParallel).toBe(5);
      expect(result.timeoutSeconds).toBe(1200);
      // Other fields should be defaults
      expect(result.agentBackend).toBe('codex');
      expect(result.maxRetries).toBe(2);
      expect(result.apiKeyEnvVar).toBe('CODEX_API_KEY');
      expect(result.bootstrapTemplate).toBeNull();
      expect(result.codexArgs).toEqual([]);
    });

    test('reads all supported config fields (Req 7.3)', async () => {
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      const customConfig = {
        agentBackend: 'claude',
        maxParallel: 8,
        timeoutSeconds: 300,
        maxRetries: 5,
        apiKeyEnvVar: 'CLAUDE_API_KEY',
        bootstrapTemplate: 'templates/custom.md',
        codexArgs: ['--model', 'gpt-4'],
        codexCommand: 'npx @openai/codex',
      };
      fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), customConfig);

      const result = await config.getConfig();
      expect(result).toEqual(customConfig);
    });

    test('falls back to defaults on invalid JSON (Req 7.4)', async () => {
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, 'orchestrator.json'), '{invalid json!!!');

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await config.getConfig();
      expect(result).toEqual({ ...DEFAULT_CONFIG });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse')
      );
      warnSpy.mockRestore();
    });

    test('ignores unknown fields (Req 7.5)', async () => {
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
        maxParallel: 4,
        unknownField: 'should be ignored',
        anotherUnknown: 42,
        nested: { deep: true },
      });

      const result = await config.getConfig();
      expect(result.maxParallel).toBe(4);
      expect(result).not.toHaveProperty('unknownField');
      expect(result).not.toHaveProperty('anotherUnknown');
      expect(result).not.toHaveProperty('nested');
      // All known keys should be present
      for (const key of KNOWN_KEYS) {
        expect(result).toHaveProperty(key);
      }
    });

    test('handles empty JSON object', async () => {
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {});

      const result = await config.getConfig();
      expect(result).toEqual({ ...DEFAULT_CONFIG });
    });
  });

  describe('updateConfig()', () => {
    test('creates config file and directory if they do not exist', async () => {
      const result = await config.updateConfig({ maxParallel: 6 });
      expect(result.maxParallel).toBe(6);
      // Other fields should be defaults
      expect(result.agentBackend).toBe('codex');
      expect(result.maxRetries).toBe(2);

      // File should now exist
      expect(fs.existsSync(config.configPath)).toBe(true);
      const written = fs.readJsonSync(config.configPath);
      expect(written.maxParallel).toBe(6);
    });

    test('merges updates with existing config', async () => {
      // Write initial config
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
        maxParallel: 5,
        timeoutSeconds: 900,
      });

      const result = await config.updateConfig({ maxRetries: 10 });
      expect(result.maxParallel).toBe(5);
      expect(result.timeoutSeconds).toBe(900);
      expect(result.maxRetries).toBe(10);
    });

    test('overwrites existing fields', async () => {
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
        maxParallel: 5,
      });

      const result = await config.updateConfig({ maxParallel: 1 });
      expect(result.maxParallel).toBe(1);
    });

    test('ignores unknown fields in updates', async () => {
      const result = await config.updateConfig({
        maxParallel: 7,
        somethingRandom: 'nope',
      });
      expect(result.maxParallel).toBe(7);
      expect(result).not.toHaveProperty('somethingRandom');
    });

    test('returns full config after update', async () => {
      const result = await config.updateConfig({ agentBackend: 'claude' });
      // Should have all known keys
      for (const key of KNOWN_KEYS) {
        expect(result).toHaveProperty(key);
      }
      expect(result.agentBackend).toBe('claude');
    });
  });

  describe('getBootstrapTemplate()', () => {
    test('returns null when no template configured', async () => {
      const result = await config.getBootstrapTemplate();
      expect(result).toBeNull();
    });

    test('returns null when bootstrapTemplate is null in config', async () => {
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
        bootstrapTemplate: null,
      });

      const result = await config.getBootstrapTemplate();
      expect(result).toBeNull();
    });

    test('reads template file content when configured', async () => {
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      const templateContent = 'Execute Spec {{specName}} with full context.';
      fs.writeFileSync(path.join(tempDir, 'my-template.md'), templateContent);
      fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
        bootstrapTemplate: 'my-template.md',
      });

      const result = await config.getBootstrapTemplate();
      expect(result).toBe(templateContent);
    });

    test('returns null and warns when template file does not exist', async () => {
      const configDir = path.join(tempDir, '.kiro', 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
        bootstrapTemplate: 'nonexistent-template.md',
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await config.getBootstrapTemplate();
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read bootstrap template')
      );
      warnSpy.mockRestore();
    });
  });

  describe('configPath', () => {
    test('returns the expected path', () => {
      const expected = path.join(tempDir, '.kiro', 'config', 'orchestrator.json');
      expect(config.configPath).toBe(expected);
    });
  });
});
