function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

class PlanCompiler {
  compile(sceneManifest, options = {}) {
    const runMode = options.runMode || 'dry_run';
    const traceId = options.traceId || makeId('trace');
    const planId = options.planId || makeId('plan');

    const spec = sceneManifest.spec || {};
    const bindings = (((spec || {}).capability_contract || {}).bindings) || [];
    const idempotencyKey = (((spec || {}).governance_contract || {}).idempotency || {}).key || null;
    const hasWriteSet = Array.isArray((spec.model_scope || {}).write) && spec.model_scope.write.length > 0;

    const nodes = bindings.map((binding, index) => {
      const nodeId = `n-${String(index + 1).padStart(2, '0')}`;
      const nodeType = this.mapNodeType(binding.type);
      const sideEffect = typeof binding.side_effect === 'boolean'
        ? binding.side_effect
        : (hasWriteSet && ['service', 'script', 'adapter'].includes(nodeType));

      return {
        node_id: nodeId,
        node_type: nodeType,
        binding_ref: binding.ref,
        preconditions: binding.preconditions || [],
        execution: {
          timeout_ms: binding.timeout_ms || 3000,
          retry_max: binding.retry || 0,
          idempotency_key: sideEffect ? idempotencyKey : null,
          side_effect: sideEffect
        },
        compensation: {
          strategy: sideEffect ? 'compensation' : 'none',
          action_ref: binding.compensation_ref || null
        },
        evidence_capture: {
          enabled: true,
          fields: binding.evidence_fields || []
        },
        on_failure: binding.on_failure || 'abort',
        next: []
      };
    });

    this.linkLinearNodes(nodes);
    nodes.push(this.createVerifyNode(nodes.length));
    nodes.push(this.createRespondNode(nodes.length));

    this.linkLinearNodes(nodes);

    const plan = {
      plan_id: planId,
      scene_ref: sceneManifest.metadata.obj_id,
      scene_version: sceneManifest.metadata.obj_version,
      run_mode: runMode,
      trace_id: traceId,
      nodes
    };

    const validation = this.validatePlan(plan);
    if (!validation.valid) {
      const error = new Error(`Invalid plan: ${validation.errors.join('; ')}`);
      error.validationErrors = validation.errors;
      throw error;
    }

    return plan;
  }

  mapNodeType(bindingType) {
    const type = (bindingType || 'service').toLowerCase();
    if (['query', 'service', 'script', 'adapter'].includes(type)) {
      return type;
    }
    return 'service';
  }

  createVerifyNode(index) {
    return {
      node_id: `n-${String(index + 1).padStart(2, '0')}`,
      node_type: 'verify',
      binding_ref: 'system.verify',
      preconditions: [],
      execution: {
        timeout_ms: 1000,
        retry_max: 0,
        idempotency_key: null,
        side_effect: false
      },
      compensation: { strategy: 'none', action_ref: null },
      evidence_capture: { enabled: true, fields: [] },
      on_failure: 'abort',
      next: []
    };
  }

  createRespondNode(index) {
    return {
      node_id: `n-${String(index + 1).padStart(2, '0')}`,
      node_type: 'respond',
      binding_ref: 'system.respond',
      preconditions: [],
      execution: {
        timeout_ms: 1000,
        retry_max: 0,
        idempotency_key: null,
        side_effect: false
      },
      compensation: { strategy: 'none', action_ref: null },
      evidence_capture: { enabled: true, fields: [] },
      on_failure: 'abort',
      next: []
    };
  }

  linkLinearNodes(nodes) {
    nodes.forEach((node, index) => {
      node.next = index < nodes.length - 1 ? [nodes[index + 1].node_id] : [];
    });
  }

  validatePlan(plan) {
    const errors = [];

    if (!plan || typeof plan !== 'object') {
      return { valid: false, errors: ['plan must be an object'] };
    }

    if (!Array.isArray(plan.nodes) || plan.nodes.length === 0) {
      errors.push('plan.nodes must be a non-empty array');
      return { valid: false, errors };
    }

    const nodeIds = new Set();
    let hasRespondTerminal = false;

    for (const node of plan.nodes) {
      if (!node.node_id) {
        errors.push('every node must have node_id');
        continue;
      }

      if (nodeIds.has(node.node_id)) {
        errors.push(`duplicate node_id: ${node.node_id}`);
      }
      nodeIds.add(node.node_id);

      if (node.node_type === 'respond') {
        hasRespondTerminal = true;
      }

      if (node.execution && node.execution.side_effect) {
        if (!node.execution.idempotency_key) {
          errors.push(`side-effect node ${node.node_id} missing idempotency_key`);
        }
      }
    }

    if (!hasRespondTerminal) {
      errors.push('plan must include a respond terminal node');
    }

    for (const node of plan.nodes) {
      for (const nextNodeId of node.next || []) {
        if (!nodeIds.has(nextNodeId)) {
          errors.push(`node ${node.node_id} points to unknown node ${nextNodeId}`);
        }
      }
    }

    if (this.hasUnboundedCycle(plan.nodes)) {
      errors.push('plan contains cycle');
    }

    return { valid: errors.length === 0, errors };
  }

  hasUnboundedCycle(nodes) {
    const adjacency = new Map(nodes.map((node) => [node.node_id, node.next || []]));
    const visiting = new Set();
    const visited = new Set();

    const walk = (nodeId) => {
      if (visiting.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visiting.add(nodeId);
      const nextList = adjacency.get(nodeId) || [];
      for (const nextId of nextList) {
        if (walk(nextId)) return true;
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (walk(node.node_id)) return true;
    }

    return false;
  }
}

module.exports = PlanCompiler;
