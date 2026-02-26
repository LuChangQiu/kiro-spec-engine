const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  resolveErrorbookPaths,
  normalizeOntologyTags,
  runErrorbookRecordCommand,
  runErrorbookListCommand,
  runErrorbookShowCommand,
  runErrorbookFindCommand,
  runErrorbookPromoteCommand
} = require('../../../lib/commands/errorbook');

describe('errorbook command workflow', () => {
  let tempDir;
  let originalLog;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-errorbook-'));
    originalLog = console.log;
    console.log = jest.fn();
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('records curated entry and persists index contract', async () => {
    const result = await runErrorbookRecordCommand({
      title: 'Order approval timeout',
      symptom: 'Order approval API returned 504 during peak hour traffic.',
      rootCause: 'Moqui order service lock timeout was too low under contention.',
      fixAction: ['Increase lock timeout to 15s', 'Add bounded retry for idempotent requests'],
      tags: 'moqui,order',
      ontology: 'entity,relation,business_rule',
      status: 'candidate',
      json: true
    }, {
      projectPath: tempDir
    });

    expect(result.mode).toBe('errorbook-record');
    expect(result.created).toBe(true);
    expect(result.entry.id).toContain('eb-');
    expect(result.entry.quality_score).toBeGreaterThanOrEqual(70);

    const paths = resolveErrorbookPaths(tempDir);
    const index = await fs.readJson(paths.indexFile);
    expect(index.total_entries).toBe(1);
    expect(index.entries[0].fingerprint).toBe(result.entry.fingerprint);
  });

  test('deduplicates by fingerprint and merges remediation details', async () => {
    const first = await runErrorbookRecordCommand({
      title: 'Inventory reservation stale lock',
      symptom: 'Reservation transaction hangs under concurrent edits.',
      rootCause: 'Stale transaction lock was not released in rollback path.',
      fixAction: ['Release lock in rollback hook'],
      tags: 'inventory',
      ontology: 'entity',
      json: true
    }, {
      projectPath: tempDir
    });

    const second = await runErrorbookRecordCommand({
      title: 'Inventory reservation stale lock',
      symptom: 'Reservation transaction hangs under concurrent edits.',
      rootCause: 'Stale transaction lock was not released in rollback path.',
      fixAction: ['Add lock expiration metric alert'],
      verification: ['npm run test -- inventory-locks'],
      tags: 'inventory,ops',
      ontology: 'relation',
      json: true
    }, {
      projectPath: tempDir
    });

    expect(second.created).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
    expect(second.entry.occurrences).toBe(2);
    expect(second.entry.fix_actions).toContain('Release lock in rollback hook');
    expect(second.entry.fix_actions).toContain('Add lock expiration metric alert');
    expect(second.entry.verification_evidence).toContain('npm run test -- inventory-locks');
    expect(second.entry.ontology_tags).toEqual(expect.arrayContaining(['entity', 'relation']));
  });

  test('promote gate rejects entries without verification evidence', async () => {
    const recorded = await runErrorbookRecordCommand({
      title: 'Payment callback signature mismatch',
      symptom: 'Callbacks failed signature verification after provider rotation.',
      rootCause: 'Gateway key rotation was not propagated to verifier config.',
      fixAction: ['Reload verifier config after key rotation'],
      tags: 'payment',
      ontology: 'business_rule',
      json: true
    }, {
      projectPath: tempDir
    });

    await expect(runErrorbookPromoteCommand({
      id: recorded.entry.id,
      json: true
    }, {
      projectPath: tempDir
    })).rejects.toThrow('verification_evidence');
  });

  test('promotes verified high-quality entry', async () => {
    const recorded = await runErrorbookRecordCommand({
      title: 'Order approval queue saturation',
      symptom: 'Order approval queue backlog exceeded SLA and delayed approvals.',
      rootCause: 'Queue workers were under-provisioned and retry policy amplified load.',
      fixAction: ['Increase worker pool from 4 to 8', 'Reduce retry burst window from 30s to 10s'],
      verification: ['npm run test -- order-approval', 'Load test confirms p95 below threshold'],
      tags: 'order,performance',
      ontology: 'entity,relation,decision',
      status: 'verified',
      json: true
    }, {
      projectPath: tempDir
    });

    const promoted = await runErrorbookPromoteCommand({
      id: recorded.entry.id,
      json: true
    }, {
      projectPath: tempDir
    });

    expect(promoted.mode).toBe('errorbook-promote');
    expect(promoted.promoted).toBe(true);
    expect(promoted.entry.status).toBe('promoted');
    expect(promoted.entry.promoted_at).toBeTruthy();
    expect(promoted.entry.quality_score).toBeGreaterThanOrEqual(75);
  });

  test('list supports status and quality filtering', async () => {
    const promotedCandidate = await runErrorbookRecordCommand({
      title: 'Catalog index drift',
      symptom: 'Search ranking drifted after index refresh job.',
      rootCause: 'Refresh job skipped synonym analyzer rebuild.',
      fixAction: ['Force synonym analyzer rebuild before re-index'],
      verification: ['Search relevance smoke test passed'],
      tags: 'catalog',
      ontology: 'entity,rule',
      status: 'verified',
      json: true
    }, {
      projectPath: tempDir
    });
    await runErrorbookPromoteCommand({
      id: promotedCandidate.entry.id,
      json: true
    }, {
      projectPath: tempDir
    });

    await runErrorbookRecordCommand({
      title: 'Minor docs typo',
      symptom: 'Command help text has typo in one flag description.',
      rootCause: 'Manual edit skipped spell-check.',
      fixAction: ['Correct typo'],
      tags: 'docs',
      status: 'candidate',
      json: true
    }, {
      projectPath: tempDir
    });

    const listed = await runErrorbookListCommand({
      status: 'promoted',
      minQuality: 75,
      json: true
    }, {
      projectPath: tempDir
    });

    expect(listed.mode).toBe('errorbook-list');
    expect(listed.total_results).toBe(1);
    expect(listed.entries[0].status).toBe('promoted');
    expect(listed.entries[0].quality_score).toBeGreaterThanOrEqual(75);
  });

  test('find ranks entries by match score and quality/status signals', async () => {
    const promoted = await runErrorbookRecordCommand({
      title: 'Approve order command timeout',
      symptom: 'Approve order command timed out with lock contention.',
      rootCause: 'Deadlock happened on order approval and inventory reservation.',
      fixAction: ['Reorder lock acquisition sequence'],
      verification: ['Order approval concurrency test passed'],
      tags: 'order',
      ontology: 'entity,relation,decision_policy',
      status: 'verified',
      json: true
    }, {
      projectPath: tempDir
    });
    await runErrorbookPromoteCommand({
      id: promoted.entry.id,
      json: true
    }, {
      projectPath: tempDir
    });

    await runErrorbookRecordCommand({
      title: 'Approve order button misalignment',
      symptom: 'Approve order button text shifted on small screen.',
      rootCause: 'CSS class override changed button padding.',
      fixAction: ['Restore button padding token'],
      tags: 'frontend',
      ontology: 'execution',
      status: 'candidate',
      json: true
    }, {
      projectPath: tempDir
    });

    const found = await runErrorbookFindCommand({
      query: 'approve order',
      limit: 2,
      json: true
    }, {
      projectPath: tempDir
    });

    expect(found.mode).toBe('errorbook-find');
    expect(found.total_results).toBe(2);
    expect(found.entries[0].status).toBe('promoted');
    expect(found.entries[0].match_score).toBeGreaterThan(found.entries[1].match_score);
  });

  test('show supports id prefix resolution', async () => {
    const recorded = await runErrorbookRecordCommand({
      title: 'Shipment webhook duplicate delivery',
      symptom: 'Webhook event processed twice and duplicated shipment updates.',
      rootCause: 'Consumer lacked deduplication key check.',
      fixAction: ['Add idempotency key guard'],
      verification: ['Webhook replay test passed'],
      tags: 'shipping',
      ontology: 'execution_flow',
      status: 'verified',
      json: true
    }, {
      projectPath: tempDir
    });

    const prefix = recorded.entry.id.slice(0, 10);
    const shown = await runErrorbookShowCommand({
      id: prefix,
      json: true
    }, {
      projectPath: tempDir
    });

    expect(shown.mode).toBe('errorbook-show');
    expect(shown.entry.id).toBe(recorded.entry.id);
    expect(shown.entry.title).toBe('Shipment webhook duplicate delivery');
  });

  test('normalizes ontology aliases into canonical tags', () => {
    const normalized = normalizeOntologyTags('entities,rules,decision,workflow,foo');
    expect(normalized).toEqual(['entity', 'business_rule', 'decision_policy', 'execution_flow']);
  });
});
