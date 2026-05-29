// file-uploader.ts
import { fileSize } from '../../utils/format';

Component({
  properties: {
    fileList: {
      type: Array,
      value: [],
    },
    maxCount: {
      type: Number,
      value: 5,
    },
  },

  methods: {
    onTap() {
      this.triggerEvent('choose');
    },
    onRemove(e: any) {
      this.triggerEvent('remove', { index: e.currentTarget.dataset.index });
    },
  },
});
