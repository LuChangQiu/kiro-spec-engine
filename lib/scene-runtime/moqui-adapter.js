'use strict';

const fs = require('fs-extra');
const path = require('path');
const MoquiClient = require('./moqui-client');

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_CONFIG_FILENAME = 'moqui-adapter.json';

const ENTITY_OPERATIONS = ['list', 'get', 'create', 'update', 'delete'];
const SERVICE_OPERATIONS = ['invoke', 'async', 'job-status'];

function resolveAdapterConfigPath(configPath, projectRoot) {
  if (configPath) {
    return path.resolve(projectRoot || process.cwd(), configPath);
  }

  return path.resolve(projectRoot || process.cwd(), DEFAULT_CONFIG_FILENAME);
}

function hasAdapterConfigFile(configPath, projectRoot) {
  const resolvedPath = resolveAdapterConfigPath(configPath, projectRoot);
  return fs.pathExistsSync(resolvedPath);
}

/**
 * Load and validate adapter config from file.
 * @param {string} [configPath] - Path to moqui-adapter.json
 * @param {string} [projectRoot] - Project root for relative path resolution
 * @returns {{ config: Object, error?: string }}
 */
function loadAdapterConfig(configPath, projectRoot) {
  const resolvedPath = resolveAdapterConfigPath(configPath, projectRoot);

  let rawContent;

  try {
    rawContent = fs.readFileSync(resolvedPath, 'utf8');
  } catch (err) {
    return {
      config: null,
      error: `CONFIG_NOT_FOUND: Could not read config file at "${resolvedPath}": ${err.message}`
    };
  }

  let parsed;

  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    return {
      config: null,
      error: `CONFIG_INVALID_JSON: Failed to parse JSON from "${resolvedPath}": ${err.message}`
    };
  }

  const config = applyConfigDefaults(parsed);

  return { config };
}

/**
 * Apply default values for optional config fields.
 * @param {Object} config - Raw parsed config
 * @returns {Object} Config with defaults applied
 */
function applyConfigDefaults(config) {
  if (!config || typeof config !== 'object') {
    return config;
  }

  return {
    ...config,
    timeout: (config.timeout != null && typeof config.timeout === 'number') ? config.timeout : DEFAULT_TIMEOUT,
    retryCount: (config.retryCount != null && typeof config.retryCount === 'number') ? config.retryCount : DEFAULT_RETRY_COUNT,
    retryDelay: (config.retryDelay != null && typeof config.retryDelay === 'number') ? config.retryDelay : DEFAULT_RETRY_DELAY
  };
}

/**
 * Validate adapter config object.
 * Required: baseUrl, credentials.username, credentials.password
 * @param {Object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAdapterConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['config must be a non-null object'] };
  }

  if (!config.baseUrl || typeof config.baseUrl !== 'string' || !config.baseUrl.trim()) {
    errors.push('baseUrl is required');
  }

  if (!config.credentials || typeof config.credentials !== 'object') {
    errors.push('credentials is required');
    errors.push('credentials.username is required');
    errors.push('credentials.password is required');
  } else {
    if (!config.credentials.username || typeof config.credentials.username !== 'string' || !config.credentials.username.trim()) {
      errors.push('credentials.username is required');
    }

    if (!config.credentials.password || typeof config.credentials.password !== 'string' || !config.credentials.password.trim()) {
      errors.push('credentials.password is required');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parse a binding ref into structured operation descriptor.
 *
 * Supported patterns:
 *   'moqui.{Entity}.{op}'              → { entity, operation }
 *   'moqui.service.{Name}.invoke'      → { service, operation: 'invoke' }
 *   'moqui.service.{Name}.async'       → { service, operation: 'invoke', mode: 'async' }
 *   'moqui.service.{Name}.job-status'  → { service, operation: 'job-status' }
 *   'moqui.screen.catalog'             → { operation: 'screen-catalog' }
 *   'moqui.screen.{Path}'              → { screen, operation: 'screen-definition' }
 *   'spec.erp.{name}'                  → { service, operation: 'invoke' }
 *
 * @param {string} bindingRef
 * @returns {{ entity?, service?, screen?, operation, mode? } | null}
 */
function parseBindingRef(bindingRef) {
  if (!bindingRef || typeof bindingRef !== 'string') {
    return null;
  }

  const ref = bindingRef.trim();

  if (!ref) {
    return null;
  }

  // Handle spec.erp.{name} pattern
  if (ref.startsWith('spec.erp.')) {
    const name = ref.slice('spec.erp.'.length);

    if (!name) {
      return null;
    }

    return { service: name, operation: 'invoke' };
  }

  // Handle moqui.* patterns
  if (!ref.startsWith('moqui.')) {
    return null;
  }

  const parts = ref.slice('moqui.'.length).split('.');

  if (parts.length < 1 || !parts[0]) {
    return null;
  }

  // Handle moqui.service.{Name}.{mode} pattern
  if (parts[0] === 'service') {
    return parseServiceRef(parts.slice(1));
  }

  // Handle moqui.screen.{path} pattern
  if (parts[0] === 'screen') {
    return parseScreenRef(parts.slice(1));
  }

  // Handle moqui.{Entity}.{op} pattern
  return parseEntityRef(parts);
}

/**
 * Parse service binding ref parts: {Name}.{mode}
 * @param {string[]} parts - Parts after 'moqui.service.'
 * @returns {Object|null}
 */
function parseServiceRef(parts) {
  if (parts.length < 2 || !parts[0]) {
    return null;
  }

  const serviceName = parts[0];
  const mode = parts[1];

  if (mode === 'invoke') {
    return { service: serviceName, operation: 'invoke' };
  }

  if (mode === 'async') {
    return { service: serviceName, operation: 'invoke', mode: 'async' };
  }

  if (mode === 'job-status') {
    return { service: serviceName, operation: 'job-status' };
  }

  return null;
}

/**
 * Parse screen binding ref parts: {path} or 'catalog'
 * @param {string[]} parts - Parts after 'moqui.screen.'
 * @returns {Object|null}
 */
function parseScreenRef(parts) {
  if (parts.length < 1 || !parts[0]) {
    return null;
  }

  if (parts[0] === 'catalog') {
    return { operation: 'screen-catalog' };
  }

  const screenPath = parts.join('.');

  return { screen: screenPath, operation: 'screen-definition' };
}

/**
 * Parse entity binding ref parts: {Entity}.{op}
 * @param {string[]} parts - Parts after 'moqui.'
 * @returns {Object|null}
 */
function parseEntityRef(parts) {
  if (parts.length < 2) {
    return null;
  }

  const entityName = parts[0];
  const operation = parts[1];

  if (!ENTITY_OPERATIONS.includes(operation)) {
    return null;
  }

  return { entity: entityName, operation };
}

/**
 * Map Moqui API response to KSE Execution_Result.
 * @param {Object} moquiResponse - { success, data, meta, error }
 * @param {string} handlerId - Handler identifier (e.g., 'moqui.adapter')
 * @param {string} bindingRef - Original binding ref string
 * @returns {Object} Execution_Result
 */
function mapMoquiResponseToResult(moquiResponse, handlerId, bindingRef) {
  if (!moquiResponse || typeof moquiResponse !== 'object') {
    return {
      status: 'failed',
      handler_id: handlerId,
      binding_ref: bindingRef,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'Moqui response is null or not an object',
        details: null
      }
    };
  }

  if (moquiResponse.success) {
    return {
      status: 'success',
      handler_id: handlerId,
      binding_ref: bindingRef,
      data: moquiResponse.data !== undefined ? moquiResponse.data : null,
      meta: moquiResponse.meta !== undefined ? moquiResponse.meta : null
    };
  }

  const error = moquiResponse.error || {};

  return {
    status: 'failed',
    handler_id: handlerId,
    binding_ref: bindingRef,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      details: error.details !== undefined ? error.details : null
    }
  };
}

/**
 * Build HTTP request details (method + path + body/query) from a parsed binding ref descriptor.
 * @param {Object} descriptor - Parsed binding ref descriptor from parseBindingRef
 * @param {Object} [payload] - Execution payload with data, params, id, jobId, etc.
 * @returns {{ method: string, path: string, body?: Object, query?: Object }}
 */
function buildHttpRequest(descriptor, payload = {}) {
  const { entity, service, screen, operation, mode } = descriptor;

  switch (operation) {
    case 'list': {
      const query = {};

      if (payload.pageIndex != null) {
        query.pageIndex = payload.pageIndex;
      }

      if (payload.pageSize != null) {
        query.pageSize = payload.pageSize;
      }

      if (payload.filter != null) {
        query.filter = payload.filter;
      }

      if (payload.sort != null) {
        query.sort = payload.sort;
      }

      return {
        method: 'GET',
        path: `/api/v1/entities/${entity}`,
        query
      };
    }

    case 'get': {
      const id = payload.id || (payload.data && payload.data.id);

      return {
        method: 'GET',
        path: `/api/v1/entities/${entity}/${id}`
      };
    }

    case 'create': {
      return {
        method: 'POST',
        path: `/api/v1/entities/${entity}`,
        body: payload.data || {}
      };
    }

    case 'update': {
      const id = payload.id || (payload.data && payload.data.id);

      return {
        method: 'PUT',
        path: `/api/v1/entities/${entity}/${id}`,
        body: payload.data || {}
      };
    }

    case 'delete': {
      const id = payload.id || (payload.data && payload.data.id);

      return {
        method: 'DELETE',
        path: `/api/v1/entities/${entity}/${id}`
      };
    }

    case 'invoke': {
      const body = payload.params || payload.data || {};

      if (mode === 'async') {
        body.async = true;
      }

      return {
        method: 'POST',
        path: `/api/v1/services/${service}`,
        body
      };
    }

    case 'job-status': {
      const jobId = payload.jobId;

      return {
        method: 'GET',
        path: `/api/v1/services/${service}/jobs/${jobId}`
      };
    }

    case 'screen-catalog': {
      return {
        method: 'GET',
        path: '/api/v1/screens'
      };
    }

    case 'screen-definition': {
      return {
        method: 'GET',
        path: `/api/v1/screens/${screen}`
      };
    }

    default: {
      return null;
    }
  }
}

/**
 * Create a MoquiAdapter handler object for BindingRegistry.register().
 * @param {Object} [options] - { configPath, projectRoot, client }
 * @param {string} [options.configPath] - Path to moqui-adapter.json
 * @param {string} [options.projectRoot] - Project root for relative path resolution
 * @param {Object} [options.client] - Pre-configured MoquiClient instance (for testing/DI)
 * @returns {Object} handler with { id, match, execute, readiness }
 */
function createMoquiAdapterHandler(options = {}) {
  const HANDLER_ID = 'moqui.adapter';
  const allowSpecErpFallback = options.allowSpecErpFallback !== false;
  const strictMatch = options.strictMatch === true;

  let client = options.client || null;
  let configLoaded = false;
  let loadedConfig = null;

  /**
   * Ensure the MoquiClient is initialized.
   * Loads config and creates client if not already done.
   * @returns {{ client: Object, error?: string }}
   */
  function ensureClient() {
    if (client) {
      return { client };
    }

    if (!configLoaded) {
      const result = loadAdapterConfig(options.configPath, options.projectRoot);

      if (result.error) {
        return { client: null, error: result.error };
      }

      const validation = validateAdapterConfig(result.config);

      if (!validation.valid) {
        return { client: null, error: `CONFIG_VALIDATION: ${validation.errors.join(', ')}` };
      }

      loadedConfig = result.config;
      configLoaded = true;
    }

    client = new MoquiClient(loadedConfig);

    return { client };
  }

  function shouldHandleBindingRef(bindingRef) {
    const ref = String(bindingRef || '').trim();

    if (!ref) {
      return false;
    }

    if (ref.startsWith('moqui.')) {
      return true;
    }

    if (!ref.startsWith('spec.erp.')) {
      return false;
    }

    if (strictMatch || !allowSpecErpFallback) {
      return true;
    }

    if (client) {
      return true;
    }

    return hasAdapterConfigFile(options.configPath, options.projectRoot);
  }

  return {
    id: HANDLER_ID,

    match: (node = {}) => shouldHandleBindingRef(node.binding_ref || node.ref),

    /**
     * Execute a binding node against the Moqui REST API.
     * @param {Object} node - Binding node with binding_ref or ref
     * @param {Object} [payload] - Execution payload
     * @returns {Promise<Object>} Execution_Result
     */
    execute: async (node, payload = {}) => {
      const bindingRef = node.binding_ref || node.ref;

      // Parse the binding ref
      const descriptor = parseBindingRef(bindingRef);

      if (!descriptor) {
        return {
          status: 'failed',
          handler_id: HANDLER_ID,
          binding_ref: bindingRef,
          error: {
            code: 'INVALID_BINDING_REF',
            message: `Failed to parse binding ref: "${bindingRef}"`,
            details: null
          }
        };
      }

      // Ensure client is ready
      const clientResult = ensureClient();

      if (clientResult.error) {
        return {
          status: 'failed',
          handler_id: HANDLER_ID,
          binding_ref: bindingRef,
          error: {
            code: 'CLIENT_INIT_ERROR',
            message: clientResult.error,
            details: null
          }
        };
      }

      // Build HTTP request from descriptor
      const httpRequest = buildHttpRequest(descriptor, payload);

      if (!httpRequest) {
        return {
          status: 'failed',
          handler_id: HANDLER_ID,
          binding_ref: bindingRef,
          error: {
            code: 'UNSUPPORTED_OPERATION',
            message: `Unsupported operation: "${descriptor.operation}"`,
            details: null
          }
        };
      }

      // Execute the request via MoquiClient
      const requestOptions = {};

      if (httpRequest.body !== undefined) {
        requestOptions.body = httpRequest.body;
      }

      if (httpRequest.query !== undefined) {
        requestOptions.query = httpRequest.query;
      }

      const moquiResponse = await clientResult.client.request(
        httpRequest.method,
        httpRequest.path,
        requestOptions
      );

      // Map Moqui response to KSE Execution_Result
      return mapMoquiResponseToResult(moquiResponse, HANDLER_ID, bindingRef);
    },

    /**
     * Check readiness by verifying Moqui connectivity and authentication.
     * @param {Object} node - Binding node
     * @param {Object} [payload] - Execution payload
     * @returns {Promise<{ passed: boolean, reason: string }>}
     */
    readiness: async (node, payload = {}) => {
      // Ensure config is loaded and client is created
      const clientResult = ensureClient();

      if (clientResult.error) {
        return { passed: false, reason: 'moqui-config-error' };
      }

      // Attempt login to verify connectivity and authentication
      try {
        const loginResult = await clientResult.client.login();

        if (loginResult.success) {
          return { passed: true, reason: 'moqui-ready' };
        }

        // Distinguish between network errors and auth errors
        const errorMsg = loginResult.error || '';

        if (errorMsg.includes('Network error') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND')) {
          return { passed: false, reason: 'moqui-unreachable' };
        }

        return { passed: false, reason: 'moqui-auth-failed' };
      } catch (error) {
        // Network-level errors indicate unreachable
        return { passed: false, reason: 'moqui-unreachable' };
      }
    }
  };
}

module.exports = {
  loadAdapterConfig,
  validateAdapterConfig,
  parseBindingRef,
  mapMoquiResponseToResult,
  buildHttpRequest,
  createMoquiAdapterHandler,
  resolveAdapterConfigPath,
  hasAdapterConfigFile,
  // Exported for testing
  applyConfigDefaults,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_DELAY,
  DEFAULT_CONFIG_FILENAME,
  ENTITY_OPERATIONS
};
