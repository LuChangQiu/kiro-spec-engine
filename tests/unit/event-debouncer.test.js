const EventDebouncer = require('../../lib/watch/event-debouncer');

describe('EventDebouncer', () => {
  let debouncer;

  beforeEach(() => {
    debouncer = new EventDebouncer();
  });

  afterEach(() => {
    if (debouncer) {
      debouncer.clear();
    }
  });

  describe('constructor', () => {
    test('should create EventDebouncer with default config', () => {
      expect(debouncer).toBeDefined();
      expect(debouncer.config.defaultDelay).toBe(2000);
      expect(debouncer.config.defaultThrottleLimit).toBe(5000);
      expect(debouncer.config.maxQueueSize).toBe(100);
    });

    test('should create EventDebouncer with custom config', () => {
      debouncer = new EventDebouncer({
        defaultDelay: 1000,
        defaultThrottleLimit: 3000,
        maxQueueSize: 50
      });

      expect(debouncer.config.defaultDelay).toBe(1000);
      expect(debouncer.config.defaultThrottleLimit).toBe(3000);
      expect(debouncer.config.maxQueueSize).toBe(50);
    });
  });

  describe('debounce', () => {
    test('should debounce events', (done) => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      debouncer.debounce('test-key', callback, 100);
      debouncer.debounce('test-key', callback, 100);
      debouncer.debounce('test-key', callback, 100);

      setTimeout(() => {
        expect(callCount).toBe(1);
        expect(debouncer.stats.eventsReceived).toBe(3);
        expect(debouncer.stats.eventsDebounced).toBe(2);
        expect(debouncer.stats.eventsExecuted).toBe(1);
        done();
      }, 200);
    });

    test('should use default delay if not specified', (done) => {
      debouncer = new EventDebouncer({ defaultDelay: 100 });
      
      let executed = false;
      debouncer.debounce('test-key', () => {
        executed = true;
      });

      setTimeout(() => {
        expect(executed).toBe(true);
        done();
      }, 150);
    });

    test('should emit execute event', (done) => {
      debouncer.once('execute', (data) => {
        expect(data.key).toBe('test-key');
        expect(data.type).toBe('debounce');
        done();
      });

      debouncer.debounce('test-key', () => {}, 50);
    });

    test('should emit error event on callback error', (done) => {
      debouncer.once('error', (data) => {
        expect(data.error).toBeDefined();
        expect(data.key).toBe('test-key');
        expect(data.type).toBe('debounce');
        done();
      });

      debouncer.debounce('test-key', () => {
        throw new Error('Test error');
      }, 50);
    });

    test('should throw error if callback is not a function', () => {
      expect(() => {
        debouncer.debounce('test-key', 'not-a-function');
      }).toThrow('Callback must be a function');
    });

    test('should handle multiple keys independently', (done) => {
      let count1 = 0;
      let count2 = 0;

      debouncer.debounce('key1', () => { count1++; }, 100);
      debouncer.debounce('key2', () => { count2++; }, 100);

      setTimeout(() => {
        expect(count1).toBe(1);
        expect(count2).toBe(1);
        done();
      }, 150);
    });
  });

  describe('throttle', () => {
    test('should throttle events', (done) => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      debouncer.throttle('test-key', callback, 100);
      debouncer.throttle('test-key', callback, 100);
      debouncer.throttle('test-key', callback, 100);

      expect(callCount).toBe(1);
      expect(debouncer.stats.eventsReceived).toBe(3);
      expect(debouncer.stats.eventsThrottled).toBe(2);
      expect(debouncer.stats.eventsExecuted).toBe(1);

      setTimeout(() => {
        debouncer.throttle('test-key', callback, 100);
        expect(callCount).toBe(2);
        done();
      }, 150);
    });

    test('should use default throttle limit if not specified', () => {
      debouncer = new EventDebouncer({ defaultThrottleLimit: 100 });
      
      let callCount = 0;
      debouncer.throttle('test-key', () => { callCount++; });
      debouncer.throttle('test-key', () => { callCount++; });

      expect(callCount).toBe(1);
    });

    test('should emit execute event', () => {
      const executePromise = new Promise(resolve => {
        debouncer.once('execute', resolve);
      });

      debouncer.throttle('test-key', () => {}, 100);

      return executePromise.then(data => {
        expect(data.key).toBe('test-key');
        expect(data.type).toBe('throttle');
      });
    });

    test('should emit throttled event', () => {
      const throttledPromise = new Promise(resolve => {
        debouncer.once('throttled', resolve);
      });

      debouncer.throttle('test-key', () => {}, 100);
      debouncer.throttle('test-key', () => {}, 100);

      return throttledPromise.then(data => {
        expect(data.key).toBe('test-key');
        expect(data.remainingTime).toBeGreaterThan(0);
      });
    });

    test('should emit error event on callback error', () => {
      const errorPromise = new Promise(resolve => {
        debouncer.once('error', resolve);
      });

      debouncer.throttle('test-key', () => {
        throw new Error('Test error');
      }, 100);

      return errorPromise.then(data => {
        expect(data.error).toBeDefined();
        expect(data.key).toBe('test-key');
        expect(data.type).toBe('throttle');
      });
    });

    test('should throw error if callback is not a function', () => {
      expect(() => {
        debouncer.throttle('test-key', 'not-a-function');
      }).toThrow('Callback must be a function');
    });

    test('should return true when executed', () => {
      const result = debouncer.throttle('test-key', () => {}, 100);
      expect(result).toBe(true);
    });

    test('should return false when throttled', () => {
      debouncer.throttle('test-key', () => {}, 100);
      const result = debouncer.throttle('test-key', () => {}, 100);
      expect(result).toBe(false);
    });
  });

  describe('queue management', () => {
    test('should enqueue events', () => {
      const event = { key: 'test-key', type: 'change', data: {} };
      const result = debouncer.enqueue(event);

      expect(result).toBe(true);
      expect(debouncer.getQueueSize()).toBe(1);
    });

    test('should prevent duplicate events', () => {
      const event = { key: 'test-key', type: 'change', data: { value: 1 } };
      
      debouncer.enqueue(event);
      debouncer.enqueue(event);

      expect(debouncer.getQueueSize()).toBe(1);
      expect(debouncer.stats.duplicatesDropped).toBe(1);
    });

    test('should emit duplicate:dropped event', () => {
      const event = { key: 'test-key', type: 'change', data: {} };
      
      const dropPromise = new Promise(resolve => {
        debouncer.once('duplicate:dropped', resolve);
      });

      debouncer.enqueue(event);
      debouncer.enqueue(event);

      return dropPromise.then(data => {
        expect(data.event).toBeDefined();
      });
    });

    test('should respect max queue size', () => {
      debouncer = new EventDebouncer({ maxQueueSize: 3 });

      debouncer.enqueue({ key: 'key1', type: 'change', data: {} });
      debouncer.enqueue({ key: 'key2', type: 'change', data: {} });
      debouncer.enqueue({ key: 'key3', type: 'change', data: {} });
      const result = debouncer.enqueue({ key: 'key4', type: 'change', data: {} });

      expect(result).toBe(false);
      expect(debouncer.getQueueSize()).toBe(3);
    });

    test('should emit queue:full event', () => {
      debouncer = new EventDebouncer({ maxQueueSize: 1 });

      const fullPromise = new Promise(resolve => {
        debouncer.once('queue:full', resolve);
      });

      debouncer.enqueue({ key: 'key1', type: 'change', data: {} });
      debouncer.enqueue({ key: 'key2', type: 'change', data: {} });

      return fullPromise.then(data => {
        expect(data.size).toBe(1);
        expect(data.maxSize).toBe(1);
      });
    });

    test('should dequeue events', () => {
      const event = { key: 'test-key', type: 'change', data: {} };
      debouncer.enqueue(event);

      const dequeued = debouncer.dequeue();

      expect(dequeued.key).toBe('test-key');
      expect(debouncer.getQueueSize()).toBe(0);
    });

    test('should return null when dequeuing empty queue', () => {
      const result = debouncer.dequeue();
      expect(result).toBeNull();
    });

    test('should emit queue:added event', () => {
      const addedPromise = new Promise(resolve => {
        debouncer.once('queue:added', resolve);
      });

      debouncer.enqueue({ key: 'test-key', type: 'change', data: {} });

      return addedPromise.then(data => {
        expect(data.event).toBeDefined();
        expect(data.queueSize).toBe(1);
      });
    });

    test('should emit queue:removed event', () => {
      debouncer.enqueue({ key: 'test-key', type: 'change', data: {} });

      const removedPromise = new Promise(resolve => {
        debouncer.once('queue:removed', resolve);
      });

      debouncer.dequeue();

      return removedPromise.then(data => {
        expect(data.event).toBeDefined();
        expect(data.queueSize).toBe(0);
      });
    });

    test('should throw error if event has no key', () => {
      expect(() => {
        debouncer.enqueue({ type: 'change', data: {} });
      }).toThrow('Event must have a key property');
    });

    test('should get queue content', () => {
      debouncer.enqueue({ key: 'key1', type: 'change', data: {} });
      debouncer.enqueue({ key: 'key2', type: 'change', data: {} });

      const queue = debouncer.getQueue();

      expect(queue.length).toBe(2);
      expect(queue[0].key).toBe('key1');
      expect(queue[1].key).toBe('key2');
    });
  });

  describe('clear', () => {
    test('should clear all timers and queue', (done) => {
      debouncer.debounce('key1', () => {}, 1000);
      debouncer.debounce('key2', () => {}, 1000);
      debouncer.enqueue({ key: 'key3', type: 'change', data: {} });

      debouncer.clear();

      expect(debouncer.getActiveTimers()).toBe(0);
      expect(debouncer.getQueueSize()).toBe(0);

      setTimeout(() => {
        // Callbacks should not execute
        expect(debouncer.stats.eventsExecuted).toBe(0);
        done();
      }, 1500);
    });

    test('should emit cleared event', () => {
      const clearedPromise = new Promise(resolve => {
        debouncer.once('cleared', resolve);
      });

      debouncer.debounce('key1', () => {}, 1000);
      debouncer.enqueue({ key: 'key2', type: 'change', data: {} });
      debouncer.clear();

      return clearedPromise.then(data => {
        expect(data).toBeDefined();
      });
    });

    test('should clear specific key', (done) => {
      let executed = false;
      debouncer.debounce('key1', () => { executed = true; }, 100);
      debouncer.debounce('key2', () => {}, 100);

      debouncer.clearKey('key1');

      setTimeout(() => {
        expect(executed).toBe(false);
        expect(debouncer.stats.eventsExecuted).toBe(1);
        done();
      }, 150);
    });

    test('should remove key from queue', () => {
      debouncer.enqueue({ key: 'key1', type: 'change', data: {} });
      debouncer.enqueue({ key: 'key2', type: 'change', data: {} });
      debouncer.enqueue({ key: 'key1', type: 'delete', data: {} });

      debouncer.clearKey('key1');

      expect(debouncer.getQueueSize()).toBe(1);
      const queue = debouncer.getQueue();
      expect(queue[0].key).toBe('key2');
    });

    test('should emit key:cleared event', () => {
      debouncer.enqueue({ key: 'key1', type: 'change', data: {} });

      const clearedPromise = new Promise(resolve => {
        debouncer.once('key:cleared', resolve);
      });

      debouncer.clearKey('key1');

      return clearedPromise.then(data => {
        expect(data.key).toBe('key1');
        expect(data.eventsRemoved).toBe(1);
      });
    });
  });

  describe('stats', () => {
    test('should get statistics', () => {
      debouncer.debounce('key1', () => {}, 1000);
      debouncer.enqueue({ key: 'key2', type: 'change', data: {} });

      const stats = debouncer.getStats();

      expect(stats.eventsReceived).toBe(1);
      expect(stats.activeTimers).toBe(1);
      expect(stats.queueSize).toBe(1);
    });

    test('should reset statistics', () => {
      debouncer.debounce('key1', () => {}, 1000);
      debouncer.stats.eventsReceived = 10;

      debouncer.resetStats();

      expect(debouncer.stats.eventsReceived).toBe(0);
      expect(debouncer.stats.eventsExecuted).toBe(0);
    });

    test('should emit stats:reset event', () => {
      const resetPromise = new Promise(resolve => {
        debouncer.once('stats:reset', resolve);
      });

      debouncer.resetStats();

      return resetPromise;
    });
  });

  describe('status checks', () => {
    test('should check if key is debouncing', () => {
      debouncer.debounce('key1', () => {}, 1000);

      expect(debouncer.isDebouncing('key1')).toBe(true);
      expect(debouncer.isDebouncing('key2')).toBe(false);
    });

    test('should check if key is throttled', () => {
      debouncer.throttle('key1', () => {}, 100);

      expect(debouncer.isThrottled('key1', 100)).toBe(true);
      expect(debouncer.isThrottled('key2', 100)).toBe(false);
    });

    test('should use default throttle limit for isThrottled', () => {
      debouncer = new EventDebouncer({ defaultThrottleLimit: 100 });
      debouncer.throttle('key1', () => {});

      expect(debouncer.isThrottled('key1')).toBe(true);
    });

    test('should get active timers count', () => {
      debouncer.debounce('key1', () => {}, 1000);
      debouncer.debounce('key2', () => {}, 1000);

      expect(debouncer.getActiveTimers()).toBe(2);
    });
  });
});
