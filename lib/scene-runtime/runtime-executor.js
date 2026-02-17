const PlanCompiler = require('./plan-compiler');
const PolicyGate = require('./policy-gate');
const AuditEmitter = require('./audit-emitter');
const EvalBridge = require('./eval-bridge');
const BindingRegistry = require('./binding-registry');
const { loadBindingPlugins } = require('./binding-plugin-loader');

function createTraceId() {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

class RuntimeExecutor {
  constructor(options = {}) {
    this.planCompiler = options.planCompiler || new PlanCompiler();
    this.policyGate = options.policyGate || new PolicyGate();
    this.auditEmitter = options.auditEmitter || new AuditEmitter(options.projectRoot || process.cwd(), options.audit || {});
    this.evalBridge = options.evalBridge || new EvalBridge();
    this.bindingRegistry = options.bindingRegistry || new BindingRegistry({
      projectRoot: options.projectRoot || process.cwd(),
      moquiConfigPath: options.moquiConfigPath,
      useMoquiAdapter: options.useMoquiAdapter
    });
    this.bindingExecutor = typeof options.bindingExecutor === 'function' ? options.bindingExecutor : null;
    this.adapterReadinessChecker = options.adapterReadinessChecker || this.defaultAdapterReadinessChecker.bind(this);
    this.bindingPluginLoad = {
      handlers_loaded: 0,
      plugin_dirs: [],
      plugin_files: [],
      manifest_path: null,
      manifest_loaded: false,
      warnings: []
    };

    if (!options.bindingRegistry && options.bindingPluginLoading !== false) {
      const pluginLoadResult = loadBindingPlugins({
        projectRoot: options.projectRoot || process.cwd(),
        pluginDir: options.bindingPluginDir,
        autoDiscovery: options.bindingPluginAutoDiscovery !== false,
        manifestPath: options.bindingPluginManifest,
        manifestEnabled: options.bindingPluginManifestLoad !== false
      });

      this.bindingPluginLoad = {
        handlers_loaded: pluginLoadResult.handlers.length,
        plugin_dirs: pluginLoadResult.plugin_dirs,
        plugin_files: pluginLoadResult.plugin_files,
        manifest_path: pluginLoadResult.manifest_path || null,
        manifest_loaded: pluginLoadResult.manifest_loaded === true,
        warnings: [...pluginLoadResult.warnings]
      };

      for (const handler of pluginLoadResult.handlers) {
        try {
          this.bindingRegistry.register(handler);
        } catch (error) {
          this.bindingPluginLoad.warnings.push(`failed to register binding plugin handler ${handler.id || 'unknown'}: ${error.message}`);
        }
      }
    }
  }

  async execute(sceneManifest, options = {}) {
    const startTime = Date.now();
    const runMode = options.runMode || 'dry_run';
    const context = options.context || {};
    const traceId = options.traceId || createTraceId();

    await this.auditEmitter.emit('scene_run_requested', {
      trace_id: traceId,
      scene_ref: sceneManifest.metadata.obj_id,
      scene_version: sceneManifest.metadata.obj_version,
      run_mode: runMode
    });

    const plan = this.planCompiler.compile(sceneManifest, {
      runMode,
      traceId,
      planId: options.planId
    });

    await this.auditEmitter.emit('scene_plan_compiled', {
      trace_id: traceId,
      scene_ref: sceneManifest.metadata.obj_id,
      scene_version: sceneManifest.metadata.obj_version,
      run_mode: runMode,
      payload: { plan_id: plan.plan_id, node_count: plan.nodes.length }
    });

    const policyResult = this.policyGate.evaluate(sceneManifest, runMode, context);

    if (!policyResult.allowed) {
      await this.auditEmitter.emit('scene_run_denied', {
        trace_id: traceId,
        scene_ref: sceneManifest.metadata.obj_id,
        scene_version: sceneManifest.metadata.obj_version,
        run_mode: runMode,
        payload: { reasons: policyResult.reasons }
      });

      const deniedResult = {
        status: 'denied',
        trace_id: traceId,
        run_mode: runMode,
        policy: policyResult,
        duration_ms: Date.now() - startTime,
        node_results: [],
        evidence: [],
        binding_plugins: {
          handlers_loaded: this.bindingPluginLoad.handlers_loaded,
          plugin_dirs: [...this.bindingPluginLoad.plugin_dirs],
          plugin_files: [...this.bindingPluginLoad.plugin_files],
          manifest_path: this.bindingPluginLoad.manifest_path,
          manifest_loaded: this.bindingPluginLoad.manifest_loaded,
          warnings: [...this.bindingPluginLoad.warnings]
        }
      };

      return {
        plan,
        run_result: deniedResult,
        eval_payload: this.evalBridge.buildPayload({
          sceneManifest,
          plan,
          runResult: deniedResult
        })
      };
    }

    await this.auditEmitter.emit('scene_run_authorized', {
      trace_id: traceId,
      scene_ref: sceneManifest.metadata.obj_id,
      scene_version: sceneManifest.metadata.obj_version,
      run_mode: runMode
    });

    let runResult;
    if (runMode === 'dry_run') {
      runResult = await this.runDryRun(sceneManifest, plan, traceId, context);
    } else {
      runResult = await this.runCommit(sceneManifest, plan, traceId, context);
    }

    runResult.policy = policyResult;
    runResult.duration_ms = Date.now() - startTime;
    runResult.binding_plugins = {
      handlers_loaded: this.bindingPluginLoad.handlers_loaded,
      plugin_dirs: [...this.bindingPluginLoad.plugin_dirs],
      plugin_files: [...this.bindingPluginLoad.plugin_files],
      manifest_path: this.bindingPluginLoad.manifest_path,
      manifest_loaded: this.bindingPluginLoad.manifest_loaded,
      warnings: [...this.bindingPluginLoad.warnings]
    };

    await this.auditEmitter.emit('scene_run_completed', {
      trace_id: traceId,
      scene_ref: sceneManifest.metadata.obj_id,
      scene_version: sceneManifest.metadata.obj_version,
      run_mode: runMode,
      payload: {
        status: runResult.status,
        duration_ms: runResult.duration_ms,
        node_count: runResult.node_results.length
      }
    });

    return {
      plan,
      run_result: runResult,
      eval_payload: this.evalBridge.buildPayload({
        sceneManifest,
        plan,
        runResult
      })
    };
  }

  async runDryRun(sceneManifest, plan, traceId, context = {}) {
    const nodeResults = [];
    const evidence = [];

    for (const node of plan.nodes) {
      const status = node.execution.side_effect ? 'skipped_side_effect' : 'validated';
      nodeResults.push({ node_id: node.node_id, status, node_type: node.node_type });
      evidence.push({ node_id: node.node_id, mode: 'dry_run', status });
    }

    const domain = (sceneManifest.spec || {}).domain || 'erp';
    let adapterReadiness = null;
    if (domain === 'hybrid' || domain === 'robot') {
      try {
        adapterReadiness = await this.adapterReadinessChecker(sceneManifest, {
          traceId,
          context,
          plan
        });
      } catch (error) {
        adapterReadiness = {
          ready: false,
          checks: [],
          error: error.message
        };
      }

      await this.auditEmitter.emit('adapter_readiness_checked', {
        trace_id: traceId,
        scene_ref: sceneManifest.metadata.obj_id,
        scene_version: sceneManifest.metadata.obj_version,
        run_mode: 'dry_run',
        payload: adapterReadiness
      });
    }

    return {
      status: adapterReadiness && adapterReadiness.ready === false ? 'blocked' : 'success',
      trace_id: traceId,
      run_mode: 'dry_run',
      node_results: nodeResults,
      evidence,
      adapter_readiness: adapterReadiness || { ready: true, checks: [] }
    };
  }

  async runCommit(sceneManifest, plan, traceId, context) {
    const domain = (sceneManifest.spec || {}).domain || 'erp';

    if (domain === 'hybrid') {
      return {
        status: 'denied',
        trace_id: traceId,
        run_mode: 'commit',
        node_results: [],
        evidence: [],
        error: 'hybrid commit is disabled in runtime pilot'
      };
    }

    const nodeResults = [];
    const evidence = [];

    for (const node of plan.nodes) {
      try {
        if (node.node_type === 'verify' || node.node_type === 'respond') {
          nodeResults.push({ node_id: node.node_id, status: 'success', node_type: node.node_type });
          evidence.push({ node_id: node.node_id, status: 'success', mode: 'commit' });
          await this.auditEmitter.emit('scene_node_executed', {
            trace_id: traceId,
            scene_ref: sceneManifest.metadata.obj_id,
            scene_version: sceneManifest.metadata.obj_version,
            run_mode: 'commit',
            payload: { node_id: node.node_id, status: 'success', node_type: node.node_type }
          });
          continue;
        }

        if (node.node_type === 'human_approval' && !context.approved) {
          throw new Error('human approval node requires approved context');
        }

        const result = await this.executeBindingNode(node, {
          sceneManifest,
          traceId,
          runMode: 'commit',
          context,
          plan
        });

        const nodeStatus = result && result.status === 'failed' ? 'failed' : 'success';

        nodeResults.push({ node_id: node.node_id, status: nodeStatus, node_type: node.node_type });
        evidence.push({ node_id: node.node_id, status: nodeStatus, mode: 'commit', output: result || {} });

        await this.auditEmitter.emit('scene_node_executed', {
          trace_id: traceId,
          scene_ref: sceneManifest.metadata.obj_id,
          scene_version: sceneManifest.metadata.obj_version,
          run_mode: 'commit',
          payload: { node_id: node.node_id, status: nodeStatus, node_type: node.node_type }
        });

        if (nodeStatus === 'failed') {
          throw new Error(`binding failed for node ${node.node_id}`);
        }
      } catch (error) {
        await this.auditEmitter.emit('scene_node_failed', {
          trace_id: traceId,
          scene_ref: sceneManifest.metadata.obj_id,
          scene_version: sceneManifest.metadata.obj_version,
          run_mode: 'commit',
          payload: { node_id: node.node_id, error: error.message }
        });

        if (node.compensation && node.compensation.strategy !== 'none') {
          await this.auditEmitter.emit('scene_compensation_started', {
            trace_id: traceId,
            scene_ref: sceneManifest.metadata.obj_id,
            scene_version: sceneManifest.metadata.obj_version,
            run_mode: 'commit',
            payload: { node_id: node.node_id, strategy: node.compensation.strategy }
          });

          await this.auditEmitter.emit('scene_compensation_completed', {
            trace_id: traceId,
            scene_ref: sceneManifest.metadata.obj_id,
            scene_version: sceneManifest.metadata.obj_version,
            run_mode: 'commit',
            payload: { node_id: node.node_id, strategy: node.compensation.strategy }
          });
        }

        return {
          status: 'failed',
          trace_id: traceId,
          run_mode: 'commit',
          node_results: nodeResults,
          evidence,
          error: error.message
        };
      }
    }

    return {
      status: 'success',
      trace_id: traceId,
      run_mode: 'commit',
      node_results: nodeResults,
      evidence
    };
  }

  async executeBindingNode(node, payload = {}) {
    if (typeof this.bindingExecutor === 'function') {
      return this.bindingExecutor(node, payload);
    }

    if (this.bindingRegistry && typeof this.bindingRegistry.execute === 'function') {
      return this.bindingRegistry.execute(node, payload);
    }

    return this.defaultBindingExecutor(node);
  }

  async defaultBindingExecutor(node) {
    return {
      status: 'success',
      binding_ref: node.binding_ref
    };
  }

  async defaultAdapterReadinessChecker(sceneManifest, payload = {}) {
    if (this.bindingRegistry && typeof this.bindingRegistry.checkReadiness === 'function') {
      return this.bindingRegistry.checkReadiness(sceneManifest, payload);
    }

    return { ready: true, checks: [] };
  }
}

module.exports = RuntimeExecutor;
