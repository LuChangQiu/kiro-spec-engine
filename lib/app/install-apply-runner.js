function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function resolveAppRef(action = {}) {
  return normalizeString(action.app_key) || normalizeString(action.app_id);
}

function getBlockingReasons(plan = {}) {
  const reasons = [];
  const unresolvedCollections = Array.isArray(plan.unresolved_collections) ? plan.unresolved_collections : [];
  if (unresolvedCollections.length > 0) {
    reasons.push('unresolved-collections');
  }
  const skipActions = Array.isArray(plan.actions)
    ? plan.actions.filter((item) => normalizeString(item.decision) === 'skip')
    : [];
  if (skipActions.some((item) => normalizeString(item.reason) === 'app-bundle-not-found')) {
    reasons.push('unresolved-app-bundles');
  }
  if (skipActions.some((item) => normalizeString(item.reason) === 'active-release-protected')) {
    reasons.push('active-release-protected');
  }
  return reasons;
}

async function verifyInstallCandidates(plan = {}, store) {
  const failures = [];
  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  for (const action of actions) {
    if (normalizeString(action.decision) !== 'install') {
      continue;
    }
    const appRef = resolveAppRef(action);
    const graph = appRef ? await store.getAppBundleGraph(appRef) : null;
    const metadata = graph && graph.bundle && graph.bundle.metadata && typeof graph.bundle.metadata === 'object'
      ? graph.bundle.metadata
      : {};
    const serviceCatalog = metadata.service_catalog && typeof metadata.service_catalog === 'object'
      ? metadata.service_catalog
      : {};
    const releases = Array.isArray(serviceCatalog.releases) ? serviceCatalog.releases : [];
    if (!graph || releases.length === 0) {
      failures.push({
        app_ref: appRef,
        reason: 'no-installable-runtime-release'
      });
    }
  }
  return failures;
}

async function verifyActivateCandidates(plan = {}, store) {
  const failures = [];
  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  for (const action of actions) {
    if (normalizeString(action.decision) !== 'activate') {
      continue;
    }
    const appRef = resolveAppRef(action);
    const graph = appRef ? await store.getAppBundleGraph(appRef) : null;
    const metadata = graph && graph.bundle && graph.bundle.metadata && typeof graph.bundle.metadata === 'object'
      ? graph.bundle.metadata
      : {};
    const serviceCatalog = metadata.service_catalog && typeof metadata.service_catalog === 'object'
      ? metadata.service_catalog
      : {};
    const releases = Array.isArray(serviceCatalog.releases) ? serviceCatalog.releases : [];
    const installedReleaseId = normalizeString(action.installed_release_id);
    if (!graph || !installedReleaseId || !releases.some((item) => normalizeString(item && item.release_id) === installedReleaseId)) {
      failures.push({
        app_ref: appRef,
        reason: 'no-activatable-installed-release'
      });
    }
  }
  return failures;
}

function sortExecutableActions(actions = []) {
  const install = [];
  const activate = [];
  const uninstall = [];
  for (const action of actions) {
    const decision = normalizeString(action.decision);
    if (decision === 'install') {
      install.push(action);
    } else if (decision === 'activate') {
      activate.push(action);
    } else if (decision === 'uninstall') {
      uninstall.push(action);
    }
  }
  return [...install, ...activate, ...uninstall];
}

async function executeInstallPlan(plan = {}, options = {}) {
  const store = options.store;
  const executeInstall = options.executeInstall;
  const executeActivate = options.executeActivate;
  const executeUninstall = options.executeUninstall;
  const dependencies = options.dependencies || {};
  const commandOptions = options.commandOptions || {};

  const blockingReasons = getBlockingReasons(plan);
  if (blockingReasons.length > 0) {
    return {
      execute_supported: true,
      executed: false,
      blocked_reason: blockingReasons.join(','),
      results: []
    };
  }

  const installPreflightFailures = await verifyInstallCandidates(plan, store);
  const activatePreflightFailures = await verifyActivateCandidates(plan, store);
  const preflightFailures = [...installPreflightFailures, ...activatePreflightFailures];
  if (preflightFailures.length > 0) {
    return {
      execute_supported: true,
      executed: false,
      blocked_reason: 'install-preflight-failed',
      preflight_failures: preflightFailures,
      results: []
    };
  }

  const results = [];
  const actions = sortExecutableActions(Array.isArray(plan.actions) ? plan.actions : []);
  for (const action of actions) {
    const decision = normalizeString(action.decision);
    const appRef = resolveAppRef(action);
    if (!appRef) {
      return {
        execute_supported: true,
        executed: false,
        blocked_reason: 'invalid-plan-action',
        results
      };
    }
    const nestedOptions = {
      app: appRef,
      authLease: commandOptions.authLease,
      authPassword: commandOptions.authPassword,
      actor: commandOptions.actor,
      json: true,
      silent: true
    };
    if (decision === 'install') {
      const payload = await executeInstall(nestedOptions, dependencies);
      results.push({
        app_ref: appRef,
        decision,
        success: true,
        summary: payload.summary || null
      });
    } else if (decision === 'activate') {
      const payload = await executeActivate({
        ...nestedOptions,
        release: normalizeString(action.installed_release_id)
      }, dependencies);
      results.push({
        app_ref: appRef,
        decision,
        success: true,
        summary: payload.summary || null
      });
    } else if (decision === 'uninstall') {
      const payload = await executeUninstall(nestedOptions, dependencies);
      results.push({
        app_ref: appRef,
        decision,
        success: true,
        summary: payload.summary || null
      });
    }
  }

  return {
    execute_supported: true,
    executed: true,
    blocked_reason: null,
    results
  };
}

module.exports = {
  executeInstallPlan
};
