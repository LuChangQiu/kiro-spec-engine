'use strict';

const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  parseArgs,
  runErrorbookRegistryHealthGateScript
} = require('../../../scripts/errorbook-registry-health-gate');

describe('errorbook-registry-health-gate script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-errorbook-registry-health-gate-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('parseArgs reads strict mode from env and supports overrides', () => {
    const parsed = parseArgs([
      '--no-strict',
      '--json',
      '--project-path', tempDir,
      '--config', '.sce/config/errorbook-registry.json',
      '--source', './registry/errorbook-registry.json',
      '--index', './registry/errorbook-registry.index.json',
      '--max-shards', '4',
      '--shard-sample', '1'
    ], {
      SCE_REGISTRY_HEALTH_STRICT: '1'
    });

    expect(parsed.strict).toBe(false);
    expect(parsed.json).toBe(true);
    expect(parsed.projectPath).toBe(path.resolve(tempDir));
    expect(parsed.config).toBe('.sce/config/errorbook-registry.json');
    expect(parsed.source).toBe('./registry/errorbook-registry.json');
    expect(parsed.index).toBe('./registry/errorbook-registry.index.json');
    expect(parsed.maxShards).toBe(4);
    expect(parsed.shardSample).toBe(1);
  });

  test('returns exit code 0 when registry health passes', async () => {
    const shardPath = path.join(tempDir, 'registry', 'shards', 'order.json');
    const sourcePath = path.join(tempDir, 'registry', 'errorbook-registry.json');
    const indexPath = path.join(tempDir, 'registry', 'errorbook-registry.index.json');
    const configPath = path.join(tempDir, '.sce', 'config', 'errorbook-registry.json');

    await fs.ensureDir(path.dirname(shardPath));
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(shardPath, {
      api_version: 'sce.errorbook.registry/v0.1',
      entries: [{
        id: 'reg-gate-1',
        title: 'Registry gate fixture',
        symptom: 'Fixture for health gate pass check.',
        root_cause: 'Deterministic fixture payload.',
        fix_actions: ['Keep fixture deterministic'],
        verification_evidence: ['unit fixture ready'],
        tags: ['fixture'],
        ontology_tags: ['execution_flow'],
        status: 'promoted',
        quality_score: 88,
        updated_at: '2026-02-27T00:00:00Z'
      }]
    }, { spaces: 2 });
    await fs.writeJson(sourcePath, {
      api_version: 'sce.errorbook.registry/v0.1',
      entries: [{
        id: 'reg-source-1',
        title: 'Source fixture',
        symptom: 'Fixture source payload.',
        root_cause: 'Source validation data.',
        fix_actions: ['Use fixture'],
        verification_evidence: ['ok'],
        tags: ['fixture'],
        ontology_tags: ['entity'],
        status: 'promoted',
        quality_score: 80,
        updated_at: '2026-02-27T00:00:00Z'
      }]
    }, { spaces: 2 });
    await fs.writeJson(indexPath, {
      api_version: 'sce.errorbook.registry-index/v0.1',
      min_token_length: 2,
      token_to_bucket: {
        order: 'order'
      },
      buckets: {
        order: shardPath
      }
    }, { spaces: 2 });
    await fs.writeJson(configPath, {
      enabled: true,
      search_mode: 'remote',
      sources: [{
        name: 'central-fixture',
        enabled: true,
        url: sourcePath,
        index_url: indexPath
      }]
    }, { spaces: 2 });

    const result = await runErrorbookRegistryHealthGateScript({
      projectPath: tempDir,
      config: configPath,
      strict: true,
      json: true
    });

    expect(result.mode).toBe('errorbook-registry-health-gate');
    expect(result.passed).toBe(true);
    expect(result.error_count).toBe(0);
    expect(result.exit_code).toBe(0);
  });

  test('returns exit code 2 in strict mode when health has errors', async () => {
    const configPath = path.join(tempDir, '.sce', 'config', 'errorbook-registry.json');
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      enabled: true,
      search_mode: 'remote',
      sources: [{
        name: 'broken',
        enabled: true,
        url: path.join(tempDir, 'registry', 'missing-source.json')
      }]
    }, { spaces: 2 });

    const result = await runErrorbookRegistryHealthGateScript({
      projectPath: tempDir,
      config: configPath,
      strict: true,
      json: true
    });

    expect(result.passed).toBe(false);
    expect(result.error_count).toBeGreaterThan(0);
    expect(result.exit_code).toBe(2);
  });

  test('advisory mode does not fail process when health has errors', async () => {
    const configPath = path.join(tempDir, '.sce', 'config', 'errorbook-registry.json');
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      enabled: true,
      search_mode: 'remote',
      sources: [{
        name: 'broken',
        enabled: true,
        url: path.join(tempDir, 'registry', 'missing-source.json')
      }]
    }, { spaces: 2 });

    const result = await runErrorbookRegistryHealthGateScript({
      projectPath: tempDir,
      config: configPath,
      strict: false,
      json: true
    });

    expect(result.passed).toBe(false);
    expect(result.error_count).toBeGreaterThan(0);
    expect(result.exit_code).toBe(0);
  });
});
