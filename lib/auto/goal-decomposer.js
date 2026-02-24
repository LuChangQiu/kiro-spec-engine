const fs = require('fs-extra');
const path = require('path');
const { analyzeGoalSemantics } = require('./semantic-decomposer');

const DEFAULT_SUBSPEC_COUNT = 3;
const MIN_SUBSPEC_COUNT = 2;
const MAX_SUBSPEC_COUNT = 5;

const TRACK_LIBRARY = [
  {
    slug: 'closed-loop-autonomous-execution',
    title: 'Closed-Loop Autonomous Execution',
    objective: 'Build uninterrupted execution loops that continue until completion without manual confirmation waits.',
    triggers: ['closed-loop', 'close-loop', 'close loop', 'autonomous loop', '自动推进', '闭环', '无需确认', '不等待确认'],
    categories: ['closeLoop']
  },
  {
    slug: 'master-sub-spec-decomposition',
    title: 'Master/Sub Spec Decomposition',
    objective: 'Split broad feature goals into coordinated master/sub specs with explicit ownership and dependencies.',
    triggers: ['master', 'sub', 'master/sub', 'multi-spec', '多spec', '多 spec', '主从', '并行spec', 'spec拆分'],
    categories: ['decomposition']
  },
  {
    slug: 'parallel-orchestration-runtime',
    title: 'Parallel Orchestration Runtime',
    objective: 'Coordinate dependency-aware parallel execution across multiple specs through orchestration.',
    triggers: ['orchestrate', 'orchestration', 'parallel', '并行', '编排', '调度'],
    categories: ['orchestration']
  },
  {
    slug: 'quality-gate-and-observability',
    title: 'Quality Gate and Observability',
    objective: 'Wire tests, gate checks, and measurable delivery evidence into the autonomous loop.',
    triggers: ['quality', 'gate', 'test', 'observability', 'kpi', '质量', '测试', '观测', '验收'],
    categories: ['quality']
  },
  {
    slug: 'documentation-and-rollout',
    title: 'Documentation and Rollout',
    objective: 'Ship operator-ready docs and rollout guidance so the workflow can be repeated safely.',
    triggers: ['documentation', 'docs', 'rollout', 'guide', '文档', '发布', '推广'],
    categories: ['docs']
  }
];

async function decomposeGoalToSpecPortfolio(goal, options = {}) {
  const normalizedGoal = `${goal || ''}`.trim();
  if (!normalizedGoal) {
    throw new Error('Goal is required');
  }

  const projectPath = options.projectPath || process.cwd();
  const prefix = await resolvePrefix(projectPath, options.prefix);
  const semantic = analyzeGoalSemantics(normalizedGoal);
  const subSpecCount = resolveSubSpecCount(normalizedGoal, options.subSpecCount, semantic);

  const selectedTracks = selectTracks(normalizedGoal, subSpecCount, semantic);
  const masterSlug = buildMasterSlug(normalizedGoal, selectedTracks);
  const prefixToken = formatPrefix(prefix);

  const masterSpec = {
    name: `${prefixToken}-00-${masterSlug}`,
    title: toTitle(masterSlug),
    objective: `Deliver the goal "${normalizedGoal}" through autonomous close-loop execution.`,
    slug: masterSlug
  };

  const subSpecs = selectedTracks.map((track, index) => {
    const subName = `${prefixToken}-${String(index + 1).padStart(2, '0')}-${track.slug}`;
    return {
      name: subName,
      title: track.title,
      slug: track.slug,
      objective: track.objective,
      dependencies: []
    };
  });

  wireDependencies(subSpecs);

  return {
    goal: normalizedGoal,
    prefix,
    masterSpec,
    subSpecs,
    strategy: {
      subSpecCount,
      matchedTracks: selectedTracks.map(track => track.slug),
      categoryScores: semantic.categoryScores,
      clauses: semantic.clauses
    }
  };
}

function resolveSubSpecCount(goal, requestedCount, semantic = null) {
  if (requestedCount !== undefined && requestedCount !== null) {
    const parsed = Number(requestedCount);
    if (!Number.isInteger(parsed) || parsed < MIN_SUBSPEC_COUNT || parsed > MAX_SUBSPEC_COUNT) {
      throw new Error(`--subs must be an integer between ${MIN_SUBSPEC_COUNT} and ${MAX_SUBSPEC_COUNT}`);
    }
    return parsed;
  }

  const tokenCount = estimateTokenCount(goal);
  const separatorHits = (goal.match(/[,:;，、；。]/g) || []).length;
  const clauseCount = semantic && Array.isArray(semantic.clauses) ? semantic.clauses.length : 1;
  const activeCategories = semantic
    ? Object.values(semantic.categoryScores || {}).filter(score => score > 0).length
    : 0;
  const needsMaxTracks = tokenCount >= 24
    || separatorHits >= 4
    || goal.length >= 160
    || clauseCount >= 5
    || activeCategories >= 4;
  if (needsMaxTracks) {
    return 5;
  }

  const needsMoreTracks = tokenCount >= 14
    || separatorHits >= 2
    || goal.length >= 90
    || clauseCount >= 3
    || activeCategories >= 3;

  return needsMoreTracks ? 4 : DEFAULT_SUBSPEC_COUNT;
}

function selectTracks(goal, subSpecCount, semantic = null) {
  const lowerGoal = goal.toLowerCase();
  const scored = TRACK_LIBRARY.map((track, index) => {
    let score = 0;

    for (const trigger of track.triggers) {
      if (lowerGoal.includes(trigger.toLowerCase())) {
        score += 3;
      }
    }

    if (semantic && semantic.categoryScores) {
      for (const category of track.categories || []) {
        score += semantic.categoryScores[category] || 0;
      }
    }

    // deterministic fallback preference (earlier tracks win when scores tie)
    score += (TRACK_LIBRARY.length - index) * 0.001;

    return { track, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, subSpecCount)
    .map(item => item.track);
}

function buildMasterSlug(goal, tracks) {
  const lowerGoal = goal.toLowerCase();
  if (
    (lowerGoal.includes('闭环') || lowerGoal.includes('closed-loop') || lowerGoal.includes('close loop')) &&
    (lowerGoal.includes('主从') || lowerGoal.includes('master') || lowerGoal.includes('multi-spec') || lowerGoal.includes('多 spec'))
  ) {
    return 'autonomous-close-loop-master-sub-program';
  }

  const goalSlug = slugify(goal, '');
  if (goalSlug) {
    return trimSlug(goalSlug, 52);
  }

  const fromTracks = tracks.map(track => track.slug).join('-');
  return trimSlug(fromTracks || 'autonomous-program', 52);
}

function wireDependencies(subSpecs) {
  if (subSpecs.length <= 2) {
    return;
  }

  for (let index = 0; index < subSpecs.length; index += 1) {
    if (index === 2) {
      subSpecs[index].dependencies = [
        { spec: subSpecs[0].name, type: 'requires-completion' },
        { spec: subSpecs[1].name, type: 'requires-completion' }
      ];
      continue;
    }

    if (index > 2) {
      subSpecs[index].dependencies = [
        { spec: subSpecs[index - 1].name, type: 'requires-completion' }
      ];
    }
  }
}

async function resolvePrefix(projectPath, requestedPrefix) {
  if (requestedPrefix !== undefined && requestedPrefix !== null) {
    const parsed = Number(requestedPrefix);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('--prefix must be a positive integer');
    }
    return parsed;
  }

  const specsDir = path.join(projectPath, '.sce', 'specs');
  if (!await fs.pathExists(specsDir)) {
    return 1;
  }

  const entries = await fs.readdir(specsDir);
  let maxPrefix = 0;

  for (const entry of entries) {
    const match = entry.match(/^(\d+)-\d{2}-/);
    if (!match) {
      continue;
    }

    const parsed = Number(match[1]);
    if (Number.isInteger(parsed) && parsed > maxPrefix) {
      maxPrefix = parsed;
    }
  }

  return maxPrefix + 1;
}

function formatPrefix(prefix) {
  if (prefix < 10) {
    return `0${prefix}`;
  }
  return `${prefix}`;
}

function estimateTokenCount(goal) {
  const latinTokens = goal.trim().split(/\s+/).filter(Boolean).length;
  const cjkChars = (goal.match(/[\u4e00-\u9fff]/g) || []).length;

  if (latinTokens <= 1 && cjkChars > 0) {
    return Math.max(1, Math.ceil(cjkChars / 4));
  }

  return latinTokens;
}

function slugify(value, fallback = 'spec') {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function trimSlug(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength).replace(/-+$/g, '');
}

function toTitle(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map(item => item.charAt(0).toUpperCase() + item.slice(1))
    .join(' ');
}

module.exports = {
  decomposeGoalToSpecPortfolio,
  resolveSubSpecCount,
  selectTracks,
  resolvePrefix,
  formatPrefix
};
