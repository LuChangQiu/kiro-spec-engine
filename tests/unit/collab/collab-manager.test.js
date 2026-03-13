const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const CollaborationManager = require('../../../lib/collab/collab-manager');
const MetadataManager = require('../../../lib/collab/metadata-manager');
const DependencyManager = require('../../../lib/collab/dependency-manager');

describe('collab naming compatibility', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-collab-manager-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('assignSpec persists sceInstance and removes legacy kiroInstance field', async () => {
    const manager = new CollaborationManager(tempDir);

    await manager.metadataManager.writeMetadata('121-00-demo', {
      version: '1.0.0',
      type: 'sub',
      dependencies: [],
      status: {
        current: 'not-started',
        updatedAt: new Date().toISOString()
      },
      interfaces: {
        provides: [],
        consumes: []
      },
      assignment: {
        kiroInstance: 'legacy-agent'
      }
    });

    const result = await manager.assignSpec('121-00-demo', 'sce-agent-1');
    const persisted = await manager.metadataManager.readMetadata('121-00-demo');

    expect(result.success).toBe(true);
    expect(result.sceInstance).toBe('sce-agent-1');
    expect(persisted.assignment.sceInstance).toBe('sce-agent-1');
    expect(Object.prototype.hasOwnProperty.call(persisted.assignment, 'kiroInstance')).toBe(false);
  });

  test('dependency graph falls back to legacy kiroInstance when reading old metadata', async () => {
    const metadataManager = new MetadataManager(tempDir);
    const dependencyManager = new DependencyManager(metadataManager);

    await metadataManager.writeMetadata('121-00-legacy', {
      version: '1.0.0',
      type: 'sub',
      dependencies: [],
      status: {
        current: 'in-progress',
        updatedAt: new Date().toISOString()
      },
      interfaces: {
        provides: [],
        consumes: []
      },
      assignment: {
        kiroInstance: 'legacy-agent'
      }
    });

    const graph = await dependencyManager.buildDependencyGraph();

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toEqual(expect.objectContaining({
      id: '121-00-legacy',
      sceInstance: 'legacy-agent'
    }));
  });
});
