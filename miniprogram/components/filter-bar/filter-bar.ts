// filter-bar.ts
Component({
  properties: {
    filters: {
      type: Array,
      value: [],
    },
    meaningfulOnly: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    onFilterChange(e: any) {
      const key = e.currentTarget.dataset.key;
      const idx = e.detail.value;
      const filter = (this.data.filters as any[]).find((f: any) => f.key === key);
      if (!filter) return;
      const value = filter.options[idx];
      this.triggerEvent('filterchange', { key, value });
    },
    onToggle() {
      this.triggerEvent('toggled', { value: !this.data.meaningfulOnly });
    },
  },
});
