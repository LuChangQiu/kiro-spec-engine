/**
 * Property 8: JSON Lines 事件解析属性测试
 * Property 9: 状态报告完整性属性测试
 *
 * Tests for StatusMonitor's event parsing robustness and status report completeness.
 */

const fc = require('fast-check');
const { StatusMonitor, VALID_SPEC_STATUSES } = require('../../lib/orchestrator/status-monitor');

// ---------------------------------------------------------------------------
// Property 8: JSON Lines 事件解析
//
// *对于任何* 有效的 Codex JSON Lines 事件字符串，StatusMonitor 应能正确解析出
// 事件类型和关键字段。*对于任何* 无效的 JSON 字符串，解析应优雅失败而不抛出异常。
//
// **Validates: Requirements 4.2**
// ---------------------------------------------------------------------------

describe('Property 8: JSON Lines 事件解析 (JSON Lines Event Parsing)', () => {
  /** Generator for valid Codex event types */
  const codexEventTypeArb = fc.oneof(
    fc.constant('thread.started'),
    fc.constant('turn.started'),
    fc.constant('turn.completed'),
    fc.constant('error'),
    fc.string({ minLength: 1 }).map((s) => `item.${s}`)
  );

  /** Generator for valid Codex event objects */
  const validEventObjectArb = fc.record({
    type: codexEventTypeArb,
    timestamp: fc.integer({ min: 946684800000, max: 4102444800000 }).map((ms) => new Date(ms).toISOString()),
    message: fc.option(fc.string(), { nil: undefined }),
  });

  test('valid JSON event strings are parsed without throwing', async () => {
    /**
     * **Validates: Requirements 4.2**
     *
     * For any valid Codex event serialised as a JSON string,
     * handleEvent must not throw.
     */
    const monitor = new StatusMonitor(null, null);

    await fc.assert(
      fc.property(validEventObjectArb, (eventObj) => {
        const jsonStr = JSON.stringify(eventObj);
        expect(() => monitor.handleEvent('agent-1', jsonStr)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  test('valid event objects are parsed without throwing', async () => {
    /**
     * **Validates: Requirements 4.2**
     *
     * For any valid Codex event object passed directly,
     * handleEvent must not throw.
     */
    const monitor = new StatusMonitor(null, null);

    await fc.assert(
      fc.property(validEventObjectArb, (eventObj) => {
        expect(() => monitor.handleEvent('agent-1', eventObj)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  test('invalid JSON strings never cause handleEvent to throw', async () => {
    /**
     * **Validates: Requirements 4.2**
     *
     * For any arbitrary string (most of which are not valid JSON),
     * handleEvent must gracefully handle the input without throwing.
     */
    const monitor = new StatusMonitor(null, null);

    await fc.assert(
      fc.property(fc.string(), (randomStr) => {
        expect(() => monitor.handleEvent('agent-1', randomStr)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  test('non-string, non-object inputs never cause handleEvent to throw', async () => {
    /**
     * **Validates: Requirements 4.2**
     *
     * For any arbitrary value (numbers, booleans, null, undefined, arrays),
     * handleEvent must not throw.
     */
    const monitor = new StatusMonitor(null, null);
    const arbitraryArb = fc.oneof(
      fc.integer(),
      fc.double(),
      fc.boolean(),
      fc.constant(null),
      fc.constant(undefined),
      fc.array(fc.anything())
    );

    await fc.assert(
      fc.property(arbitraryArb, (value) => {
        expect(() => monitor.handleEvent('agent-1', value)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  test('valid JSON events with type field are correctly recognised', async () => {
    /**
     * **Validates: Requirements 4.2**
     *
     * For any valid event with a known type, when the agent is registered
     * to a Spec, the event should be processed (e.g. thread.started → running).
     */
    await fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        (specName) => {
          // Fresh monitor per iteration to avoid stale agentId lookups
          const monitor = new StatusMonitor(null, null);
          const agentId = `agent-${specName}`;

          monitor.initSpec(specName, 1);
          monitor.updateSpecStatus(specName, 'pending', agentId);

          const event = JSON.stringify({ type: 'thread.started', timestamp: new Date().toISOString() });
          expect(() => monitor.handleEvent(agentId, event)).not.toThrow();

          const status = monitor.getSpecStatus(specName);
          expect(status).not.toBeNull();
          expect(status.status).toBe('running');
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 9: 状态报告完整性
//
// *对于任何* 编排执行状态，getOrchestrationStatus 返回的报告应包含所有参与
// 编排的 Spec，且每个 Spec 的状态值应为有效枚举值
// （pending、running、completed、failed、timeout、skipped）之一。
//
// **Validates: Requirements 4.1, 4.5**
// ---------------------------------------------------------------------------

describe('Property 9: 状态报告完整性 (Status Report Completeness)', () => {
  /** Valid spec statuses as an array for fc.constantFrom */
  const validStatusValues = [...VALID_SPEC_STATUSES];

  /**
   * Generator: array of { name, status } pairs with unique spec names.
   * Uses fc.uniqueArray of records to guarantee name uniqueness and
   * perfectly paired statuses without chain/length mismatch issues.
   */
  const specEntriesArb = fc.uniqueArray(
    fc.record({
      name: fc.stringMatching(/^[a-zA-Z0-9_-]{1,30}$/),
      status: fc.constantFrom(...validStatusValues),
    }),
    { minLength: 1, maxLength: 20, selector: (entry) => entry.name }
  );

  test('report contains every registered Spec', async () => {
    /**
     * **Validates: Requirements 4.1, 4.5**
     *
     * For any set of registered Specs, getOrchestrationStatus().specs
     * must contain an entry for every single registered Spec.
     */
    await fc.assert(
      fc.property(specEntriesArb, (entries) => {
        const monitor = new StatusMonitor(null, null);

        entries.forEach((e, i) => {
          monitor.initSpec(e.name, Math.floor(i / 3));
          monitor.updateSpecStatus(e.name, e.status);
        });

        const report = monitor.getOrchestrationStatus();

        for (const e of entries) {
          expect(report.specs).toHaveProperty(e.name);
        }
        expect(Object.keys(report.specs).length).toBe(entries.length);
      }),
      { numRuns: 100 }
    );
  });

  test('every Spec status in the report is a valid enum value', async () => {
    /**
     * **Validates: Requirements 4.1, 4.5**
     *
     * For any set of registered Specs with random valid statuses,
     * every status value in the report must be one of the valid enum values.
     */
    await fc.assert(
      fc.property(specEntriesArb, (entries) => {
        const monitor = new StatusMonitor(null, null);

        entries.forEach((e) => {
          monitor.initSpec(e.name, 0);
          monitor.updateSpecStatus(e.name, e.status);
        });

        const report = monitor.getOrchestrationStatus();

        for (const [, specEntry] of Object.entries(report.specs)) {
          expect(VALID_SPEC_STATUSES.has(specEntry.status)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('totalSpecs matches the number of registered Specs', async () => {
    /**
     * **Validates: Requirements 4.5**
     *
     * For any set of registered Specs, totalSpecs in the report
     * must equal the number of registered Specs.
     */
    await fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-zA-Z0-9_-]{1,30}$/), { minLength: 1, maxLength: 20 }),
        (specNames) => {
          const monitor = new StatusMonitor(null, null);

          specNames.forEach((name, i) => {
            monitor.initSpec(name, i);
          });

          const report = monitor.getOrchestrationStatus();
          expect(report.totalSpecs).toBe(specNames.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('newly registered Specs default to pending status', async () => {
    /**
     * **Validates: Requirements 4.1**
     *
     * For any set of Spec names, initSpec should set them to 'pending',
     * which is a valid status enum value.
     */
    await fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-zA-Z0-9_-]{1,30}$/), { minLength: 1, maxLength: 15 }),
        (specNames) => {
          const monitor = new StatusMonitor(null, null);

          specNames.forEach((name) => {
            monitor.initSpec(name, 0);
          });

          const report = monitor.getOrchestrationStatus();

          for (const name of specNames) {
            expect(report.specs[name].status).toBe('pending');
            expect(VALID_SPEC_STATUSES.has(report.specs[name].status)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
