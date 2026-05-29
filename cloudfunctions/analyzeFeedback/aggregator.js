// aggregator.js — noLLM 纯统计聚合（轻量模式）
// 从 Swift LocalProcessingPipeline.fallbackSummary 迁移并增强

const NEGATIVE_ZH = [
  '垃圾','太差','失望','恶心','坑','骗','投诉','退款','崩','闪退','卡死',
  '太慢','耗电','发热','掉帧','广告太多','收费','骗钱','封号','账号被封',
  '登录不了','打不开','无法使用','不能用','不推荐','千万别','后悔',
];
const NEGATIVE_EN = [
  'trash','garbage','terrible','disappointed','scam','fraud','refund',
  'crash','freeze','broken','useless','worst','sucks','hate','awful',
  'unusable','lag','buggy','never','regret','avoid','waste',
];

/**
 * noLLM 模式完整统计
 */
function aggregateHeuristic(records) {
  const total = records.length;
  if (!total) return emptyResult();

  // 平台分布
  const platformCounts = countBy(records.map((r) => r.platform));

  // 关键词主题分布
  const topicCounts = countBy(records.map((r) => r.keywordTopic || '其他'));

  // 负面关键词命中检测
  let negativeHits = 0;
  for (const r of records) {
    const lower = (r.cleanedText || r.rawText || '').toLowerCase();
    if (NEGATIVE_ZH.some((w) => lower.includes(w)) || NEGATIVE_EN.some((w) => lower.includes(w))) {
      negativeHits++;
    }
  }

  // 高互动样本（top 10 by engagement）
  const highEngagement = [...records]
    .filter((r) => (r.engagement || 0) > 0)
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, 10)
    .map((r) => ({
      summary: r.summaryText || r.cleanedText?.substring(0, 120) || '',
      engagement: r.engagement || 0,
      topic: r.keywordTopic || '其他',
    }));

  // 有日期的记录（用于趋势）
  const dated = records.filter((r) => r.yearMonth && r.yearMonth.length >= 7);

  const topics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({
      topic: topic || '其他',
      count,
      share: count / total,
      negative_rate: null, // noLLM 模式下无情感标注
      high_severity_rate: null,
    }));

  return {
    total,
    negativeHits,
    negativeHitRate: total > 0 ? negativeHits / total : 0,
    platforms: Object.entries(platformCounts).map(([k, v]) => ({
      code: k, label: platformLabel(k), count: v,
    })),
    topics,
    datedCount: dated.length,
    highEngagement,
    summary: buildSummary(total, negativeHits, topics, records),
    note: '当前为 noLLM 模式（仅清洗/启发式统计），情感倾向和严重程度为关键词推测结果，不是 LLM 标注。',
  };
}

function emptyResult() {
  return {
    total: 0,
    negativeHits: 0,
    negativeHitRate: 0,
    platforms: [],
    topics: [],
    datedCount: 0,
    highEngagement: [],
    summary: '没有解析到有效记录。请检查文件是否为空或格式是否正确。',
    note: '',
  };
}

function buildSummary(total, negativeHits, topics, records) {
  const topTopics = topics.slice(0, 5)
    .map((t) => `${t.topic} ${t.count} 条`)
    .join('，');

  let summary = `共解析 ${total} 条反馈。`;
  if (negativeHits > 0) {
    summary += `其中命中负面关键词 ${negativeHits} 条（${(negativeHits / total * 100).toFixed(1)}%）。`;
  }
  if (topTopics) {
    summary += `主要议题：${topTopics}。`;
  }

  // 文件来源
  const files = [...new Set(records.map((r) => r.sourceFile).filter(Boolean))];
  if (files.length) {
    summary += `来源文件：${files.join('、')}。`;
  }

  return summary;
}

function countBy(values) {
  const counts = {};
  for (const v of values) {
    if (v !== null && v !== undefined && v !== '') {
      counts[v] = (counts[v] || 0) + 1;
    }
  }
  return counts;
}

function platformLabel(code) {
  const map = {
    google_play: 'Google Play',
    app_store: 'App Store',
    reddit: 'Reddit',
    local: '本地文件',
  };
  return map[code] || code || '本地文件';
}

module.exports = { aggregateHeuristic };
