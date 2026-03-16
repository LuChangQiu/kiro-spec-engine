const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { MachineIdentifier } = require('../lock/machine-identifier');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeStringArray(value, fallback = []) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const seen = new Set();
  const items = [];
  for (const entry of value) {
    const normalized = normalizeString(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

function safeHostname() {
  try {
    return os.hostname() || 'unknown-host';
  } catch (_error) {
    return 'unknown-host';
  }
}

function safeUsername() {
  try {
    return os.userInfo().username || process.env.USER || process.env.USERNAME || 'unknown-user';
  } catch (_error) {
    return process.env.USER || process.env.USERNAME || 'unknown-user';
  }
}

function buildEphemeralDeviceId({ hostname, user, platform, arch }) {
  const hash = crypto
    .createHash('sha1')
    .update(`${hostname}::${user}::${platform}::${arch}`)
    .digest('hex')
    .slice(0, 12);
  return `${hostname}-ephemeral-${hash}`;
}

function buildDefaultCapabilityTags({ platform, arch }) {
  const tags = ['desktop'];
  if (platform) {
    tags.push(platform);
  }
  if (arch) {
    tags.push(arch);
  }
  if (platform && arch) {
    tags.push(`${platform}-${arch}`);
  }
  return normalizeStringArray(tags);
}

async function readJsonIfExists(filePath, fileSystem) {
  if (!await fileSystem.pathExists(filePath)) {
    return null;
  }
  return fileSystem.readJson(filePath);
}

async function getCurrentDeviceProfile(projectPath = process.cwd(), options = {}) {
  const fileSystem = options.fileSystem || fs;
  const configDir = options.configDir || path.join(projectPath, '.sce', 'config');
  const machineIdFile = options.machineIdFile || path.join(configDir, 'machine-id.json');
  const profilePath = options.profilePath || path.join(projectPath, '.sce', 'state', 'device', 'device-current.json');
  const persistIfMissing = options.persistIfMissing === true;
  const fallbackPlatform = normalizeString(options.platform) || os.platform();
  const fallbackArch = normalizeString(options.arch) || os.arch();
  const fallbackHostname = normalizeString(options.hostname) || safeHostname();
  const fallbackUser = normalizeString(options.user) || safeUsername();

  let machineInfo = null;
  let identitySource = 'ephemeral-device-fingerprint';

  if (persistIfMissing) {
    const machineIdentifier = options.machineIdentifier || new MachineIdentifier(configDir);
    machineInfo = await machineIdentifier.getMachineInfo();
    identitySource = 'machine-identifier';
  } else {
    const persistedMachineId = await readJsonIfExists(machineIdFile, fileSystem);
    if (persistedMachineId && typeof persistedMachineId === 'object') {
      machineInfo = {
        id: normalizeString(persistedMachineId.id),
        hostname: normalizeString(persistedMachineId.hostname) || fallbackHostname,
        createdAt: normalizeString(persistedMachineId.createdAt) || null,
        platform: fallbackPlatform,
        user: fallbackUser
      };
      if (machineInfo.id) {
        identitySource = 'machine-identifier';
      } else {
        machineInfo = null;
      }
    }
  }

  if (!machineInfo) {
    machineInfo = {
      id: buildEphemeralDeviceId({
        hostname: fallbackHostname,
        user: fallbackUser,
        platform: fallbackPlatform,
        arch: fallbackArch
      }),
      hostname: fallbackHostname,
      createdAt: null,
      platform: fallbackPlatform,
      user: fallbackUser
    };
  }

  const profile = await readJsonIfExists(profilePath, fileSystem);
  const normalizedProfile = profile && typeof profile === 'object' ? profile : {};
  const platform = normalizeString(normalizedProfile.platform) || normalizeString(machineInfo.platform) || fallbackPlatform;
  const arch = normalizeString(normalizedProfile.arch) || fallbackArch;
  const capabilityTags = normalizeStringArray(
    normalizedProfile.capability_tags || normalizedProfile.capabilityTags,
    buildDefaultCapabilityTags({ platform, arch })
  );

  return {
    device_id: normalizeString(normalizedProfile.device_id || normalizedProfile.deviceId || normalizedProfile.id) || machineInfo.id,
    hostname: normalizeString(normalizedProfile.hostname) || normalizeString(machineInfo.hostname) || fallbackHostname,
    label: normalizeString(normalizedProfile.label || normalizedProfile.name) || normalizeString(machineInfo.hostname) || fallbackHostname,
    platform,
    arch,
    user: normalizeString(normalizedProfile.user) || normalizeString(machineInfo.user) || fallbackUser,
    created_at: normalizeString(normalizedProfile.created_at || normalizedProfile.createdAt) || normalizeString(machineInfo.createdAt) || null,
    capability_tags: capabilityTags,
    metadata: normalizedProfile.metadata && typeof normalizedProfile.metadata === 'object' ? normalizedProfile.metadata : {},
    profile_path: profile ? profilePath : null,
    identity_source: profile
      ? `${identitySource}+device-profile`
      : identitySource,
    persistent_id_available: identitySource === 'machine-identifier'
  };
}

module.exports = {
  getCurrentDeviceProfile,
  buildDefaultCapabilityTags
};
