const path = require('path');
const {
  resolveControllerQueueFile,
  resolveControllerQueueFormat,
  dedupeControllerGoals,
  loadControllerGoalQueue,
  writeControllerGoalQueue,
  appendControllerGoalArchive
} = require('../../../lib/auto/controller-queue-service');

describe('auto controller queue service', () => {
  test('dedupes controller goals deterministically', () => {
    expect(dedupeControllerGoals(['Goal A', 'goal a', 'Goal B'])).toEqual({
      goals: ['Goal A', 'Goal B'],
      duplicate_count: 1
    });
  });

  test('loads controller queue in lines mode', async () => {
    const fs = {
      pathExists: async () => true,
      readFile: async () => 'one\ntwo\n'
    };
    const payload = await loadControllerGoalQueue(path, fs, () => [], (content) => content.trim().split(/\r?\n/), 'proj', 'queue.lines', 'lines', { dedupe: false, normalizeBatchFormat: () => 'lines' });
    expect(payload.goals).toEqual(['one', 'two']);
  });

  test('writes queue and appends archive', async () => {
    const writes = [];
    const fs = {
      ensureDir: async () => {},
      writeJson: async (file, payload) => writes.push({ file, payload }),
      writeFile: async (file, content) => writes.push({ file, content }),
      appendFile: async (file, content) => writes.push({ file, content })
    };
    await writeControllerGoalQueue(path, fs, 'queue.json', 'json', ['a']);
    const archive = await appendControllerGoalArchive(path, fs, 'done.tsv', 'proj', 'goal', { status: 'completed', gate_passed: true });
    expect(archive).toContain('done.tsv');
    expect(writes.length).toBeGreaterThan(0);
  });
});
