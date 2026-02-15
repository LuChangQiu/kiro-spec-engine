const OutputFormatter = require('../../../lib/repo/output-formatter');

describe('OutputFormatter ProgressIndicator', () => {
  let originalSetInterval;
  let originalClearInterval;
  let originalWrite;
  let originalLog;

  beforeEach(() => {
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;
    originalWrite = process.stdout.write;
    originalLog = console.log;

    process.stdout.write = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    process.stdout.write = originalWrite;
    console.log = originalLog;
  });

  test('calls unref when timer supports it', () => {
    const unref = jest.fn();
    const fakeTimer = { unref };
    global.setInterval = jest.fn(() => fakeTimer);
    global.clearInterval = jest.fn();

    const formatter = new OutputFormatter();
    const progress = formatter.createProgress('Checking...');
    progress.start();

    expect(global.setInterval).toHaveBeenCalledTimes(1);
    expect(unref).toHaveBeenCalledTimes(1);
    progress.stop();
    expect(global.clearInterval).toHaveBeenCalledWith(fakeTimer);
  });

  test('start is idempotent and stop is safe', () => {
    const fakeTimer = {};
    global.setInterval = jest.fn(() => fakeTimer);
    global.clearInterval = jest.fn();

    const formatter = new OutputFormatter();
    const progress = formatter.createProgress('Checking...');

    progress.start();
    progress.start();
    expect(global.setInterval).toHaveBeenCalledTimes(1);

    progress.stop();
    progress.stop();
    expect(global.clearInterval).toHaveBeenCalledTimes(1);
  });
});
