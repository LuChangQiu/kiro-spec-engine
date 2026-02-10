'use strict';

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const {
  loadAdapterConfig,
  validateAdapterConfig,
  parseBindingRef,
  mapMoquiResponseToResult,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_DELAY
} = require('../../../lib/scene-runtime/moqui-adapter');

describe('MoquiAdapter', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `moqui-adapter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(tmpDir);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  // ─── loadAdapterConfig ───────────────────────────────────────────

  describe('loadAdapterConfig', () => {
    test('loads valid config from default filename', () => {
      const config = {
        baseUrl: 'http://localhost:8080',
        credentials: { username: 'admin', password: 'moqui' }
      };
      fs.writeFileSync(path.join(tmpDir, 'moqui-adapter.json'), JSON.stringify(config));

      const result = loadAdapterConfig(undefined, tmpDir);

      expect(result.error).toBeUndefined();
      expect(result.config.baseUrl).toBe('http://localhost:8080');
      expect(result.config.credentials.username).toBe('admin');
    });

    test('loads valid config from custom path', () => {
      const config = {
        baseUrl: 'http://erp.example.com',
        credentials: { username: 'user1', password: 'pass1' }
      };
      fs.writeFileSync(path.join(tmpDir, 'custom-config.json'), JSON.stringify(config));

      const result = loadAdapterConfig('custom-config.json', tmpDir);

      expect(result.error).toBeUndefined();
      expect(result.config.baseUrl).toBe('http://erp.example.com');
    });

    test('applies defaults for missing optional fields', () => {
      const config = {
        baseUrl: 'http://localhost:8080',
        credentials: { username: 'admin', password: 'moqui' }
      };
      fs.writeFileSync(path.join(tmpDir, 'moqui-adapter.json'), JSON.stringify(config));

      const result = loadAdapterConfig(undefined, tmpDir);

      expect(result.config.timeout).toBe(DEFAULT_TIMEOUT);
      expect(result.config.retryCount).toBe(DEFAULT_RETRY_COUNT);
      expect(result.config.retryDelay).toBe(DEFAULT_RETRY_DELAY);
    });

    test('preserves explicitly set optional fields', () => {
      const config = {
        baseUrl: 'http://localhost:8080',
        credentials: { username: 'admin', password: 'moqui' },
        timeout: 5000,
        retryCount: 5,
        retryDelay: 500
      };
      fs.writeFileSync(path.join(tmpDir, 'moqui-adapter.json'), JSON.stringify(config));

      const result = loadAdapterConfig(undefined, tmpDir);

      expect(result.config.timeout).toBe(5000);
      expect(result.config.retryCount).toBe(5);
      expect(result.config.retryDelay).toBe(500);
    });

    test('returns CONFIG_NOT_FOUND error when file is missing', () => {
      const result = loadAdapterConfig('nonexistent.json', tmpDir);

      expect(result.config).toBeNull();
      expect(result.error).toContain('CONFIG_NOT_FOUND');
    });

    test('returns CONFIG_INVALID_JSON error for malformed JSON', () => {
      fs.writeFileSync(path.join(tmpDir, 'moqui-adapter.json'), '{invalid json!!!');

      const result = loadAdapterConfig(undefined, tmpDir);

      expect(result.config).toBeNull();
      expect(result.error).toContain('CONFIG_INVALID_JSON');
    });

    test('returns CONFIG_INVALID_JSON for empty file', () => {
      fs.writeFileSync(path.join(tmpDir, 'moqui-adapter.json'), '');

      const result = loadAdapterConfig(undefined, tmpDir);

      expect(result.config).toBeNull();
      expect(result.error).toContain('CONFIG_INVALID_JSON');
    });
  });

  // ─── validateAdapterConfig ───────────────────────────────────────

  describe('validateAdapterConfig', () => {
    test('returns valid for complete config', () => {
      const result = validateAdapterConfig({
        baseUrl: 'http://localhost:8080',
        credentials: { username: 'admin', password: 'moqui' }
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('reports missing baseUrl', () => {
      const result = validateAdapterConfig({
        credentials: { username: 'admin', password: 'moqui' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('baseUrl is required');
    });

    test('reports missing credentials object', () => {
      const result = validateAdapterConfig({
        baseUrl: 'http://localhost:8080'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('credentials is required');
      expect(result.errors).toContain('credentials.username is required');
      expect(result.errors).toContain('credentials.password is required');
    });

    test('reports missing credentials.username', () => {
      const result = validateAdapterConfig({
        baseUrl: 'http://localhost:8080',
        credentials: { password: 'moqui' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('credentials.username is required');
      expect(result.errors).not.toContain('credentials.password is required');
    });

    test('reports missing credentials.password', () => {
      const result = validateAdapterConfig({
        baseUrl: 'http://localhost:8080',
        credentials: { username: 'admin' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('credentials.password is required');
      expect(result.errors).not.toContain('credentials.username is required');
    });

    test('reports all missing fields at once', () => {
      const result = validateAdapterConfig({});

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    test('returns invalid for null config', () => {
      const result = validateAdapterConfig(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('config must be a non-null object');
    });

    test('returns invalid for non-object config', () => {
      const result = validateAdapterConfig('string');

      expect(result.valid).toBe(false);
    });
  });

  // ─── parseBindingRef ─────────────────────────────────────────────

  describe('parseBindingRef', () => {
    // Entity operations
    test.each([
      ['moqui.OrderHeader.list', { entity: 'OrderHeader', operation: 'list' }],
      ['moqui.OrderHeader.get', { entity: 'OrderHeader', operation: 'get' }],
      ['moqui.OrderHeader.create', { entity: 'OrderHeader', operation: 'create' }],
      ['moqui.OrderHeader.update', { entity: 'OrderHeader', operation: 'update' }],
      ['moqui.OrderHeader.delete', { entity: 'OrderHeader', operation: 'delete' }],
      ['moqui.Product.list', { entity: 'Product', operation: 'list' }]
    ])('parses entity ref "%s"', (ref, expected) => {
      expect(parseBindingRef(ref)).toEqual(expected);
    });

    // Service operations
    test.each([
      ['moqui.service.PlaceOrder.invoke', { service: 'PlaceOrder', operation: 'invoke' }],
      ['moqui.service.PlaceOrder.async', { service: 'PlaceOrder', operation: 'invoke', mode: 'async' }],
      ['moqui.service.PlaceOrder.job-status', { service: 'PlaceOrder', operation: 'job-status' }]
    ])('parses service ref "%s"', (ref, expected) => {
      expect(parseBindingRef(ref)).toEqual(expected);
    });

    // Screen operations
    test('parses screen catalog ref', () => {
      expect(parseBindingRef('moqui.screen.catalog')).toEqual({ operation: 'screen-catalog' });
    });

    test('parses screen definition ref', () => {
      expect(parseBindingRef('moqui.screen.OrderEntry')).toEqual({
        screen: 'OrderEntry',
        operation: 'screen-definition'
      });
    });

    // spec.erp.* pattern
    test('parses spec.erp ref', () => {
      expect(parseBindingRef('spec.erp.order-query')).toEqual({
        service: 'order-query',
        operation: 'invoke'
      });
    });

    test('parses spec.erp ref with complex name', () => {
      expect(parseBindingRef('spec.erp.order-query-service')).toEqual({
        service: 'order-query-service',
        operation: 'invoke'
      });
    });

    // Invalid refs
    test.each([
      [null, 'null input'],
      [undefined, 'undefined input'],
      ['', 'empty string'],
      ['  ', 'whitespace only'],
      ['unknown.prefix.something', 'unknown prefix'],
      ['moqui.', 'moqui with no parts'],
      ['moqui.OrderHeader', 'entity without operation'],
      ['moqui.OrderHeader.invalid', 'entity with invalid operation'],
      ['moqui.service.', 'service with no name'],
      ['moqui.service.PlaceOrder', 'service without mode'],
      ['moqui.service.PlaceOrder.unknown', 'service with unknown mode'],
      ['moqui.screen.', 'screen with empty path'],
      ['spec.erp.', 'spec.erp with no name']
    ])('returns null for invalid ref: %s (%s)', (ref) => {
      expect(parseBindingRef(ref)).toBeNull();
    });
  });

  // ─── mapMoquiResponseToResult ────────────────────────────────────

  describe('mapMoquiResponseToResult', () => {
    const handlerId = 'moqui.adapter';
    const bindingRef = 'moqui.OrderHeader.list';

    test('maps success response with data and meta', () => {
      const moquiResponse = {
        success: true,
        data: { orders: [{ id: 1 }] },
        meta: { pageIndex: 0, pageSize: 20, totalCount: 1 }
      };

      const result = mapMoquiResponseToResult(moquiResponse, handlerId, bindingRef);

      expect(result).toEqual({
        status: 'success',
        handler_id: 'moqui.adapter',
        binding_ref: 'moqui.OrderHeader.list',
        data: { orders: [{ id: 1 }] },
        meta: { pageIndex: 0, pageSize: 20, totalCount: 1 }
      });
    });

    test('maps success response without meta', () => {
      const moquiResponse = {
        success: true,
        data: { id: 'order-1' }
      };

      const result = mapMoquiResponseToResult(moquiResponse, handlerId, bindingRef);

      expect(result.status).toBe('success');
      expect(result.data).toEqual({ id: 'order-1' });
      expect(result.meta).toBeNull();
    });

    test('maps error response with full error details', () => {
      const moquiResponse = {
        success: false,
        error: {
          code: 'ENTITY_NOT_FOUND',
          message: 'Order not found',
          details: 'No order with ID 999'
        }
      };

      const result = mapMoquiResponseToResult(moquiResponse, handlerId, bindingRef);

      expect(result).toEqual({
        status: 'failed',
        handler_id: 'moqui.adapter',
        binding_ref: 'moqui.OrderHeader.list',
        error: {
          code: 'ENTITY_NOT_FOUND',
          message: 'Order not found',
          details: 'No order with ID 999'
        }
      });
    });

    test('maps error response with missing error fields', () => {
      const moquiResponse = { success: false };

      const result = mapMoquiResponseToResult(moquiResponse, handlerId, bindingRef);

      expect(result.status).toBe('failed');
      expect(result.error.code).toBe('UNKNOWN_ERROR');
      expect(result.error.message).toBe('Unknown error occurred');
    });

    test('handles null moquiResponse', () => {
      const result = mapMoquiResponseToResult(null, handlerId, bindingRef);

      expect(result.status).toBe('failed');
      expect(result.error.code).toBe('INVALID_RESPONSE');
    });

    test('handles non-object moquiResponse', () => {
      const result = mapMoquiResponseToResult('not-an-object', handlerId, bindingRef);

      expect(result.status).toBe('failed');
      expect(result.error.code).toBe('INVALID_RESPONSE');
    });
  });
});
