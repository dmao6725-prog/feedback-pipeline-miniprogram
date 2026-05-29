// topic-chart.js
Component({
  properties: {
    title: { type: String, value: '议题分布' },
    subtitle: { type: String, value: '' },
    topics: { type: Array, value: [] },
  },

  observers: {
    topics(topics) {
      if (topics && topics.length > 0) {
        const maxCount = Math.max(...topics.map((t) => t.count || 0));
        this.setData({ maxCount: maxCount || 1 });
      }
    },
  },

  data: {
    maxCount: 1,
  },

  methods: {
    barColor(negativeRate) {
      if (negativeRate === null || negativeRate === undefined) return '#2563eb';
      if (negativeRate >= 0.5) return '#ef4444';
      if (negativeRate >= 0.25) return '#f59e0b';
      return '#2563eb';
    },
  },
});
