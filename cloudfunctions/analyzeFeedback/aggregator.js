// ============================================================
// aggregator.js — 无 LLM 的纯统计聚合（轻量模式）
// ============================================================

/**
 * 在 noLLM 模式或快速预览模式下，基于启发式数据生成统计
 */
function aggregateHeuristic(records) {
  const total = records.length;

  const platformCounts = countBy(records.map((r) => r.platform));
  const topicCounts = countBy(records.map((r) => r.keywordTopic));
  const sentimentCounts = countBy(records.map((r) => r.sentiment || '未标注'));

  const topics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({
      topic: topic || '其他',
      count,
      share: count / Math.max(total, 1),
      negative_rate: null,
      high_severity_rate: null,
    }));

  return {
    total,
    platforms: Object.entries(platformCounts).map(([k, v]) => ({ code: k, label: k, count: v })),
    topics: topics.map((t) => t.topic),
    topicRows: topics,
    sentimentCounts,
    summary: `共 ${total} 条反馈，主要议题：${topics.slice(0, 3).map((t) => t.topic).join('、')}。`,
  };
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

module.exports = { aggregateHeuristic };
