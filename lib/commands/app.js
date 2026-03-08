const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const { ensureWriteAuthorization } = require('../security/write-authorization');
const { getSceStateStore } = require('../state/sce-state-store');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizePositiveInteger(value, fallback = 50, max = 1000) {
  const parsed = Number.parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalizeString(`${value || ''}`).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function createStore(dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const env = dependencies.env || process.env;
  return dependencies.stateStore || getSceStateStore(projectPath, {
    fileSystem,
    env
  });
}

function printPayload(payload, options = {}, title = 'App Bundle') {
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(chalk.blue(title));
  if (payload.mode) {
    console.log(`  Mode: ${payload.mode}`);
  }
  if (payload.summary && typeof payload.summary === 'object') {
    for (const [key, value] of Object.entries(payload.summary)) {
      console.log(`  ${key}: ${value}`);
    }
  }
  if (Array.isArray(payload.items)) {
    payload.items.forEach((item) => {
      console.log(`  - ${item.app_id} | ${item.app_key} | ${item.app_name} | ${item.status}`);
    });
  }
}

function buildBundleSummary(graph = {}) {
  const bundle = graph.bundle || {};
  const runtimeRelease = graph.runtime_release || {};
  const ontologyBundle = graph.ontology_bundle || {};
  const engineeringProject = graph.engineering_project || {};
  const sceneBindings = Array.isArray(graph.scene_bindings) ? graph.scene_bindings : [];
  return {
    app_id: bundle.app_id || null,
    app_key: bundle.app_key || null,
    app_name: bundle.app_name || null,
    status: bundle.status || null,
    environment: bundle.environment || null,
    runtime_version: runtimeRelease.runtime_version || null,
    ontology_version: ontologyBundle.ontology_version || null,
    code_version: engineeringProject.code_version || null,
    scene_binding_count: sceneBindings.length
  };
}

function buildEngineeringSummary(graph = {}) {
  const bundle = graph.bundle || {};
  const engineeringProject = graph.engineering_project || {};
  const metadata = engineeringProject.metadata && typeof engineeringProject.metadata === 'object'
    ? engineeringProject.metadata
    : {};
  return {
    app_id: bundle.app_id || null,
    app_name: bundle.app_name || null,
    engineering_project_id: engineeringProject.engineering_project_id || null,
    project_name: engineeringProject.project_name || null,
    repo_url: engineeringProject.repo_url || null,
    current_branch: engineeringProject.current_branch || null,
    workspace_path: engineeringProject.workspace_path || null,
    code_version: engineeringProject.code_version || null,
    dirty_state: engineeringProject.dirty_state === true,
    hydrated: Boolean(metadata.hydration && metadata.hydration.status === 'ready'),
    active: Boolean(metadata.activation && metadata.activation.active === true)
  };
}

function deriveEngineeringProjectId(bundle = {}) {
  const appKey = normalizeString(bundle.app_key);
  if (appKey) {
    return `eng.${appKey.replace(/[^a-zA-Z0-9._-]+/g, '-')}`;
  }
  const appId = normalizeString(bundle.app_id).replace(/^app\./, '');
  return appId ? `eng.${appId.replace(/[^a-zA-Z0-9._-]+/g, '-')}` : null;
}

function graphToRegisterPayload(graph = {}) {
  const bundle = graph.bundle || {};
  const runtimeRelease = graph.runtime_release || {};
  const ontologyBundle = graph.ontology_bundle || {};
  const engineeringProject = graph.engineering_project || {};
  return {
    app_id: bundle.app_id,
    app_key: bundle.app_key,
    app_name: bundle.app_name,
    app_slug: bundle.app_slug || undefined,
    workspace_id: bundle.workspace_id || undefined,
    runtime_release_id: bundle.runtime_release_id || undefined,
    ontology_bundle_id: bundle.ontology_bundle_id || undefined,
    engineering_project_id: bundle.engineering_project_id || undefined,
    default_scene_id: bundle.default_scene_id || undefined,
    environment: bundle.environment || undefined,
    status: bundle.status || undefined,
    source_origin: bundle.source_origin || undefined,
    tags: Array.isArray(bundle.tags) ? bundle.tags : [],
    metadata: bundle.metadata && typeof bundle.metadata === 'object' ? bundle.metadata : {},
    runtime: runtimeRelease && runtimeRelease.release_id ? {
      release_id: runtimeRelease.release_id,
      runtime_version: runtimeRelease.runtime_version,
      release_channel: runtimeRelease.release_channel,
      release_status: runtimeRelease.release_status,
      entrypoint: runtimeRelease.entrypoint,
      runtime_status: runtimeRelease.runtime_status,
      release_notes_file: runtimeRelease.release_notes_file,
      release_evidence_file: runtimeRelease.release_evidence_file,
      published_at: runtimeRelease.published_at,
      source_updated_at: runtimeRelease.source_updated_at,
      metadata: runtimeRelease.metadata || {}
    } : undefined,
    ontology: ontologyBundle && ontologyBundle.ontology_bundle_id ? {
      ontology_bundle_id: ontologyBundle.ontology_bundle_id,
      ontology_version: ontologyBundle.ontology_version,
      template_version: ontologyBundle.template_version,
      capability_catalog_version: ontologyBundle.capability_catalog_version,
      triad_revision: ontologyBundle.triad_revision,
      triad_status: ontologyBundle.triad_status,
      publish_readiness: ontologyBundle.publish_readiness,
      template_source: ontologyBundle.template_source,
      capability_set: Array.isArray(ontologyBundle.capability_set) ? ontologyBundle.capability_set : [],
      summary: ontologyBundle.summary || {},
      metadata: ontologyBundle.metadata || {}
    } : undefined,
    engineering: engineeringProject && engineeringProject.engineering_project_id ? {
      engineering_project_id: engineeringProject.engineering_project_id,
      project_key: engineeringProject.project_key,
      project_name: engineeringProject.project_name,
      repo_url: engineeringProject.repo_url,
      repo_provider: engineeringProject.repo_provider,
      default_branch: engineeringProject.default_branch,
      current_branch: engineeringProject.current_branch,
      commit_sha: engineeringProject.commit_sha,
      workspace_path: engineeringProject.workspace_path,
      code_version: engineeringProject.code_version,
      synced_runtime_release_id: engineeringProject.synced_runtime_release_id,
      dirty_state: engineeringProject.dirty_state === true,
      auth_policy: engineeringProject.auth_policy || {},
      metadata: engineeringProject.metadata || {}
    } : undefined,
    scene_bindings: Array.isArray(graph.scene_bindings) ? graph.scene_bindings.map((item) => ({
      scene_id: item.scene_id,
      binding_role: item.binding_role,
      source: item.source,
      metadata: item.metadata || {}
    })) : []
  };
}

async function requireAppGraph(appRef, dependencies = {}) {
  const store = createStore(dependencies);
  const graph = await store.getAppBundleGraph(appRef);
  if (!graph) {
    throw new Error(`app bundle not found: ${appRef}`);
  }
  return { store, graph };
}

async function ensureAuthorized(action, options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const env = dependencies.env || process.env;
  await ensureWriteAuthorization(action, {
    authLease: options.authLease,
    authPassword: options.authPassword,
    actor: options.actor
  }, {
    projectPath,
    fileSystem,
    env
  });
}

async function runAppBundleListCommand(options = {}, dependencies = {}) {
  const store = createStore(dependencies);
  const items = await store.listAppBundles({
    limit: normalizePositiveInteger(options.limit, 50, 1000),
    status: options.status,
    environment: options.environment,
    workspaceId: options.workspaceId,
    query: options.query
  });
  const payload = {
    mode: 'app-bundle-list',
    generated_at: new Date().toISOString(),
    query: {
      limit: normalizePositiveInteger(options.limit, 50, 1000),
      status: normalizeString(options.status) || null,
      environment: normalizeString(options.environment) || null,
      workspace_id: normalizeString(options.workspaceId) || null,
      query: normalizeString(options.query) || null
    },
    summary: {
      total: Array.isArray(items) ? items.length : 0
    },
    items: Array.isArray(items) ? items : []
  };
  printPayload(payload, options, 'App Bundle List');
  return payload;
}

async function runAppBundleShowCommand(options = {}, dependencies = {}) {
  const appRef = normalizeString(options.app || options.appRef);
  if (!appRef) {
    throw new Error('--app is required');
  }
  const { graph } = await requireAppGraph(appRef, dependencies);
  const payload = {
    mode: 'app-bundle-show',
    generated_at: new Date().toISOString(),
    query: {
      app: appRef
    },
    summary: buildBundleSummary(graph),
    bundle: graph.bundle,
    runtime_release: graph.runtime_release,
    ontology_bundle: graph.ontology_bundle,
    engineering_project: graph.engineering_project,
    scene_bindings: graph.scene_bindings || []
  };
  printPayload(payload, options, 'App Bundle Show');
  return payload;
}

async function runAppBundleRegisterCommand(options = {}, dependencies = {}) {
  const inputFile = normalizeString(options.input);
  if (!inputFile) {
    throw new Error('--input is required');
  }
  await ensureAuthorized('app:bundle:register', options, dependencies);
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const env = dependencies.env || process.env;
  const resolvedInput = path.isAbsolute(inputFile)
    ? inputFile
    : path.join(projectPath, inputFile);
  const payloadJson = await fileSystem.readJson(resolvedInput);
  const store = createStore({ ...dependencies, projectPath, fileSystem, env });
  const graph = await store.registerAppBundle(payloadJson);
  const payload = {
    mode: 'app-bundle-register',
    success: true,
    input_file: resolvedInput,
    summary: buildBundleSummary(graph),
    bundle: graph.bundle,
    runtime_release: graph.runtime_release,
    ontology_bundle: graph.ontology_bundle,
    engineering_project: graph.engineering_project,
    scene_bindings: graph.scene_bindings || []
  };
  printPayload(payload, options, 'App Bundle Register');
  return payload;
}

async function runAppEngineeringShowCommand(options = {}, dependencies = {}) {
  const appRef = normalizeString(options.app);
  if (!appRef) {
    throw new Error('--app is required');
  }
  const { graph } = await requireAppGraph(appRef, dependencies);
  const payload = {
    mode: 'app-engineering-show',
    generated_at: new Date().toISOString(),
    query: {
      app: appRef
    },
    summary: buildEngineeringSummary(graph),
    bundle: graph.bundle,
    engineering_project: graph.engineering_project,
    scene_bindings: graph.scene_bindings || []
  };
  printPayload(payload, options, 'App Engineering Show');
  return payload;
}

async function runAppEngineeringAttachCommand(options = {}, dependencies = {}) {
  const appRef = normalizeString(options.app);
  if (!appRef) {
    throw new Error('--app is required');
  }
  const repoUrl = normalizeString(options.repo);
  if (!repoUrl) {
    throw new Error('--repo is required');
  }
  await ensureAuthorized('app:engineering:attach', options, dependencies);
  const { store, graph } = await requireAppGraph(appRef, dependencies);
  const nextPayload = graphToRegisterPayload(graph);
  const bundle = graph.bundle || {};
  const currentEngineering = nextPayload.engineering && typeof nextPayload.engineering === 'object'
    ? nextPayload.engineering
    : {};
  const engineeringProjectId = currentEngineering.engineering_project_id || deriveEngineeringProjectId(bundle);
  const nowIso = new Date().toISOString();
  nextPayload.engineering_project_id = engineeringProjectId;
  nextPayload.engineering = {
    ...currentEngineering,
    engineering_project_id: engineeringProjectId,
    project_name: normalizeString(options.projectName) || currentEngineering.project_name || bundle.app_name || null,
    project_key: normalizeString(options.projectKey) || currentEngineering.project_key || bundle.app_key || null,
    repo_url: repoUrl,
    repo_provider: normalizeString(options.provider) || currentEngineering.repo_provider || null,
    default_branch: normalizeString(options.branch) || currentEngineering.default_branch || null,
    current_branch: normalizeString(options.branch) || currentEngineering.current_branch || null,
    workspace_path: normalizeString(options.workspacePath) || currentEngineering.workspace_path || null,
    code_version: normalizeString(options.codeVersion) || currentEngineering.code_version || null,
    dirty_state: currentEngineering.dirty_state === true,
    metadata: {
      ...(currentEngineering.metadata || {}),
      attachment: {
        attached_at: nowIso,
        source: 'sce app engineering attach',
        repo_url: repoUrl
      }
    }
  };
  const updated = await store.registerAppBundle(nextPayload);
  const payload = {
    mode: 'app-engineering-attach',
    success: true,
    summary: buildEngineeringSummary(updated),
    bundle: updated.bundle,
    engineering_project: updated.engineering_project,
    scene_bindings: updated.scene_bindings || []
  };
  printPayload(payload, options, 'App Engineering Attach');
  return payload;
}

async function runAppEngineeringHydrateCommand(options = {}, dependencies = {}) {
  const appRef = normalizeString(options.app);
  if (!appRef) {
    throw new Error('--app is required');
  }
  await ensureAuthorized('app:engineering:hydrate', options, dependencies);
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const { store, graph } = await requireAppGraph(appRef, { ...dependencies, projectPath, fileSystem });
  const bundle = graph.bundle || {};
  const nextPayload = graphToRegisterPayload(graph);
  const currentEngineering = nextPayload.engineering && typeof nextPayload.engineering === 'object'
    ? nextPayload.engineering
    : {};
  const engineeringProjectId = currentEngineering.engineering_project_id || deriveEngineeringProjectId(bundle);
  const workspacePath = normalizeString(options.workspacePath)
    || normalizeString(currentEngineering.workspace_path)
    || path.join(projectPath, '.sce', 'apps', bundle.app_key || bundle.app_id || engineeringProjectId, 'engineering');
  await fileSystem.ensureDir(workspacePath);
  const nowIso = new Date().toISOString();
  nextPayload.engineering_project_id = engineeringProjectId;
  nextPayload.engineering = {
    ...currentEngineering,
    engineering_project_id: engineeringProjectId,
    workspace_path: workspacePath,
    metadata: {
      ...(currentEngineering.metadata || {}),
      hydration: {
        status: 'ready',
        hydrated_at: nowIso,
        source: 'sce app engineering hydrate'
      }
    }
  };
  const updated = await store.registerAppBundle(nextPayload);
  const payload = {
    mode: 'app-engineering-hydrate',
    success: true,
    summary: buildEngineeringSummary(updated),
    bundle: updated.bundle,
    engineering_project: updated.engineering_project,
    hydrated_workspace_path: workspacePath
  };
  printPayload(payload, options, 'App Engineering Hydrate');
  return payload;
}

async function runAppEngineeringActivateCommand(options = {}, dependencies = {}) {
  const appRef = normalizeString(options.app);
  if (!appRef) {
    throw new Error('--app is required');
  }
  await ensureAuthorized('app:engineering:activate', options, dependencies);
  const { store, graph } = await requireAppGraph(appRef, dependencies);
  const nextPayload = graphToRegisterPayload(graph);
  const bundle = graph.bundle || {};
  const currentEngineering = nextPayload.engineering && typeof nextPayload.engineering === 'object'
    ? nextPayload.engineering
    : {};
  const engineeringProjectId = currentEngineering.engineering_project_id || deriveEngineeringProjectId(bundle);
  const workspacePath = normalizeString(options.workspacePath) || normalizeString(currentEngineering.workspace_path);
  if (!workspacePath) {
    throw new Error('engineering workspace_path is not set; run app engineering attach/hydrate first or pass --workspace-path');
  }
  const nowIso = new Date().toISOString();
  nextPayload.engineering_project_id = engineeringProjectId;
  nextPayload.engineering = {
    ...currentEngineering,
    engineering_project_id: engineeringProjectId,
    workspace_path: workspacePath,
    metadata: {
      ...(currentEngineering.metadata || {}),
      activation: {
        active: true,
        activated_at: nowIso,
        source: 'sce app engineering activate'
      }
    }
  };
  const updated = await store.registerAppBundle(nextPayload);
  const payload = {
    mode: 'app-engineering-activate',
    success: true,
    summary: buildEngineeringSummary(updated),
    bundle: updated.bundle,
    engineering_project: updated.engineering_project,
    activated_workspace_path: workspacePath
  };
  printPayload(payload, options, 'App Engineering Activate');
  return payload;
}

function safeRun(handler, options = {}, context = 'app command') {
  Promise.resolve(handler(options))
    .catch((error) => {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
      } else {
        console.error(chalk.red(`${context} failed:`), error.message);
      }
      process.exitCode = 1;
    });
}

function registerAppCommands(program) {
  const app = program
    .command('app')
    .description('Manage app bundles that bind application/ontology/engineering projections');

  const bundle = app
    .command('bundle')
    .description('Manage app bundle registry');

  bundle
    .command('list')
    .description('List app bundles')
    .option('--limit <n>', 'Maximum rows', '50')
    .option('--status <status>', 'Filter by status')
    .option('--environment <env>', 'Filter by environment')
    .option('--workspace-id <id>', 'Filter by workspace id')
    .option('--query <text>', 'Free-text query against id/key/name')
    .option('--json', 'Print machine-readable JSON output')
    .action((options) => safeRun(runAppBundleListCommand, options, 'app bundle list'));

  bundle
    .command('show')
    .description('Show one app bundle with linked runtime/ontology/engineering records')
    .requiredOption('--app <app-id-or-key>', 'App id or app key')
    .option('--json', 'Print machine-readable JSON output')
    .action((options) => safeRun(runAppBundleShowCommand, options, 'app bundle show'));

  bundle
    .command('register')
    .description('Register or update an app bundle from JSON input')
    .requiredOption('--input <path>', 'Bundle JSON input file')
    .option('--auth-lease <lease-id>', 'Write authorization lease id')
    .option('--auth-password <password>', 'Inline auth password if policy allows')
    .option('--actor <actor>', 'Audit actor override')
    .option('--json', 'Print machine-readable JSON output')
    .action((options) => safeRun(runAppBundleRegisterCommand, options, 'app bundle register'));

  const engineering = app
    .command('engineering')
    .description('Manage engineering project projection for one app bundle');

  engineering
    .command('show')
    .description('Show engineering projection for one app bundle')
    .requiredOption('--app <app-id-or-key>', 'App id or app key')
    .option('--json', 'Print machine-readable JSON output')
    .action((options) => safeRun(runAppEngineeringShowCommand, options, 'app engineering show'));

  engineering
    .command('attach')
    .description('Attach engineering project metadata to one app bundle')
    .requiredOption('--app <app-id-or-key>', 'App id or app key')
    .requiredOption('--repo <repo-url>', 'Repository url')
    .option('--provider <provider>', 'Repository provider')
    .option('--branch <branch>', 'Default/current branch')
    .option('--workspace-path <path>', 'Workspace path to bind')
    .option('--project-name <name>', 'Project display name override')
    .option('--project-key <key>', 'Project key override')
    .option('--code-version <version>', 'Code version summary')
    .option('--auth-lease <lease-id>', 'Write authorization lease id')
    .option('--auth-password <password>', 'Inline auth password if policy allows')
    .option('--actor <actor>', 'Audit actor override')
    .option('--json', 'Print machine-readable JSON output')
    .action((options) => safeRun(runAppEngineeringAttachCommand, options, 'app engineering attach'));

  engineering
    .command('hydrate')
    .description('Prepare local engineering workspace for one app bundle')
    .requiredOption('--app <app-id-or-key>', 'App id or app key')
    .option('--workspace-path <path>', 'Explicit workspace path')
    .option('--auth-lease <lease-id>', 'Write authorization lease id')
    .option('--auth-password <password>', 'Inline auth password if policy allows')
    .option('--actor <actor>', 'Audit actor override')
    .option('--json', 'Print machine-readable JSON output')
    .action((options) => safeRun(runAppEngineeringHydrateCommand, options, 'app engineering hydrate'));

  engineering
    .command('activate')
    .description('Activate engineering workspace for one app bundle')
    .requiredOption('--app <app-id-or-key>', 'App id or app key')
    .option('--workspace-path <path>', 'Override workspace path for activation')
    .option('--auth-lease <lease-id>', 'Write authorization lease id')
    .option('--auth-password <password>', 'Inline auth password if policy allows')
    .option('--actor <actor>', 'Audit actor override')
    .option('--json', 'Print machine-readable JSON output')
    .action((options) => safeRun(runAppEngineeringActivateCommand, options, 'app engineering activate'));
}

module.exports = {
  runAppBundleListCommand,
  runAppBundleShowCommand,
  runAppBundleRegisterCommand,
  runAppEngineeringShowCommand,
  runAppEngineeringAttachCommand,
  runAppEngineeringHydrateCommand,
  runAppEngineeringActivateCommand,
  registerAppCommands
};
