/**
 * Property 10: 配置解析健壮性属性测试
 *
 * *对于任何* 配置对象（包含有效字段、无效字段、未知字段的任意组合），
 * OrchestratorConfig 应正确加载所有已知的有效字段，忽略未知字段，
 * 并对缺失字段使用默认值。
 *
 * **Validates: Requirements 7.4, 7.5**
 */

const fc = require('fast-check');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { OrchestratorConfig, DEFAULT_CONFIG, KNOWN_KEYS } = require('../../lib/orchestrator/orchestrator-config');

// --- Arbitraries ---

/** Generate a random value suitable for any config field */
const arbConfigValue = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.string(), { maxLength: 5 }),
);

/** Generate a random object with only known keys (valid partial config) */
const arbKnownFieldsObject = fc.record(
  Object.fromEntries(
    [...KNOWN_KEYS].map((key) => [key, arbConfigValue])
  ),
  { requiredKeys: [] }
);

/** Generate a random object with only unknown keys */
const arbUnknownFieldsObject = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !KNOWN_KEYS.has(s)),
  arbConfigValue,
  { minKeys: 0, maxKeys: 10 }
);

/** Generate a mixed config object: some known keys, some unknown keys */
const arbMixedConfig = fc.tuple(arbKnownFieldsObject, arbUnknownFieldsObject).map(
  ([known, unknown]) => ({ ...unknown, ...known })
);

// --- Helpers ---

let tempCounter = 0;

function createTempDir() {
  const dir = path.join(
    os.tmpdir(),
    `kse-pbt-oc-${Date.now()}-${++tempCounter}-${Math.random().toString(36).substr(2, 6)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeConfigFile(tempDir, data) {
  const configDir = path.join(tempDir, '.kiro', 'config');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), data);
}

// --- Property Tests ---

describe('Property 10: 配置解析健壮性 (Config Parsing Robustness)', () => {
  // Suppress console.warn from invalid JSON fallback during tests
  let warnSpy;
  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('known valid fields are correctly loaded from any config object', async () => {
    await fc.assert(
      fc.asyncProperty(arbMixedConfig, async (configObj) => {
        const tempDir = createTempDir();
        try {
          writeConfigFile(tempDir, configObj);
          const oc = new OrchestratorConfig(tempDir);
          const result = await oc.getConfig();

          // For each known key present in the input, the result should carry that value
          for (const key of KNOWN_KEYS) {
            if (key in configObj) {
              expect(result[key]).toEqual(configObj[key]);
            }
          }
        } finally {
          fs.removeSync(tempDir);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('unknown fields are never present in the result', async () => {
    await fc.assert(
      fc.asyncProperty(arbMixedConfig, async (configObj) => {
        const tempDir = createTempDir();
        try {
          writeConfigFile(tempDir, configObj);
          const oc = new OrchestratorConfig(tempDir);
          const result = await oc.getConfig();

          // No key outside KNOWN_KEYS should appear in the result
          for (const key of Object.keys(result)) {
            expect(KNOWN_KEYS.has(key)).toBe(true);
          }
        } finally {
          fs.removeSync(tempDir);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('missing known fields fall back to their default values', async () => {
    await fc.assert(
      fc.asyncProperty(arbMixedConfig, async (configObj) => {
        const tempDir = createTempDir();
        try {
          writeConfigFile(tempDir, configObj);
          const oc = new OrchestratorConfig(tempDir);
          const result = await oc.getConfig();

          // Every known key that was NOT in the input should equal the default
          for (const key of KNOWN_KEYS) {
            if (!(key in configObj)) {
              expect(result[key]).toEqual(DEFAULT_CONFIG[key]);
            }
          }
        } finally {
          fs.removeSync(tempDir);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('result always contains exactly the set of known keys', async () => {
    await fc.assert(
      fc.asyncProperty(arbMixedConfig, async (configObj) => {
        const tempDir = createTempDir();
        try {
          writeConfigFile(tempDir, configObj);
          const oc = new OrchestratorConfig(tempDir);
          const result = await oc.getConfig();

          const resultKeys = new Set(Object.keys(result));
          expect(resultKeys).toEqual(KNOWN_KEYS);
        } finally {
          fs.removeSync(tempDir);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('missing config file returns exact defaults for all keys', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const tempDir = createTempDir();
        try {
          // No config file written — directory is empty
          const oc = new OrchestratorConfig(tempDir);
          const result = await oc.getConfig();

          expect(result).toEqual({ ...DEFAULT_CONFIG });
        } finally {
          fs.removeSync(tempDir);
        }
      }),
      { numRuns: 10 }
    );
  });
});
