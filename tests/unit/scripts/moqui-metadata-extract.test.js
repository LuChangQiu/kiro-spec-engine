const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('moqui-metadata-extract script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-moqui-metadata-extract-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('extracts entity/service/screen/form/rule/decision metadata from Moqui xml files', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'moqui-metadata-extract.js');
    const moquiProject = path.join(
      projectRoot,
      'tests',
      'fixtures',
      'moqui-metadata-extract',
      'project'
    );
    const outFile = path.join(tempDir, 'metadata-catalog.json');
    const markdownFile = path.join(tempDir, 'metadata-catalog.md');

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--project-dir',
        moquiProject,
        '--out',
        outFile,
        '--markdown-out',
        markdownFile,
        '--json'
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('moqui-metadata-extract');
    expect(payload.summary).toEqual(expect.objectContaining({
      entities: 2,
      services: 2,
      screens: 1,
      forms: 1,
      business_rules: 1,
      decisions: 1
    }));
    expect(payload.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'mantle.order.OrderHeader'
      })
    ]));
    expect(payload.services).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'mantle.order.OrderServices.create#OrderHeader'
      })
    ]));
    expect(payload.forms).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'OrderEntryForm',
        field_count: 3
      })
    ]));
    expect(payload.business_rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'order-must-have-customer' })
    ]));
    expect(payload.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'order-priority-routing' })
    ]));

    expect(await fs.pathExists(outFile)).toBe(true);
    expect(await fs.pathExists(markdownFile)).toBe(true);
  });
});
