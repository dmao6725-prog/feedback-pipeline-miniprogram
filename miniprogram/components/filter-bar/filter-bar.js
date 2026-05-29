// filter-bar.js
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
    onFilterChange(e) {
      const key = e.currentTarget.dataset.key;
      const idx = e.detail.value;
      const filter = this.data.filters.find((f) => f.key === key);
      if (!filter) return;
      const value = filter.options[idx];
      this.triggerEvent('filterchange', { key, value });
    },
    onToggle() {
      this.triggerEvent('toggled', { value: !this.data.meaningfulOnly });
    },
  },
});
