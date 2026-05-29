// topic-chart.js

function topicBarColor(negativeRate) {
  const n = Number(negativeRate);
  if (!Number.isFinite(n)) return '#2563eb';
  if (n >= 0.5) return '#ef4444';
  if (n >= 0.25) return '#f59e0b';
  return '#2563eb';
}

function roundPositive(value) {
  return parseInt(Number(value) + 0.5, 10);
}

function formatShare(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${roundPositive(n * 100)}%` : '0%';
}

function getMaxCount(list) {
  let max = 1;
  for (const item of list || []) {
    const count = Number(item.count || 0);
    if (count > max) max = count;
  }
  return max;
}

function normalizeTopics(topics) {
  const list = (topics || []).slice(0, 10);
  const maxCount = getMaxCount(list);
  return list.map((item) => ({
    topic: item.topic,
    countText: String(item.count || 0),
    shareText: formatShare(item.share),
    widthText: `${roundPositive((Number(item.count || 0) / maxCount) * 100)}%`,
    barColor: topicBarColor(item.negative_rate),
  }));
}

Component({
  properties: {
    title: { type: String, value: '议题分布' },
    subtitle: { type: String, value: '' },
    topics: { type: Array, value: [] },
  },

  observers: {
    topics(topics) {
      this.setData({ topicsView: normalizeTopics(topics) });
    },
  },

  data: {
    topicsView: [],
  },
});
