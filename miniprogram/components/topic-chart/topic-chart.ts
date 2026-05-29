// topic-chart.ts
Component({
  properties: {
    title: { type: String, value: '议题分布' },
    subtitle: { type: String, value: '' },
    topics: {
      type: Array,
      value: [],
    },
  },

  computed: {
    maxCount(): number {
      const topics = this.data.topics as any[];
      if (!topics || !topics.length) return 1;
      return Math.max(...topics.map((t: any) => t.count));
    },
  },

  methods: {
    barColor(negativeRate: number | null): string {
      if (negativeRate === null || negativeRate === undefined) return '#2563eb';
      if (negativeRate >= 0.5) return '#ef4444';
      if (negativeRate >= 0.25) return '#f59e0b';
      return '#2563eb';
    },
  },
});
