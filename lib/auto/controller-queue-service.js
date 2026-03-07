function resolveControllerQueueFile(pathModule, projectPath, queueFileCandidate) {
  const normalized = typeof queueFileCandidate === 'string' && queueFileCandidate.trim()
    ? queueFileCandidate.trim()
    : '.sce/auto/close-loop-controller-goals.lines';
  return pathModule.isAbsolute(normalized)
    ? normalized
    : pathModule.join(projectPath, normalized);
}

function resolveControllerQueueFormat(normalizeBatchFormat, resolvedQueueFile, formatCandidate) {
  const normalized = normalizeBatchFormat(formatCandidate);
  if (normalized !== 'auto') {
    return normalized;
  }
  return `${resolvedQueueFile}`.toLowerCase().endsWith('.json')
    ? 'json'
    : 'lines';
}

function dedupeControllerGoals(goals) {
  const uniqueGoals = [];
  const seen = new Set();
  let duplicateCount = 0;
  for (const item of Array.isArray(goals) ? goals : []) {
    const normalized = `${item || ''}`.trim();
    if (!normalized) {
      continue;
    }
    const fingerprint = normalized.toLowerCase();
    if (seen.has(fingerprint)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(fingerprint);
    uniqueGoals.push(normalized);
  }
  return {
    goals: uniqueGoals,
    duplicate_count: duplicateCount
  };
}

async function loadControllerGoalQueue(pathModule, fs, parseGoalsFromJsonPayload, parseGoalsFromLines, projectPath, queueFileCandidate, formatCandidate, options = {}) {
  const file = resolveControllerQueueFile(pathModule, projectPath, queueFileCandidate);
  const format = resolveControllerQueueFormat(options.normalizeBatchFormat || ((value) => value || 'auto'), file, formatCandidate);
  const dedupe = options.dedupe === true;
  if (!(await fs.pathExists(file))) {
    await fs.ensureDir(pathModule.dirname(file));
    if (format === 'json') {
      await fs.writeJson(file, { goals: [] }, { spaces: 2 });
    } else {
      await fs.writeFile(file, '', 'utf8');
    }
  }

  let goals = [];
  if (format === 'json') {
    let payload = null;
    try {
      payload = await fs.readJson(file);
    } catch (error) {
      throw new Error(`Invalid controller queue JSON: ${file} (${error.message})`);
    }
    goals = parseGoalsFromJsonPayload(payload || {});
  } else {
    const content = await fs.readFile(file, 'utf8');
    goals = parseGoalsFromLines(content);
  }

  const normalizedGoals = goals.map((item) => `${item || ''}`.trim()).filter(Boolean);
  const dedupeResult = dedupe
    ? dedupeControllerGoals(normalizedGoals)
    : { goals: normalizedGoals, duplicate_count: 0 };

  return {
    file,
    format,
    goals: dedupeResult.goals,
    duplicate_count: dedupeResult.duplicate_count,
    dedupe_applied: dedupe
  };
}

async function writeControllerGoalQueue(pathModule, fs, file, format, goals) {
  const normalizedGoals = Array.isArray(goals)
    ? goals.map((item) => `${item || ''}`.trim()).filter(Boolean)
    : [];
  await fs.ensureDir(pathModule.dirname(file));
  if (format === 'json') {
    await fs.writeJson(file, { goals: normalizedGoals }, { spaces: 2 });
    return;
  }
  const content = normalizedGoals.length > 0
    ? `${normalizedGoals.join('\n')}\n`
    : '';
  await fs.writeFile(file, content, 'utf8');
}

async function appendControllerGoalArchive(pathModule, fs, fileCandidate, projectPath, goal, metadata = {}) {
  if (!fileCandidate) {
    return null;
  }
  const resolvedFile = pathModule.isAbsolute(fileCandidate)
    ? fileCandidate
    : pathModule.join(projectPath, fileCandidate);
  await fs.ensureDir(pathModule.dirname(resolvedFile));
  const timestamp = new Date().toISOString();
  const normalizedGoal = `${goal || ''}`.replace(/\r?\n/g, ' ').trim();
  const fields = [
    timestamp,
    `${metadata.status || ''}`.trim() || 'unknown',
    `${metadata.program_status || ''}`.trim() || 'unknown',
    `${metadata.gate_passed === true ? 'gate-pass' : 'gate-fail'}`,
    normalizedGoal
  ];
  await fs.appendFile(resolvedFile, `${fields.join('\t')}\n`, 'utf8');
  return resolvedFile;
}

module.exports = {
  resolveControllerQueueFile,
  resolveControllerQueueFormat,
  dedupeControllerGoals,
  loadControllerGoalQueue,
  writeControllerGoalQueue,
  appendControllerGoalArchive
};
