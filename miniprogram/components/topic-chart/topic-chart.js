// topic-chart.js

function topicBarColor(negativeRate) {
  const n = Number(negativeRate);
  if (!Number.isFinite(n)) return '#2563eb';
  if (n >= 0.5) return '#ef4444';
  if (n >= 0.25) return '#f59e0b';
  return '#2563eb';
}

function formatShare(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : '0%';
}

function normalizeTopics(topics) {
  const list = (topics || []).slice(0, 10);
  const maxCount = Math.max(1, ...list.map((t) => Number(t.count || 0)));
  return list.map((item) => ({
    topic: item.topic,
    countText: String(item.count || 0),
    shareText: formatShare(item.share),
    widthText: `${Math.round((Number(item.count || 0) / maxCount) * 100)}%`,
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
