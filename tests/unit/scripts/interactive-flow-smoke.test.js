const {
  DEFAULT_INPUT,
  DEFAULT_GOAL,
  DEFAULT_POLICY,
  DEFAULT_CATALOG,
  DEFAULT_OUT,
  parseArgs,
  parseJson
} = require('../../../scripts/interactive-flow-smoke');

describe('interactive-flow-smoke helpers', () => {
  test('parseArgs uses defaults', () => {
    const options = parseArgs([]);
    expect(options.input).toBe(DEFAULT_INPUT);
    expect(options.goal).toBe(DEFAULT_GOAL);
    expect(options.policy).toBe(DEFAULT_POLICY);
    expect(options.catalog).toBe(DEFAULT_CATALOG);
    expect(options.out).toBe(DEFAULT_OUT);
    expect(options.json).toBe(false);
  });

  test('parseArgs accepts explicit overrides', () => {
    const options = parseArgs([
      '--input', 'payload.json',
      '--goal', 'custom goal',
      '--policy', 'policy.json',
      '--catalog', 'catalog.json',
      '--out', 'summary.json',
      '--json'
    ]);
    expect(options.input).toBe('payload.json');
    expect(options.goal).toBe('custom goal');
    expect(options.policy).toBe('policy.json');
    expect(options.catalog).toBe('catalog.json');
    expect(options.out).toBe('summary.json');
    expect(options.json).toBe(true);
  });

  test('parseJson parses JSON payload', () => {
    const payload = parseJson('{"ok":true}', 'smoke');
    expect(payload.ok).toBe(true);
  });

  test('parseJson throws on invalid JSON', () => {
    expect(() => parseJson('{invalid}', 'smoke')).toThrow('not valid JSON');
  });
});
