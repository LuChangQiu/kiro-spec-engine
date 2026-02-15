const CATEGORY_KEYWORDS = {
  closeLoop: [
    'closed-loop', 'close-loop', 'close loop', 'autonomous loop',
    'auto progress', 'auto-progress', 'automatic progression',
    '闭环', '自动推进', '无需确认', '不等待确认', '自动闭环'
  ],
  decomposition: [
    'master/sub', 'master sub', 'master', 'sub-spec', 'sub spec',
    'multi-spec', 'multi spec', 'split', 'decompose', 'decomposition',
    '主从', '多spec', '多 spec', '拆分', '分解'
  ],
  orchestration: [
    'orchestrate', 'orchestration', 'parallel', 'dag', 'scheduler',
    '编排', '并行', '调度'
  ],
  quality: [
    'quality', 'gate', 'test', 'stability', 'reliability', 'observability',
    'kpi', 'metrics', '验证', '测试', '质量', '观测', '验收'
  ],
  docs: [
    'docs', 'documentation', 'guide', 'rollout', 'publish',
    '文档', '指南', '发布', '落地'
  ]
};

const CONNECTORS = [
  ' and ', ' with ', ' then ', ' plus ', ' while ',
  ' 并且 ', ' 同时 ', ' 然后 ', ' 以及 ', ' 并 ',
  '并且', '同时', '然后', '以及'
];

function analyzeGoalSemantics(goal) {
  const normalizedGoal = normalizeGoal(goal);
  const clauses = splitIntoClauses(normalizedGoal);
  const categoryScores = scoreCategories(normalizedGoal, clauses);

  const rankedCategories = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return {
    normalizedGoal,
    clauses,
    categoryScores,
    rankedCategories
  };
}

function normalizeGoal(goal) {
  return `${goal || ''}`
    .trim()
    .replace(/\s+/g, ' ');
}

function splitIntoClauses(goal) {
  if (!goal) {
    return [];
  }

  const replaced = goal
    .replace(/[;；。，、]/g, ',')
    .replace(/[:：]/g, ' ')
    .replace(/\s+/g, ' ');

  const roughParts = replaced.split(',').map(item => item.trim()).filter(Boolean);
  const clauses = [];

  for (const part of roughParts) {
    let splits = [part];
    for (const connector of CONNECTORS) {
      splits = splits
        .flatMap(text => splitByConnector(text, connector))
        .map(text => text.trim())
        .filter(Boolean);
    }
    clauses.push(...splits);
  }

  return clauses.length > 0 ? clauses : [goal];
}

function splitByConnector(text, connector) {
  const normalizedText = ` ${text} `;
  if (!normalizedText.toLowerCase().includes(connector.toLowerCase())) {
    return [text];
  }

  return text
    .split(new RegExp(escapeRegex(connector.trim()), 'i'))
    .map(item => item.trim())
    .filter(Boolean);
}

function scoreCategories(goal, clauses) {
  const text = goal.toLowerCase();
  const scoreMap = {
    closeLoop: 0,
    decomposition: 0,
    orchestration: 0,
    quality: 0,
    docs: 0
  };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (text.includes(lowerKeyword)) {
        scoreMap[category] += 2;
      }
    }
  }

  for (const clause of clauses) {
    const lowerClause = clause.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase();
        if (lowerClause.includes(lowerKeyword)) {
          scoreMap[category] += 1;
        }
      }
    }
  }

  return scoreMap;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  analyzeGoalSemantics,
  normalizeGoal,
  splitIntoClauses,
  scoreCategories
};
