const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { MachineIdentifier } = require('../../../lib/lock/machine-identifier');

describe('MachineIdentifier', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kse-machine-id-'));
  });

  afterEach(async () => {
    await fs.remove(tempRoot);
  });

  test('getMachineId persists machine ID and reuses it', async () => {
    const identifier = new MachineIdentifier(tempRoot);

    const first = await identifier.getMachineId();
    const second = await identifier.getMachineId();

    expect(first).toEqual(second);
    expect(first.id).toContain(first.hostname);

    const persisted = await fs.readJson(path.join(tempRoot, 'machine-id.json'));
    expect(persisted.id).toBe(first.id);
  });

  test('generateMachineId returns expected structure', () => {
    const identifier = new MachineIdentifier(tempRoot);
    const machineId = identifier.generateMachineId();

    expect(machineId).toMatchObject({
      id: expect.any(String),
      hostname: expect.any(String),
      createdAt: expect.any(String)
    });

    const suffix = machineId.id.substring(machineId.hostname.length + 1);
    expect(suffix).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test('falls back to unknown-host when os.hostname throws', () => {
    const identifier = new MachineIdentifier(tempRoot);
    const osModule = require('os');
    const hostnameSpy = jest.spyOn(osModule, 'hostname').mockImplementation(() => {
      throw new Error('hostname unavailable');
    });

    const machineId = identifier.generateMachineId();

    expect(machineId.hostname).toBe('unknown-host');

    hostnameSpy.mockRestore();
  });
});
