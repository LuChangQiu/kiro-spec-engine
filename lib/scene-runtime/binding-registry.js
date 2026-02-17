const { createMoquiAdapterHandler } = require('./moqui-adapter');

const DEFAULT_READINESS_SUCCESS = {
  passed: true,
  reason: 'default-ready'
};

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNodeType(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return normalized;
}

function normalizeRef(value) {
  return String(value || '').trim();
}

function normalizePatternList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

function createMatcher(match = null) {
  if (typeof match === 'function') {
    return match;
  }

  const normalizedMatch = isPlainObject(match)
    ? match
    : (typeof match === 'string' ? { refPrefix: match } : {});

  const nodeTypes = normalizePatternList(normalizedMatch.nodeType || normalizedMatch.nodeTypes)
    .map(normalizeNodeType)
    .filter(Boolean);
  const refPrefixes = normalizePatternList(normalizedMatch.refPrefix || normalizedMatch.refPrefixes)
    .map((item) => normalizeRef(item).toLowerCase())
    .filter(Boolean);

  const refRegexes = [];
  for (const item of normalizePatternList(normalizedMatch.refPattern || normalizedMatch.refPatterns)) {
    if (!item) {
      continue;
    }

    if (item instanceof RegExp) {
      refRegexes.push(item);
      continue;
    }

    const pattern = String(item).trim();
    if (!pattern) {
      continue;
    }

    try {
      refRegexes.push(new RegExp(pattern, 'i'));
    } catch (error) {
      continue;
    }
  }

  if (nodeTypes.length === 0 && refPrefixes.length === 0 && refRegexes.length === 0) {
    return () => true;
  }

  return (node = {}) => {
    const nodeType = normalizeNodeType(node.node_type || node.type);
    const bindingRef = normalizeRef(node.binding_ref || node.ref);
    const bindingRefLower = bindingRef.toLowerCase();

    if (nodeTypes.length > 0 && !nodeTypes.includes(nodeType)) {
      return false;
    }

    if (refPrefixes.length > 0) {
      const matchedPrefix = refPrefixes.some((prefix) => bindingRefLower.startsWith(prefix));
      if (!matchedPrefix) {
        return false;
      }
    }

    if (refRegexes.length > 0) {
      const matchedRegex = refRegexes.some((regex) => regex.test(bindingRef));
      if (!matchedRegex) {
        return false;
      }
    }

    return true;
  };
}

function normalizeReadinessResult(rawResult, fallbackName) {
  if (rawResult === true) {
    return { ...DEFAULT_READINESS_SUCCESS, name: fallbackName };
  }

  if (rawResult === false) {
    return {
      passed: false,
      reason: 'readiness-failed',
      name: fallbackName
    };
  }

  if (!isPlainObject(rawResult)) {
    return { ...DEFAULT_READINESS_SUCCESS, name: fallbackName };
  }

  return {
    name: rawResult.name || fallbackName,
    passed: rawResult.passed !== false,
    reason: rawResult.reason || (rawResult.passed === false ? 'readiness-failed' : 'ready'),
    detail: rawResult.detail
  };
}

class BindingRegistry {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.moquiConfigPath = typeof options.moquiConfigPath === 'string' && options.moquiConfigPath.trim().length > 0
      ? options.moquiConfigPath.trim()
      : undefined;
    this.useMoquiAdapter = options.useMoquiAdapter !== false;

    this.handlers = [];
    this.fallbackHandler = {
      id: 'builtin.default',
      matcher: () => true,
      execute: async (node) => ({
        status: 'success',
        binding_ref: node.binding_ref,
        provider: 'default'
      }),
      readiness: async () => ({ ...DEFAULT_READINESS_SUCCESS })
    };

    if (options.useDefaultHandlers !== false) {
      this.registerDefaultHandlers();
    }

    if (Array.isArray(options.handlers)) {
      for (const handler of options.handlers) {
        this.register(handler);
      }
    }

    if (options.fallbackHandler) {
      this.setFallbackHandler(options.fallbackHandler);
    }
  }

  registerDefaultHandlers() {
    if (this.useMoquiAdapter) {
      this.register(createMoquiAdapterHandler({
        projectRoot: this.projectRoot,
        configPath: this.moquiConfigPath,
        allowSpecErpFallback: true
      }));
    }

    this.register({
      id: 'builtin.erp-sim',
      match: { refPrefix: 'spec.erp.' },
      execute: async (node) => ({
        status: 'success',
        provider: 'erp-sim',
        binding_ref: node.binding_ref
      })
    });

    this.register({
      id: 'builtin.robot-sim',
      match: { refPrefix: 'spec.robot.' },
      execute: async (node) => ({
        status: 'success',
        provider: 'robot-sim',
        binding_ref: node.binding_ref
      }),
      readiness: async (node, payload = {}) => {
        const context = payload.context || {};
        const safetyChecks = context.safetyChecks || {};

        if (normalizeNodeType(node.node_type || node.type) !== 'adapter') {
          return {
            passed: true,
            reason: 'not-adapter'
          };
        }

        if (!safetyChecks.preflight) {
          return {
            passed: false,
            reason: 'missing-preflight'
          };
        }

        if (!safetyChecks.stopChannel) {
          return {
            passed: false,
            reason: 'missing-stop-channel'
          };
        }

        return {
          passed: true,
          reason: 'robot-safety-ready'
        };
      }
    });

    this.register({
      id: 'builtin.adapter-sim',
      match: { nodeType: 'adapter' },
      execute: async (node) => ({
        status: 'success',
        provider: 'adapter-sim',
        binding_ref: node.binding_ref
      }),
      readiness: async () => ({
        passed: true,
        reason: 'adapter-ready'
      })
    });
  }

  register(handler = {}) {
    if (!isPlainObject(handler)) {
      throw new Error('binding handler must be an object');
    }

    if (typeof handler.execute !== 'function') {
      throw new Error('binding handler requires execute function');
    }

    const id = normalizeRef(handler.id) || `handler-${this.handlers.length + 1}`;
    const matcher = createMatcher(handler.matcher || handler.match || null);

    this.handlers.push({
      ...handler,
      id,
      matcher
    });

    return id;
  }

  setFallbackHandler(handler = {}) {
    if (!isPlainObject(handler) || typeof handler.execute !== 'function') {
      throw new Error('fallback handler requires execute function');
    }

    this.fallbackHandler = {
      ...handler,
      id: normalizeRef(handler.id) || 'fallback',
      matcher: () => true
    };
  }

  resolve(node = {}, payload = {}) {
    for (const handler of this.handlers) {
      try {
        if (handler.matcher(node, payload)) {
          return handler;
        }
      } catch (error) {
        continue;
      }
    }

    return this.fallbackHandler;
  }

  async execute(node = {}, payload = {}) {
    const handler = this.resolve(node, payload);
    const rawResult = await handler.execute(node, payload);

    if (!isPlainObject(rawResult)) {
      return {
        status: 'success',
        output: rawResult,
        handler_id: handler.id
      };
    }

    return {
      status: rawResult.status === 'failed' ? 'failed' : 'success',
      ...rawResult,
      handler_id: rawResult.handler_id || handler.id
    };
  }

  async checkReadiness(sceneManifest = {}, payload = {}) {
    const bindings = ((((sceneManifest || {}).spec || {}).capability_contract || {}).bindings) || [];
    const checks = [];

    for (const binding of bindings) {
      const nodeType = normalizeNodeType(binding.type);
      if (nodeType !== 'adapter') {
        continue;
      }

      const node = {
        node_type: nodeType,
        binding_ref: binding.ref
      };
      const handler = this.resolve(node, payload);

      if (typeof handler.readiness !== 'function') {
        checks.push({
          name: `adapter:${node.binding_ref}`,
          passed: true,
          reason: 'no-readiness-hook',
          handler_id: handler.id
        });
        continue;
      }

      const readinessRaw = await handler.readiness(node, payload);
      const readiness = normalizeReadinessResult(readinessRaw, `adapter:${node.binding_ref}`);
      checks.push({
        ...readiness,
        handler_id: handler.id
      });
    }

    return {
      ready: checks.every((item) => item.passed !== false),
      checks
    };
  }
}

module.exports = BindingRegistry;
