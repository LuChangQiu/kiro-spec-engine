const fs = require('fs-extra');
const path = require('path');

const LEGACY_DIRNAME = '.kiro';
const TARGET_DIRNAME = '.sce';
const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  TARGET_DIRNAME,
  'dist',
  'build',
  'coverage',
  '.next',
]);

async function findLegacyKiroDirectories(rootDir, options = {}) {
  const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : DEFAULT_MAX_DEPTH;
  const ignoreDirs = options.ignoreDirs instanceof Set
    ? options.ignoreDirs
    : DEFAULT_IGNORE_DIRS;
  const results = [];

  async function walk(currentDir, depth) {
    if (depth > maxDepth) {
      return;
    }
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (_error) {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      if (entry.name === LEGACY_DIRNAME) {
        results.push(fullPath);
        continue;
      }
      if (ignoreDirs.has(entry.name)) {
        continue;
      }
      await walk(fullPath, depth + 1);
    }
  }

  await walk(rootDir, 0);
  results.sort((a, b) => a.length - b.length);
  return results;
}

async function migrateLegacyKiroDirectories(rootDir, options = {}) {
  const dryRun = options.dryRun === true;
  const legacyDirs = await findLegacyKiroDirectories(rootDir, options);
  const report = {
    root: rootDir,
    dryRun,
    scanned: legacyDirs.length,
    migrated: 0,
    renamed: 0,
    merged: 0,
    moved_files: 0,
    deduped_files: 0,
    conflict_files: 0,
    details: [],
  };

  // Deepest first avoids parent directory interactions in nested projects.
  const ordered = [...legacyDirs].sort((a, b) => b.length - a.length);
  for (const legacyDir of ordered) {
    const detail = await _migrateSingleLegacyDirectory(legacyDir, { dryRun });
    report.details.push(detail);
    if (!detail.success) {
      continue;
    }
    report.migrated += 1;
    report.renamed += detail.action === 'rename' ? 1 : 0;
    report.merged += detail.action === 'merge' ? 1 : 0;
    report.moved_files += detail.moved_files || 0;
    report.deduped_files += detail.deduped_files || 0;
    report.conflict_files += detail.conflict_files || 0;
  }

  return report;
}

async function autoMigrateLegacyKiroDirectories(rootDir, options = {}) {
  const dryRun = options.dryRun === true;
  const report = await migrateLegacyKiroDirectories(rootDir, {
    ...options,
    dryRun,
  });
  return {
    detected: report.scanned,
    migrated: report.migrated,
    report,
  };
}

async function _migrateSingleLegacyDirectory(legacyDir, options) {
  const dryRun = options.dryRun === true;
  const parentDir = path.dirname(legacyDir);
  const targetDir = path.join(parentDir, TARGET_DIRNAME);
  const detail = {
    source: legacyDir,
    target: targetDir,
    success: true,
    action: 'rename',
    moved_files: 0,
    deduped_files: 0,
    conflict_files: 0,
    errors: [],
  };

  try {
    const targetExists = await fs.pathExists(targetDir);
    if (!targetExists) {
      if (!dryRun) {
        await fs.move(legacyDir, targetDir, { overwrite: false });
      }
      return detail;
    }

    detail.action = 'merge';
    const mergeReport = await _mergeLegacyIntoTarget(legacyDir, targetDir, { dryRun });
    detail.moved_files = mergeReport.moved_files;
    detail.deduped_files = mergeReport.deduped_files;
    detail.conflict_files = mergeReport.conflict_files;
    detail.errors.push(...mergeReport.errors);
    detail.success = mergeReport.errors.length === 0;
    return detail;
  } catch (error) {
    detail.success = false;
    detail.errors.push(error.message);
    return detail;
  }
}

async function _mergeLegacyIntoTarget(legacyDir, targetDir, options) {
  const dryRun = options.dryRun === true;
  const report = {
    moved_files: 0,
    deduped_files: 0,
    conflict_files: 0,
    errors: [],
  };
  const files = await _listFilesRecursive(legacyDir);

  for (const sourcePath of files) {
    const relative = path.relative(legacyDir, sourcePath);
    const targetPath = path.join(targetDir, relative);
    try {
      const targetExists = await fs.pathExists(targetPath);
      if (!targetExists) {
        report.moved_files += 1;
        if (!dryRun) {
          await fs.ensureDir(path.dirname(targetPath));
          await fs.move(sourcePath, targetPath, { overwrite: false });
        }
        continue;
      }

      const same = await _isSameFile(sourcePath, targetPath);
      if (same) {
        report.deduped_files += 1;
        if (!dryRun) {
          await fs.remove(sourcePath);
        }
        continue;
      }

      const conflictPath = await _nextConflictPath(targetPath);
      report.conflict_files += 1;
      if (!dryRun) {
        await fs.ensureDir(path.dirname(conflictPath));
        await fs.move(sourcePath, conflictPath, { overwrite: false });
      }
    } catch (error) {
      report.errors.push(`${sourcePath}: ${error.message}`);
    }
  }

  if (!dryRun) {
    await _removeEmptyDirectories(legacyDir);
    if (await fs.pathExists(legacyDir)) {
      const remaining = await fs.readdir(legacyDir);
      if (remaining.length === 0) {
        await fs.remove(legacyDir);
      }
    }
  }

  return report;
}

async function _listFilesRecursive(rootDir) {
  const files = [];

  async function walk(currentDir) {
    let entries = [];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (_error) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

async function _isSameFile(leftPath, rightPath) {
  const [leftBuffer, rightBuffer] = await Promise.all([
    fs.readFile(leftPath),
    fs.readFile(rightPath),
  ]);
  return leftBuffer.equals(rightBuffer);
}

async function _nextConflictPath(targetPath) {
  const { dir, name, ext } = path.parse(targetPath);
  let counter = 1;
  while (true) {
    const candidate = path.join(dir, `${name}.legacy-kiro-${counter}${ext}`);
    if (!await fs.pathExists(candidate)) {
      return candidate;
    }
    counter += 1;
  }
}

async function _removeEmptyDirectories(rootDir) {
  let entries = [];
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true });
  } catch (_error) {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const fullPath = path.join(rootDir, entry.name);
    await _removeEmptyDirectories(fullPath);
    try {
      const childEntries = await fs.readdir(fullPath);
      if (childEntries.length === 0) {
        await fs.rmdir(fullPath);
      }
    } catch (_error) {
      // Ignore delete race/errors.
    }
  }
}

module.exports = {
  LEGACY_DIRNAME,
  TARGET_DIRNAME,
  findLegacyKiroDirectories,
  migrateLegacyKiroDirectories,
  autoMigrateLegacyKiroDirectories,
};

