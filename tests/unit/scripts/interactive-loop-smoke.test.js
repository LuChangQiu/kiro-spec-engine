const {
  DEFAULT_CONTEXT,
  DEFAULT_GOAL,
  DEFAULT_OUT,
  parseArgs,
  parseJson
} = require('../../../scripts/interactive-loop-smoke');

describe('interactive-loop-smoke helpers', () => {
  test('parseArgs uses defaults', () => {
    const options = parseArgs([]);
    expect(options.context).toBe(DEFAULT_CONTEXT);
    expect(options.goal).toBe(DEFAULT_GOAL);
    expect(options.out).toBe(DEFAULT_OUT);
    expect(options.json).toBe(false);
  });

  test('parseArgs accepts explicit overrides', () => {
    const options = parseArgs([
      '--context', 'tmp/context.json',
      '--goal', 'goal text',
      '--out', 'tmp/out.json',
      '--json'
    ]);
    expect(options.context).toBe('tmp/context.json');
    expect(options.goal).toBe('goal text');
    expect(options.out).toBe('tmp/out.json');
    expect(options.json).toBe(true);
  });

  test('parseJson parses JSON payload', () => {
    const payload = parseJson('{"ok":true}', 'sample');
    expect(payload.ok).toBe(true);
  });

  test('parseJson throws on invalid JSON', () => {
    expect(() => parseJson('not-json', 'sample')).toThrow('not valid JSON');
  });
});
