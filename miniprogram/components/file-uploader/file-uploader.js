// file-uploader.js
Component({
  properties: {
    fileList: { type: Array, value: [] },
    maxCount: { type: Number, value: 5 },
  },
  methods: {
    onTap() {
      this.triggerEvent('choose');
    },
    onRemove(e) {
      this.triggerEvent('remove', { index: e.currentTarget.dataset.index });
    },
  },
});
