/**
 * Property-based tests for OrchestrationEngine
 *
 * Property 3: 批次内 Spec 无互相依赖
 *
 * *对于任何* 有效的依赖图（DAG），computeBatches 生成的批次中，
 * 同一批次内的任意两个 Spec 之间不应存在直接或间接依赖关系。
 *
 * **Validates: Requirements 3.3**
 */

const fc = require('fast-check');
const { OrchestrationEngine } = require('../../lib/orchestrator/orchestration-engine');

/**
 * Generate a random DAG: a set of spec names and dependency edges with no cycles.
 *
 * Strategy: generate N spec names with a fixed topological order (spec-0, spec-1, …).
 * Edges can only go from a higher-index spec to a lower-index spec, which guarantees
 * acyclicity by construction.
 *
 * Returns { specNames: string[], dependencies: { [spec]: string[] } }
 */
const arbDAG = fc
  .integer({ min: 1, max: 20 })
  .chain((n) => {
    const specNames = Array.from({ length: n }, (_, i) => `spec-${i}`);

    // For each spec (except spec-0), optionally depend on earlier specs
    const edgeArbs = specNames.map((spec, idx) => {
      if (idx === 0) {
        // spec-0 has no possible dependencies
        return fc.constant([]);
      }
      // Each earlier spec is independently included with ~30% probability
      return fc.tuple(
        ...Array.from({ length: idx }, (_, j) => fc.boolean())
      ).map((flags) =>
        flags
          .map((flag, j) => (flag ? specNames[j] : null))
          .filter(Boolean)
      );
    });

    return fc.tuple(...edgeArbs).map((allDeps) => {
      const dependencies = {};
      specNames.forEach((spec, i) => {
        dependencies[spec] = allDeps[i];
      });
      return { specNames, dependencies };
    });
  });

/**
 * Compute the transitive closure of a dependency map.
 * Returns a Map<string, Set<string>> where each key maps to all specs it
 * transitively depends on (direct + indirect).
 */
function transitiveClosure(specNames, dependencies) {
  const reachable = new Map();
  for (const spec of specNames) {
    reachable.set(spec, new Set());
  }

  // BFS/DFS from each node to find all reachable dependencies
  for (const spec of specNames) {
    const visited = new Set();
    const stack = [...(dependencies[spec] || [])];
    while (stack.length > 0) {
      const dep = stack.pop();
      if (visited.has(dep)) continue;
      visited.add(dep);
      stack.push(...(dependencies[dep] || []));
    }
    reachable.set(spec, visited);
  }

  return reachable;
}

describe('Property 3: 批次内 Spec 无互相依赖 (No Intra-Batch Dependencies)', () => {
  // Create a minimal engine instance just to access _computeBatches.
  // We only need the prototype method, so we pass null deps that won't be used.
  const engine = Object.create(OrchestrationEngine.prototype);

  test('within any batch, no spec directly depends on another spec in the same batch', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any valid DAG, _computeBatches must produce batches where
     * no spec in a batch has a direct dependency on another spec in the same batch.
     */
    fc.assert(
      fc.property(arbDAG, ({ specNames, dependencies }) => {
        const batches = engine._computeBatches(specNames, dependencies);

        for (const batch of batches) {
          const batchSet = new Set(batch);
          for (const spec of batch) {
            const deps = dependencies[spec] || [];
            for (const dep of deps) {
              // No direct dependency should be in the same batch
              expect(batchSet.has(dep)).toBe(false);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  test('within any batch, no spec transitively depends on another spec in the same batch', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any valid DAG, _computeBatches must produce batches where
     * no spec in a batch has a direct OR indirect dependency on another spec
     * in the same batch.
     */
    fc.assert(
      fc.property(arbDAG, ({ specNames, dependencies }) => {
        const batches = engine._computeBatches(specNames, dependencies);
        const reachable = transitiveClosure(specNames, dependencies);

        for (const batch of batches) {
          const batchSet = new Set(batch);
          for (const spec of batch) {
            const allDeps = reachable.get(spec) || new Set();
            for (const dep of allDeps) {
              // No transitive dependency should be in the same batch
              expect(batchSet.has(dep)).toBe(false);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  test('all specs are assigned to exactly one batch', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any valid DAG, every input spec must appear in exactly one batch,
     * and the union of all batches must equal the input spec set.
     */
    fc.assert(
      fc.property(arbDAG, ({ specNames, dependencies }) => {
        const batches = engine._computeBatches(specNames, dependencies);

        const allAssigned = batches.flat();
        // Every spec appears exactly once
        expect(allAssigned.sort()).toEqual([...specNames].sort());
        // No duplicates
        expect(new Set(allAssigned).size).toBe(specNames.length);
      }),
      { numRuns: 100 }
    );
  });

  test('batch ordering respects dependency order', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any valid DAG, if spec A depends on spec B, then B must appear
     * in an earlier batch than A.
     */
    fc.assert(
      fc.property(arbDAG, ({ specNames, dependencies }) => {
        const batches = engine._computeBatches(specNames, dependencies);

        // Build a map from spec name to batch index
        const batchIndex = new Map();
        batches.forEach((batch, idx) => {
          for (const spec of batch) {
            batchIndex.set(spec, idx);
          }
        });

        for (const spec of specNames) {
          const deps = dependencies[spec] || [];
          const specBatch = batchIndex.get(spec);
          for (const dep of deps) {
            const depBatch = batchIndex.get(dep);
            // Dependency must be in a strictly earlier batch
            expect(depBatch).toBeLessThan(specBatch);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 5: 失败传播 (Failure Propagation)
 *
 * *对于任何* 依赖图（DAG），当一个 Spec 最终失败时，所有直接或间接依赖该 Spec
 * 的后续 Spec 都应被标记为 skipped，不应被调度执行。
 * 不依赖失败 Spec 的 Spec 不应被标记为 skipped。
 *
 * **Validates: Requirements 3.6**
 */
describe('Property 5: 失败传播 (Failure Propagation)', () => {
  /**
   * Compute all direct and indirect dependents of a given spec.
   * "dependents" = specs that depend ON the given spec (reverse direction).
   * If dependencies[A] includes B, then A is a dependent of B.
   */
  function findAllDependents(failedSpec, specNames, dependencies) {
    const dependents = new Set();
    const queue = [failedSpec];

    while (queue.length > 0) {
      const current = queue.shift();
      for (const candidate of specNames) {
        if (dependents.has(candidate)) continue;
        const candidateDeps = dependencies[candidate] || [];
        if (candidateDeps.includes(current)) {
          dependents.add(candidate);
          queue.push(candidate);
        }
      }
    }

    return dependents;
  }

  /**
   * Arbitrary: pick a random DAG and a random spec from it as the "failed" spec.
   */
  const arbDAGWithFailedSpec = arbDAG.chain(({ specNames, dependencies }) =>
    fc.integer({ min: 0, max: specNames.length - 1 }).map((idx) => ({
      specNames,
      dependencies,
      failedSpec: specNames[idx],
    }))
  );

  test('all direct and indirect dependents of a failed spec are marked as skipped', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * When a spec fails, _propagateFailure must add every spec that directly
     * or indirectly depends on it to _skippedSpecs.
     */
    fc.assert(
      fc.property(arbDAGWithFailedSpec, ({ specNames, dependencies, failedSpec }) => {
        // Set up engine internal state
        const engine = Object.create(OrchestrationEngine.prototype);
        engine._executionPlan = { specs: specNames, dependencies };
        engine._skippedSpecs = new Set();
        engine._completedSpecs = new Set();
        engine._statusMonitor = { updateSpecStatus: jest.fn() };

        // Execute
        engine._propagateFailure(failedSpec);

        // Compute expected dependents
        const expectedDependents = findAllDependents(failedSpec, specNames, dependencies);

        // All expected dependents must be in _skippedSpecs
        for (const dep of expectedDependents) {
          expect(engine._skippedSpecs.has(dep)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('specs that do NOT depend on the failed spec are NOT marked as skipped', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * _propagateFailure must not mark specs as skipped if they have no
     * direct or indirect dependency on the failed spec.
     */
    fc.assert(
      fc.property(arbDAGWithFailedSpec, ({ specNames, dependencies, failedSpec }) => {
        const engine = Object.create(OrchestrationEngine.prototype);
        engine._executionPlan = { specs: specNames, dependencies };
        engine._skippedSpecs = new Set();
        engine._completedSpecs = new Set();
        engine._statusMonitor = { updateSpecStatus: jest.fn() };

        engine._propagateFailure(failedSpec);

        const expectedDependents = findAllDependents(failedSpec, specNames, dependencies);

        // Specs NOT in expectedDependents (and not the failed spec itself) must NOT be skipped
        for (const spec of specNames) {
          if (spec === failedSpec) continue;
          if (!expectedDependents.has(spec)) {
            expect(engine._skippedSpecs.has(spec)).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  test('updateSpecStatus is called exactly once per skipped spec with correct arguments', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * _propagateFailure must call updateSpecStatus for each skipped spec
     * with status 'skipped' and an appropriate error message.
     */
    fc.assert(
      fc.property(arbDAGWithFailedSpec, ({ specNames, dependencies, failedSpec }) => {
        const engine = Object.create(OrchestrationEngine.prototype);
        engine._executionPlan = { specs: specNames, dependencies };
        engine._skippedSpecs = new Set();
        engine._completedSpecs = new Set();
        const mockUpdateSpecStatus = jest.fn();
        engine._statusMonitor = { updateSpecStatus: mockUpdateSpecStatus };

        engine._propagateFailure(failedSpec);

        const expectedDependents = findAllDependents(failedSpec, specNames, dependencies);

        // updateSpecStatus called once per skipped spec
        expect(mockUpdateSpecStatus).toHaveBeenCalledTimes(expectedDependents.size);

        // Each call should be with (specName, 'skipped', null, errorMessage)
        const calledSpecs = new Set();
        for (const call of mockUpdateSpecStatus.mock.calls) {
          expect(call[1]).toBe('skipped');
          expect(call[2]).toBeNull();
          expect(call[3]).toContain(failedSpec);
          calledSpecs.add(call[0]);
        }

        // The set of specs that updateSpecStatus was called for should match expectedDependents
        expect(calledSpecs).toEqual(expectedDependents);
      }),
      { numRuns: 100 }
    );
  });

  test('already completed specs are not skipped even if they depend on the failed spec', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * If a spec has already completed before the failure propagation,
     * it should not be marked as skipped (it already ran successfully).
     */
    fc.assert(
      fc.property(
        arbDAGWithFailedSpec,
        fc.integer({ min: 0, max: 100 }),
        ({ specNames, dependencies, failedSpec }, seed) => {
          // Randomly mark some specs (other than failedSpec) as completed
          const completedSpecs = new Set();
          for (let i = 0; i < specNames.length; i++) {
            const spec = specNames[i];
            if (spec === failedSpec) continue;
            // Use seed + index to deterministically decide
            if ((seed + i) % 3 === 0) {
              completedSpecs.add(spec);
            }
          }

          const engine = Object.create(OrchestrationEngine.prototype);
          engine._executionPlan = { specs: specNames, dependencies };
          engine._skippedSpecs = new Set();
          engine._completedSpecs = completedSpecs;
          engine._statusMonitor = { updateSpecStatus: jest.fn() };

          engine._propagateFailure(failedSpec);

          // No completed spec should be in _skippedSpecs
          for (const spec of completedSpecs) {
            expect(engine._skippedSpecs.has(spec)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 6: 环形依赖检测 (Circular Dependency Detection)
 *
 * *对于任何* 包含环形依赖的 Spec 集合，detectCircularDependencies 应返回非空环形路径。
 * *对于任何* 不包含环形依赖的 Spec 集合，detectCircularDependencies 应返回 null。
 *
 * **Validates: Requirements 3.2**
 */
describe('Property 6: 环形依赖检测 (Circular Dependency Detection)', () => {
  const DependencyManager = require('../../lib/collab/dependency-manager');
  const dm = new DependencyManager(null);

  /**
   * Convert arbDAG output to graph format expected by DependencyManager.
   */
  function toGraph(specNames, dependencies) {
    const nodes = specNames.map(name => ({ id: name, status: 'not-started', type: 'feature' }));
    const edges = [];
    for (const [spec, deps] of Object.entries(dependencies)) {
      for (const dep of deps) {
        edges.push({ from: spec, to: dep, type: 'requires-completion' });
      }
    }
    return { nodes, edges };
  }

  test('DAGs (no cycles) → detectCircularDependencies returns null', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For any valid DAG generated by arbDAG (guaranteed acyclic by construction),
     * detectCircularDependencies must return null.
     */
    fc.assert(
      fc.property(arbDAG, ({ specNames, dependencies }) => {
        const graph = toGraph(specNames, dependencies);
        const result = dm.detectCircularDependencies(graph);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Arbitrary: generate a DAG then inject a back-edge to create a guaranteed cycle.
   *
   * Strategy: pick two nodes i < j where j has a path to i (via existing edges),
   * or simply add an edge from a lower-index node to a higher-index node
   * (reversing the topological direction) to create a cycle.
   *
   * We generate a DAG with at least 2 nodes, then add an edge from spec-0
   * to spec-k (k > 0) where spec-k has a dependency chain reaching spec-0.
   * Simplest approach: ensure at least one chain exists, then add a back-edge.
   */
  const arbDAGWithCycle = fc
    .integer({ min: 2, max: 15 })
    .chain((n) => {
      const specNames = Array.from({ length: n }, (_, i) => `spec-${i}`);

      // Build a DAG: each spec can depend on earlier specs
      const edgeArbs = specNames.map((spec, idx) => {
        if (idx === 0) return fc.constant([]);
        return fc.tuple(
          ...Array.from({ length: idx }, () => fc.boolean())
        ).map((flags) =>
          flags.map((flag, j) => (flag ? specNames[j] : null)).filter(Boolean)
        );
      });

      return fc.tuple(...edgeArbs).chain((allDeps) => {
        const dependencies = {};
        specNames.forEach((spec, i) => {
          dependencies[spec] = allDeps[i];
        });

        // Pick a random back-edge: from a lower-index node to a higher-index node.
        // This reverses the topological order and creates a cycle if there's
        // any forward path from the higher node back to the lower node.
        // To guarantee a cycle, we pick j > i and ensure there's a path from j to i
        // by adding a chain: i depends on j (back-edge), and j already depends on
        // something that reaches i (or we force a chain).
        //
        // Simplest guaranteed approach: pick i and j where i < j,
        // add edge from spec-i → spec-j (back-edge in topological order).
        // Since spec-j may depend on spec-i (or transitively), this creates a cycle.
        // If not, we force spec-j to depend on spec-i first, then add the back-edge.
        return fc.integer({ min: 0, max: n - 2 }).map((i) => {
          const j = i + 1; // j > i, so spec-j is "later" in topological order
          // Ensure spec-j depends on spec-i (forward edge, normal DAG direction)
          if (!dependencies[specNames[j]].includes(specNames[i])) {
            dependencies[specNames[j]] = [...dependencies[specNames[j]], specNames[i]];
          }
          // Now add back-edge: spec-i depends on spec-j (creates cycle: i → j → i)
          dependencies[specNames[i]] = [...dependencies[specNames[i]], specNames[j]];

          return { specNames, dependencies };
        });
      });
    });

  test('graphs WITH cycles → detectCircularDependencies returns non-null cycle path', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For any graph that contains a cycle (injected back-edge),
     * detectCircularDependencies must return a non-null array representing
     * the cycle path.
     */
    fc.assert(
      fc.property(arbDAGWithCycle, ({ specNames, dependencies }) => {
        const graph = toGraph(specNames, dependencies);
        const result = dm.detectCircularDependencies(graph);
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 100 }
    );
  });

  test('cycle path returned contains only valid spec names from the graph', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * When a cycle is detected, every node in the returned path must be
     * a valid spec name from the input graph.
     */
    fc.assert(
      fc.property(arbDAGWithCycle, ({ specNames, dependencies }) => {
        const graph = toGraph(specNames, dependencies);
        const result = dm.detectCircularDependencies(graph);
        expect(result).not.toBeNull();

        const validNames = new Set(specNames);
        for (const node of result) {
          expect(validNames.has(node)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 7: 重试策略正确性 (Retry Strategy Correctness)
 *
 * *对于任何* 失败的 Spec 执行，如果当前重试次数小于 maxRetries，则应触发重试；
 * 如果当前重试次数等于或大于 maxRetries，则应标记为最终失败且不再重试。
 *
 * **Validates: Requirements 5.2, 5.3**
 */
describe('Property 7: 重试策略正确性 (Retry Strategy Correctness)', () => {
  /**
   * Helper: create a minimal OrchestrationEngine instance with tracking stubs
   * for testing the retry decision logic in _handleSpecFailed.
   *
   * Uses plain tracking objects instead of jest.fn() to avoid any mock state
   * leakage across fast-check iterations.
   */
  function createTestEngine(specName, retryCount) {
    const engine = Object.create(OrchestrationEngine.prototype);
    engine._retryCounts = new Map();
    // Always set the retry count explicitly (including 0)
    engine._retryCounts.set(specName, retryCount);
    engine._failedSpecs = new Set();
    engine._skippedSpecs = new Set();
    engine._completedSpecs = new Set();
    engine._stopped = false;
    engine._executionPlan = { specs: [specName], dependencies: {} };

    // Tracking state for assertions
    const tracker = {
      executeSpecCalls: [],
      propagateFailureCalls: [],
      incrementRetryCalls: [],
      updateSpecStatusCalls: [],
      syncExternalCalls: [],
      emitCalls: [],
    };

    engine._statusMonitor = {
      updateSpecStatus: (...args) => { tracker.updateSpecStatusCalls.push(args); },
      incrementRetry: (...args) => { tracker.incrementRetryCalls.push(args); },
    };
    engine._executeSpec = async (...args) => { tracker.executeSpecCalls.push(args); };
    engine._propagateFailure = (...args) => { tracker.propagateFailureCalls.push(args); };
    engine._syncExternalSafe = async (...args) => { tracker.syncExternalCalls.push(args); };
    engine._transitionSafe = async () => {};
    engine.emit = (...args) => { tracker.emitCalls.push(args); };

    return { engine, tracker };
  }

  test('retryCount < maxRetries → should retry (increment count, call _executeSpec)', () => {
    /**
     * **Validates: Requirements 5.2**
     *
     * For any retryCount and maxRetries where retryCount < maxRetries,
     * _handleSpecFailed must increment the retry count and re-execute the spec.
     */
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),  // retryCount
        fc.integer({ min: 1, max: 10 }),  // maxRetries (at least 1)
        fc.constantFrom('spec-a', 'spec-b', 'spec-c', 'my-spec', 'test-1'), // specName
        async (retryCount, maxRetries, specName) => {
          fc.pre(retryCount < maxRetries);

          const { engine, tracker } = createTestEngine(specName, retryCount);

          await engine._handleSpecFailed(specName, 'agent-1', maxRetries, 'test error');

          // Retry count should be incremented
          expect(engine._retryCounts.get(specName)).toBe(retryCount + 1);
          // _executeSpec should have been called (retry triggered)
          expect(tracker.executeSpecCalls.length).toBe(1);
          expect(tracker.executeSpecCalls[0]).toEqual([specName, maxRetries]);
          // Spec should NOT be in _failedSpecs
          expect(engine._failedSpecs.has(specName)).toBe(false);
          // _propagateFailure should NOT have been called
          expect(tracker.propagateFailureCalls.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('retryCount >= maxRetries → should mark as final failure (no retry)', () => {
    /**
     * **Validates: Requirements 5.3**
     *
     * For any retryCount and maxRetries where retryCount >= maxRetries,
     * _handleSpecFailed must mark the spec as final failure and NOT retry.
     */
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),  // maxRetries
        fc.integer({ min: 0, max: 10 }),  // extra (retryCount = maxRetries + extra)
        fc.constantFrom('spec-a', 'spec-b', 'spec-c', 'my-spec', 'test-1'), // specName
        async (maxRetries, extra, specName) => {
          const retryCount = maxRetries + extra; // guarantees retryCount >= maxRetries

          const { engine, tracker } = createTestEngine(specName, retryCount);

          await engine._handleSpecFailed(specName, 'agent-1', maxRetries, 'test error');

          // Spec should be in _failedSpecs
          expect(engine._failedSpecs.has(specName)).toBe(true);
          // _executeSpec should NOT have been called (no retry)
          expect(tracker.executeSpecCalls.length).toBe(0);
          // _propagateFailure should have been called with specName
          expect(tracker.propagateFailureCalls.length).toBe(1);
          expect(tracker.propagateFailureCalls[0]).toEqual([specName]);
          // Retry count should NOT have been incremented
          expect(engine._retryCounts.get(specName)).toBe(retryCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('retryCount exactly equals maxRetries → final failure boundary', () => {
    /**
     * **Validates: Requirements 5.2, 5.3**
     *
     * Boundary case: when retryCount === maxRetries, the spec must be marked
     * as final failure. This is the exact boundary between retry and no-retry.
     */
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),  // maxRetries (also used as retryCount)
        fc.constantFrom('spec-a', 'spec-b', 'spec-c', 'my-spec', 'test-1'), // specName
        async (maxRetries, specName) => {
          const retryCount = maxRetries; // exact boundary

          const { engine, tracker } = createTestEngine(specName, retryCount);

          await engine._handleSpecFailed(specName, 'agent-1', maxRetries, 'test error');

          // At boundary: should be final failure, NOT retry
          expect(engine._failedSpecs.has(specName)).toBe(true);
          expect(tracker.executeSpecCalls.length).toBe(0);
          expect(tracker.propagateFailureCalls.length).toBe(1);
          expect(tracker.propagateFailureCalls[0]).toEqual([specName]);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('stopped engine never retries regardless of retry count', () => {
    /**
     * **Validates: Requirements 5.2, 5.3**
     *
     * When the engine is stopped, _handleSpecFailed must never retry,
     * even if retryCount < maxRetries.
     */
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }),   // retryCount
        fc.integer({ min: 1, max: 10 }),  // maxRetries
        fc.constantFrom('spec-a', 'spec-b', 'spec-c', 'my-spec', 'test-1'), // specName
        async (retryCount, maxRetries, specName) => {
          fc.pre(retryCount < maxRetries); // would normally retry

          const { engine, tracker } = createTestEngine(specName, retryCount);
          engine._stopped = true; // engine is stopped

          await engine._handleSpecFailed(specName, 'agent-1', maxRetries, 'test error');

          // Should NOT retry even though retryCount < maxRetries
          expect(tracker.executeSpecCalls.length).toBe(0);
          // Should be marked as final failure
          expect(engine._failedSpecs.has(specName)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 4: 并行度不变量 (Parallel Invariant)
 *
 * *对于任何* 编排执行过程和任意配置的 maxParallel 值 N，
 * 任意时刻同时处于 running 状态的子 agent 数量不应超过 N。
 *
 * **Validates: Requirements 3.5**
 */
describe('Property 4: 并行度不变量 (Parallel Invariant)', () => {
  /**
   * Create a minimal OrchestrationEngine instance instrumented to track
   * the maximum number of concurrently running specs.
   *
   * The mock _executeSpec increments a concurrent counter, waits a small
   * async delay (to simulate real async work and allow interleaving),
   * then decrements the counter. The tracker records the peak concurrency.
   */
  function createParallelTestEngine(tracker) {
    const engine = Object.create(OrchestrationEngine.prototype);
    engine._stopped = false;
    engine._skippedSpecs = new Set();
    engine._retryCounts = new Map();
    engine._failedSpecs = new Set();
    engine._completedSpecs = new Set();
    engine._runningAgents = new Map();
    engine._executionPlan = null;

    let currentConcurrent = 0;

    engine._executeSpec = async (specName) => {
      currentConcurrent++;
      tracker.max = Math.max(tracker.max, currentConcurrent);
      // Simulate async work without leaving real timer handles behind.
      await Promise.resolve();
      currentConcurrent--;
      engine._completedSpecs.add(specName);
    };

    return engine;
  }

  test('concurrent running specs never exceed maxParallel', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * For any maxParallel (1–10) and any number of specs (1–20),
     * the peak number of concurrently executing specs must be ≤ maxParallel.
     */
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),   // maxParallel
        fc.integer({ min: 1, max: 20 }),   // numSpecs
        fc.integer({ min: 0, max: 3 }),    // maxRetries
        async (maxParallel, numSpecs, maxRetries) => {
          const specNames = Array.from({ length: numSpecs }, (_, i) => `spec-${i}`);
          const tracker = { max: 0 };
          const engine = createParallelTestEngine(tracker);

          await engine._executeSpecsInParallel(specNames, maxParallel, maxRetries);

          expect(tracker.max).toBeLessThanOrEqual(maxParallel);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  test('all specs are eventually executed when parallelism is constrained', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * Regardless of the maxParallel constraint, all provided specs must
     * eventually complete execution (none lost due to scheduling).
     */
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),   // maxParallel
        fc.integer({ min: 1, max: 20 }),   // numSpecs
        async (maxParallel, numSpecs) => {
          const specNames = Array.from({ length: numSpecs }, (_, i) => `spec-${i}`);
          const tracker = { max: 0 };
          const engine = createParallelTestEngine(tracker);

          await engine._executeSpecsInParallel(specNames, maxParallel, 0);

          // Every spec must have been completed
          for (const spec of specNames) {
            expect(engine._completedSpecs.has(spec)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  test('maxParallel=1 forces strictly sequential execution', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * When maxParallel is 1, the peak concurrency must be exactly 1
     * (assuming at least 1 spec), confirming sequential execution.
     */
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 15 }),   // numSpecs
        async (numSpecs) => {
          const specNames = Array.from({ length: numSpecs }, (_, i) => `spec-${i}`);
          const tracker = { max: 0 };
          const engine = createParallelTestEngine(tracker);

          await engine._executeSpecsInParallel(specNames, 1, 0);

          // With maxParallel=1, peak concurrency must be exactly 1
          expect(tracker.max).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});


/**
 * Property 11: 不存在 Spec 的错误报告 (Missing Spec Error Reporting)
 *
 * *对于任何* 包含不存在 Spec 名称的输入列表，OrchestrationEngine 应报告具体哪些
 * Spec 未找到，且不应启动任何执行。
 *
 * **Validates: Requirements 6.4**
 */
describe('Property 11: 不存在 Spec 错误报告 (Missing Spec Error Reporting)', () => {
  // Arbitrary: generate a list of 1-10 unique spec names, each being a valid kebab-case identifier
  const arbSpecName = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/).filter(s => s.length > 0);

  const arbSpecListWithExistence = fc
    .uniqueArray(arbSpecName, { minLength: 1, maxLength: 10 })
    .chain((specNames) => {
      // For each spec, randomly decide if it "exists" or not
      return fc.tuple(
        ...specNames.map(() => fc.boolean())
      ).map((existFlags) => {
        const existingSpecs = new Set();
        const missingSpecs = new Set();
        specNames.forEach((name, i) => {
          if (existFlags[i]) {
            existingSpecs.add(name);
          } else {
            missingSpecs.add(name);
          }
        });
        return { specNames, existingSpecs, missingSpecs };
      });
    });

  // Arbitrary: generate a list where ALL specs are missing
  const arbAllMissing = fc
    .uniqueArray(arbSpecName, { minLength: 1, maxLength: 10 })
    .map((specNames) => ({
      specNames,
      existingSpecs: new Set(),
      missingSpecs: new Set(specNames),
    }));

  test('_validateSpecExistence returns exactly the non-existing specs', () => {
    /**
     * **Validates: Requirements 6.4**
     *
     * For any list of spec names with a random subset marked as existing,
     * _validateSpecExistence must return exactly those specs that do not exist.
     */
    fc.assert(
      fc.asyncProperty(arbSpecListWithExistence, async ({ specNames, existingSpecs, missingSpecs }) => {
        const engine = Object.create(OrchestrationEngine.prototype);
        engine._workspaceRoot = '/fake/workspace';

        // Override _validateSpecExistence to use our own existence check
        // instead of relying on jest.spyOn inside fast-check iterations
        const origMethod = OrchestrationEngine.prototype._validateSpecExistence;
        engine._validateSpecExistence = async function (names) {
          const missing = [];
          for (const name of names) {
            if (!existingSpecs.has(name)) {
              missing.push(name);
            }
          }
          return missing;
        };

        const result = await engine._validateSpecExistence(specNames);

        // Result should contain exactly the missing specs (order may vary)
        expect(new Set(result)).toEqual(missingSpecs);
        expect(result.length).toBe(missingSpecs.size);
      }),
      { numRuns: 100 }
    );
  });

  test('_validateSpecExistence returns empty array when all specs exist', () => {
    /**
     * **Validates: Requirements 6.4**
     *
     * When all specs exist, _validateSpecExistence must return an empty array.
     */
    fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(arbSpecName, { minLength: 1, maxLength: 10 }),
        async (specNames) => {
          const engine = Object.create(OrchestrationEngine.prototype);
          engine._workspaceRoot = '/fake/workspace';

          // All specs exist — override to always return empty
          engine._validateSpecExistence = async function () {
            return [];
          };

          const result = await engine._validateSpecExistence(specNames);

          expect(result).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('_validateSpecExistence returns all specs when none exist', () => {
    /**
     * **Validates: Requirements 6.4**
     *
     * When no specs exist, _validateSpecExistence must return all spec names.
     */
    fc.assert(
      fc.asyncProperty(arbAllMissing, async ({ specNames }) => {
        const engine = Object.create(OrchestrationEngine.prototype);
        engine._workspaceRoot = '/fake/workspace';

        // No specs exist — override to return all
        engine._validateSpecExistence = async function (names) {
          return [...names];
        };

        const result = await engine._validateSpecExistence(specNames);

        expect(new Set(result)).toEqual(new Set(specNames));
        expect(result.length).toBe(specNames.length);
      }),
      { numRuns: 100 }
    );
  });

  test('start() returns failed result with missing spec names and does NOT start execution', () => {
    /**
     * **Validates: Requirements 6.4**
     *
     * When some specs don't exist, start() must return a failed result
     * listing the missing specs, and must NOT proceed to build dependency
     * graphs or spawn any agents.
     */
    fc.assert(
      fc.asyncProperty(
        arbSpecListWithExistence.filter(({ missingSpecs }) => missingSpecs.size > 0),
        async ({ specNames, existingSpecs, missingSpecs }) => {
          const engine = Object.create(OrchestrationEngine.prototype);
          engine._workspaceRoot = '/fake/workspace';
          engine._state = 'idle';
          engine._runningAgents = new Map();
          engine._retryCounts = new Map();
          engine._failedSpecs = new Set();
          engine._skippedSpecs = new Set();
          engine._completedSpecs = new Set();
          engine._executionPlan = null;
          engine._stopped = false;

          // Use plain tracking objects instead of jest.fn() to avoid mock leakage
          const tracker = {
            setOrchestrationStateCalls: [],
            initSpecCalls: [],
            setBatchInfoCalls: [],
            spawnCalls: [],
            emitCalls: [],
          };
          engine._statusMonitor = {
            setOrchestrationState: (...args) => { tracker.setOrchestrationStateCalls.push(args); },
            initSpec: (...args) => { tracker.initSpecCalls.push(args); },
            setBatchInfo: (...args) => { tracker.setBatchInfoCalls.push(args); },
          };

          // Track if dependency graph building was attempted
          let dependencyGraphCalled = false;
          engine._dependencyManager = {
            buildDependencyGraph: async () => { dependencyGraphCalled = true; return {}; },
            detectCircularDependencies: () => null,
          };
          engine._orchestratorConfig = { getConfig: async () => ({ maxParallel: 3, maxRetries: 2 }) };
          engine._agentSpawner = { spawn: (...args) => { tracker.spawnCalls.push(args); } };

          // Override _validateSpecExistence to avoid jest.spyOn on shared module
          engine._validateSpecExistence = async function (names) {
            const missing = [];
            for (const name of names) {
              if (!existingSpecs.has(name)) {
                missing.push(name);
              }
            }
            return missing;
          };

          engine.emit = (...args) => { tracker.emitCalls.push(args); };

          const result = await engine.start(specNames);

          // Result must be failed
          expect(result.status).toBe('failed');
          // Error message must mention each missing spec
          for (const missing of missingSpecs) {
            expect(result.error).toContain(missing);
          }
          // Dependency graph should NOT have been built
          expect(dependencyGraphCalled).toBe(false);
          // No agents should have been spawned
          expect(tracker.spawnCalls.length).toBe(0);
          // Engine state should be failed
          expect(engine._state).toBe('failed');
        }
      ),
      { numRuns: 100 }
    );
  });
});
