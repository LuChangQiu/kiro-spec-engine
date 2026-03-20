const path = require('path');
const fs = require('fs-extra');
const WorkspaceStateManager = require('../workspace/multi/workspace-state-manager');
const {
  buildLocalProjectId,
  buildWorkspaceProjectId
} = require('./portfolio-projection-service');

const PROJECT_CANDIDATE_REASON_CODES = {
  ROOT_ACCESSIBLE: 'project.root.accessible',
  ROOT_INACCESSIBLE: 'project.root.inaccessible',
  ROOT_INVALID_TYPE: 'project.root.invalid_type',
  WORKSPACE_REGISTERED: 'project.workspace.registered',
  SCE_PRESENT: 'project.sce.present',
  ROOT_NOT_INITIALIZED: 'project.root.not_initialized',
  INVALID_PROJECT_METADATA: 'project.metadata.invalid',
  UNREGISTERED_PROJECT: 'project.sce.unregistered'
};

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizePath(value) {
  return normalizeString(value).replace(/\\/g, '/');
}

function buildProjectName(rootDir) {
  return path.basename(rootDir) || 'project';
}

async function resolveExactWorkspaceByRoot(rootDir, stateManager) {
  const workspaces = await stateManager.listWorkspaces();
  const normalizedRoot = normalizePath(rootDir);
  return workspaces.find((workspace) => normalizePath(workspace && workspace.path) === normalizedRoot) || null;
}

async function inspectSceMetadata(rootDir, fileSystem = fs) {
  const sceRoot = path.join(rootDir, '.sce');
  if (!await fileSystem.pathExists(sceRoot)) {
    return {
      scePresent: false,
      metadataValid: true,
      metadataReasonCodes: []
    };
  }

  try {
    const sceStats = await fileSystem.stat(sceRoot);
    if (!sceStats.isDirectory()) {
      return {
        scePresent: false,
        metadataValid: false,
        metadataReasonCodes: [PROJECT_CANDIDATE_REASON_CODES.ROOT_INVALID_TYPE]
      };
    }
  } catch (_error) {
    return {
      scePresent: false,
      metadataValid: false,
      metadataReasonCodes: [PROJECT_CANDIDATE_REASON_CODES.ROOT_INACCESSIBLE]
    };
  }

  const versionPath = path.join(sceRoot, 'version.json');
  if (!await fileSystem.pathExists(versionPath)) {
    return {
      scePresent: true,
      metadataValid: true,
      metadataReasonCodes: [PROJECT_CANDIDATE_REASON_CODES.SCE_PRESENT]
    };
  }

  try {
    await fileSystem.readJson(versionPath);
    return {
      scePresent: true,
      metadataValid: true,
      metadataReasonCodes: [PROJECT_CANDIDATE_REASON_CODES.SCE_PRESENT]
    };
  } catch (_error) {
    return {
      scePresent: true,
      metadataValid: false,
      metadataReasonCodes: [
        PROJECT_CANDIDATE_REASON_CODES.SCE_PRESENT,
        PROJECT_CANDIDATE_REASON_CODES.INVALID_PROJECT_METADATA
      ]
    };
  }
}

function dedupeReasonCodes(reasonCodes = []) {
  return Array.from(new Set(reasonCodes.filter(Boolean)));
}

async function inspectProjectCandidate(options = {}, dependencies = {}) {
  const fileSystem = dependencies.fileSystem || fs;
  const stateManager = dependencies.stateManager || new WorkspaceStateManager(dependencies.workspaceStatePath);
  const requestedRoot = normalizeString(options.root || options.rootDir);
  if (!requestedRoot) {
    throw new Error('--root is required');
  }

  const absoluteRoot = path.resolve(requestedRoot);
  const rootDir = normalizePath(absoluteRoot);
  const inspectedAt = new Date().toISOString();
  const projectName = buildProjectName(rootDir);

  if (!await fileSystem.pathExists(absoluteRoot)) {
    return {
      inspectedAt,
      rootDir,
      kind: 'invalid',
      projectName,
      readiness: 'blocked',
      availability: 'inaccessible',
      localCandidate: false,
      reasonCodes: [PROJECT_CANDIDATE_REASON_CODES.ROOT_INACCESSIBLE]
    };
  }

  let rootStats = null;
  try {
    rootStats = await fileSystem.stat(absoluteRoot);
  } catch (_error) {
    return {
      inspectedAt,
      rootDir,
      kind: 'invalid',
      projectName,
      readiness: 'blocked',
      availability: 'inaccessible',
      localCandidate: false,
      reasonCodes: [PROJECT_CANDIDATE_REASON_CODES.ROOT_INACCESSIBLE]
    };
  }

  if (!rootStats.isDirectory()) {
    return {
      inspectedAt,
      rootDir,
      kind: 'invalid',
      projectName,
      readiness: 'blocked',
      availability: 'degraded',
      localCandidate: false,
      reasonCodes: [PROJECT_CANDIDATE_REASON_CODES.ROOT_INVALID_TYPE]
    };
  }

  const workspace = await resolveExactWorkspaceByRoot(absoluteRoot, stateManager);
  const sceInspection = await inspectSceMetadata(absoluteRoot, fileSystem);
  const metadataBlocked = sceInspection.scePresent && !sceInspection.metadataValid;

  if (workspace) {
    const workspaceBlocked = !sceInspection.scePresent || metadataBlocked;
    return {
      inspectedAt,
      rootDir,
      kind: 'workspace-backed',
      projectId: buildWorkspaceProjectId(workspace.name),
      workspaceId: workspace.name,
      projectName,
      readiness: workspaceBlocked ? 'blocked' : 'ready',
      availability: workspaceBlocked ? 'degraded' : 'accessible',
      localCandidate: false,
      reasonCodes: dedupeReasonCodes([
        PROJECT_CANDIDATE_REASON_CODES.WORKSPACE_REGISTERED,
        PROJECT_CANDIDATE_REASON_CODES.ROOT_ACCESSIBLE,
        ...(!sceInspection.scePresent ? [PROJECT_CANDIDATE_REASON_CODES.ROOT_NOT_INITIALIZED] : []),
        ...sceInspection.metadataReasonCodes
      ])
    };
  }

  if (sceInspection.scePresent) {
    return {
      inspectedAt,
      rootDir,
      kind: 'local-sce-candidate',
      projectId: buildLocalProjectId(rootDir),
      projectName,
      readiness: metadataBlocked ? 'blocked' : 'partial',
      availability: metadataBlocked ? 'degraded' : 'degraded',
      localCandidate: true,
      reasonCodes: dedupeReasonCodes([
        PROJECT_CANDIDATE_REASON_CODES.ROOT_ACCESSIBLE,
        PROJECT_CANDIDATE_REASON_CODES.UNREGISTERED_PROJECT,
        ...sceInspection.metadataReasonCodes
      ])
    };
  }

  return {
    inspectedAt,
    rootDir,
    kind: 'directory-candidate',
    projectName,
    readiness: 'pending',
    availability: 'accessible',
    localCandidate: true,
    reasonCodes: [
      PROJECT_CANDIDATE_REASON_CODES.ROOT_ACCESSIBLE,
      PROJECT_CANDIDATE_REASON_CODES.ROOT_NOT_INITIALIZED
    ]
  };
}

module.exports = {
  PROJECT_CANDIDATE_REASON_CODES,
  inspectProjectCandidate
};
