const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const semver = require('semver');

const CONTRACT_SCHEMA_VERSION = '1.0';
const SCE_STEERING_DIR = path.join('.sce', 'steering');
const MANIFEST_FILENAME = 'manifest.yaml';

const DEFAULT_LAYER_FILES = Object.freeze({
  core_principles: 'CORE_PRINCIPLES.md',
  environment: 'ENVIRONMENT.md',
  current_context: 'CURRENT_CONTEXT.md',
  rules_guide: 'RULES_GUIDE.md',
});

const DEFAULT_MANIFEST = Object.freeze({
  schema_version: CONTRACT_SCHEMA_VERSION,
  engine: 'sce',
  profile: 'default',
  description: 'SCE universal steering contract for cross-agent orchestration',
  layers: { ...DEFAULT_LAYER_FILES },
  compatibility: {
    codex: '>=0.0.0',
    claude: '>=0.0.0',
    cursor: '>=0.0.0',
    generic: '*',
  },
  session: {
    root: '.sce/sessions',
    default_status: 'active',
  },
});

const TOOL_RUNTIME_PROFILES = Object.freeze({
  codex: {
    recommended_command: 'codex exec --sandbox danger-full-access --ask-for-approval never',
    default_permission_args: ['--sandbox', 'danger-full-access', '--ask-for-approval', 'never'],
    notes: 'Full runtime permissions with no approval prompts.',
  },
  claude: {
    recommended_command: 'claude --dangerously-skip-permission',
    default_permission_args: ['--dangerously-skip-permission'],
    notes: 'Recommended full permission mode for SCE-driven autonomous tasks.',
  },
  'claude-code': {
    recommended_command: 'claude --dangerously-skip-permission',
    default_permission_args: ['--dangerously-skip-permission'],
    notes: 'Alias of claude profile.',
  },
  cursor: {
    recommended_command: 'cursor',
    default_permission_args: [],
    notes: 'Permission handling depends on Cursor runtime policy.',
  },
  generic: {
    recommended_command: '',
    default_permission_args: [],
    notes: 'Provide runtime permission args in the target agent adapter.',
  },
});

function normalizeToolName(value) {
  const raw = `${value || ''}`.trim().toLowerCase();
  if (!raw) {
    return 'generic';
  }
  if (raw === 'claude-code') {
    return 'claude';
  }
  if (raw === 'codex' || raw === 'claude' || raw === 'cursor') {
    return raw;
  }
  return 'generic';
}

function toRelativePosix(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
}

class SteeringContract {
  constructor(workspaceRoot) {
    this._workspaceRoot = workspaceRoot;
    this._sceSteeringDir = path.join(workspaceRoot, SCE_STEERING_DIR);
    this._manifestPath = path.join(this._sceSteeringDir, MANIFEST_FILENAME);
  }

  get manifestPath() {
    return this._manifestPath;
  }

  get sceSteeringDir() {
    return this._sceSteeringDir;
  }

  async ensureContract() {
    await fs.ensureDir(this._sceSteeringDir);

    let createdManifest = false;
    if (!await fs.pathExists(this._manifestPath)) {
      await fs.writeFile(this._manifestPath, yaml.dump(DEFAULT_MANIFEST, { lineWidth: 120 }), 'utf8');
      createdManifest = true;
    }

    const manifest = await this.loadManifest();
    const preparedLayers = [];
    for (const [layerName, filename] of Object.entries(manifest.layers)) {
      const targetPath = path.join(this._sceSteeringDir, filename);
      if (await fs.pathExists(targetPath)) {
        preparedLayers.push({ layer: layerName, file: filename, source: 'sce' });
        continue;
      }

      await fs.writeFile(targetPath, this._buildDefaultLayerContent(layerName, filename), 'utf8');
      preparedLayers.push({ layer: layerName, file: filename, source: 'template' });
    }

    return {
      createdManifest,
      manifestPath: toRelativePosix(this._workspaceRoot, this._manifestPath),
      preparedLayers,
    };
  }

  async loadManifest() {
    let raw = {};
    try {
      if (await fs.pathExists(this._manifestPath)) {
        raw = yaml.load(await fs.readFile(this._manifestPath, 'utf8')) || {};
      }
    } catch (_error) {
      raw = {};
    }
    return this._normalizeManifest(raw);
  }

  async resolveLayerFile(filename) {
    const scePath = path.join(this._sceSteeringDir, filename);
    if (await fs.pathExists(scePath)) {
      return { source: 'sce', path: scePath };
    }
    return null;
  }

  async loadLayerBundle() {
    const manifest = await this.loadManifest();
    const layers = {};
    const sourceSet = new Set();

    for (const [layerName, filename] of Object.entries(manifest.layers)) {
      const resolved = await this.resolveLayerFile(filename);
      if (!resolved) {
        layers[layerName] = {
          file: filename,
          source: 'missing',
          path: null,
          content: null,
        };
        continue;
      }

      const content = await fs.readFile(resolved.path, 'utf8');
      sourceSet.add(resolved.source);
      layers[layerName] = {
        file: filename,
        source: resolved.source,
        path: toRelativePosix(this._workspaceRoot, resolved.path),
        content: content.trim(),
      };
    }

    return {
      manifest,
      layers,
      source_mode: this._resolveSourceMode(sourceSet),
    };
  }

  async buildCompilePayload(tool, agentVersion = null) {
    const normalizedTool = normalizeToolName(tool);
    const runtime = TOOL_RUNTIME_PROFILES[normalizedTool] || TOOL_RUNTIME_PROFILES.generic;
    const bundle = await this.loadLayerBundle();
    const compatibility = this._evaluateCompatibility(bundle.manifest, normalizedTool, agentVersion);

    return {
      schema_version: CONTRACT_SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      tool: normalizedTool,
      agent_version: agentVersion ? `${agentVersion}` : null,
      source_mode: bundle.source_mode,
      manifest: bundle.manifest,
      runtime,
      compatibility,
      layers: bundle.layers,
    };
  }

  renderMarkdown(payload) {
    const sections = [];
    sections.push('# SCE Steering Compile');
    sections.push('');
    sections.push(`- schema_version: ${payload.schema_version}`);
    sections.push(`- generated_at: ${payload.generated_at}`);
    sections.push(`- tool: ${payload.tool}`);
    sections.push(`- agent_version: ${payload.agent_version || '(not provided)'}`);
    sections.push(`- source_mode: ${payload.source_mode}`);
    sections.push('');
    sections.push('## Runtime Permission Profile');
    sections.push('');
    sections.push(`- recommended_command: ${payload.runtime.recommended_command || '(none)'}`);
    sections.push(`- default_permission_args: ${payload.runtime.default_permission_args.join(' ') || '(none)'}`);
    sections.push(`- notes: ${payload.runtime.notes}`);
    sections.push('');
    sections.push('## Compatibility');
    sections.push('');
    sections.push(`- rule: ${payload.compatibility.rule}`);
    sections.push(`- supported: ${payload.compatibility.supported === null ? 'unknown' : payload.compatibility.supported}`);
    sections.push(`- reason: ${payload.compatibility.reason}`);
    sections.push('');
    sections.push('## Layers');
    sections.push('');

    for (const [layerName, layer] of Object.entries(payload.layers)) {
      sections.push(`### ${layerName} (${layer.file})`);
      sections.push(`- source: ${layer.source}`);
      sections.push(`- path: ${layer.path || '(missing)'}`);
      sections.push('');
      if (layer.content) {
        sections.push(layer.content);
      } else {
        sections.push('(missing)');
      }
      sections.push('');
    }

    return sections.join('\n').trim() + '\n';
  }

  _normalizeManifest(raw) {
    const layers = (raw && raw.layers && typeof raw.layers === 'object')
      ? raw.layers
      : {};
    const normalizedLayers = {};
    for (const [key, filename] of Object.entries(DEFAULT_LAYER_FILES)) {
      normalizedLayers[key] = typeof layers[key] === 'string' && layers[key].trim()
        ? layers[key].trim()
        : filename;
    }

    return {
      schema_version: `${raw.schema_version || DEFAULT_MANIFEST.schema_version}`,
      engine: `${raw.engine || DEFAULT_MANIFEST.engine}`,
      profile: `${raw.profile || DEFAULT_MANIFEST.profile}`,
      description: `${raw.description || DEFAULT_MANIFEST.description}`,
      layers: normalizedLayers,
      compatibility: this._normalizeCompatibility(raw.compatibility),
      session: {
        root: raw.session && typeof raw.session.root === 'string'
          ? raw.session.root
          : DEFAULT_MANIFEST.session.root,
        default_status: raw.session && typeof raw.session.default_status === 'string'
          ? raw.session.default_status
          : DEFAULT_MANIFEST.session.default_status,
      },
    };
  }

  _resolveSourceMode(sourceSet) {
    if (sourceSet.has('sce')) {
      return 'sce';
    }
    return 'empty';
  }

  _normalizeCompatibility(rawCompatibility) {
    const input = rawCompatibility && typeof rawCompatibility === 'object'
      ? rawCompatibility
      : {};
    const normalized = {};
    for (const [tool, defaultRange] of Object.entries(DEFAULT_MANIFEST.compatibility)) {
      const value = input[tool];
      normalized[tool] = typeof value === 'string' && value.trim() ? value.trim() : defaultRange;
    }
    return normalized;
  }

  _evaluateCompatibility(manifest, tool, agentVersion) {
    const rule = manifest.compatibility && manifest.compatibility[tool]
      ? manifest.compatibility[tool]
      : (manifest.compatibility && manifest.compatibility.generic) || '*';
    if (!agentVersion || `${agentVersion}`.trim() === '') {
      return {
        rule,
        supported: null,
        reason: 'agent version not provided',
      };
    }
    const coerced = semver.coerce(`${agentVersion}`.trim());
    if (!coerced) {
      return {
        rule,
        supported: null,
        reason: `unable to parse version: ${agentVersion}`,
      };
    }
    const parsedVersion = semver.valid(coerced.version);
    const supported = rule === '*' ? true : semver.satisfies(parsedVersion, rule, { includePrerelease: true });
    return {
      rule,
      supported,
      reason: supported
        ? `version ${parsedVersion} satisfies ${rule}`
        : `version ${parsedVersion} does not satisfy ${rule}`,
    };
  }

  _buildDefaultLayerContent(layerName, filename) {
    return [
      `# ${filename}`,
      '',
      `Managed by SCE universal steering contract.`,
      `Layer: ${layerName}`,
      '',
      '- Fill this file with project-specific constraints and guidance.',
    ].join('\n');
  }
}

module.exports = {
  SteeringContract,
  CONTRACT_SCHEMA_VERSION,
  DEFAULT_LAYER_FILES,
  DEFAULT_MANIFEST,
  MANIFEST_FILENAME,
  SCE_STEERING_DIR,
  TOOL_RUNTIME_PROFILES,
  normalizeToolName,
};
