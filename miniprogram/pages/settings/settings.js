// settings.js - 设置页
// 从 Swift SettingsView.swift 迁移

const { getSettings, saveSettings } = require('../../utils/storage');

function clampNumber(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

Page({
  data: {
    defaultModel: 'deepseek-v4-flash',
    defaultNoLLM: false,
    maxLabelRecords: 200,
    labelConcurrency: 5,
  },

  onLoad() {
    const s = getSettings();
    this.setData({
      defaultModel: s.defaultModel || 'deepseek-v4-flash',
      defaultNoLLM: s.defaultNoLLM || false,
      maxLabelRecords: s.maxLabelRecords || 200,
      labelConcurrency: s.labelConcurrency || 5,
    });
  },

  // ---- 模型 ----
  selectModel(e) {
    const m = e.currentTarget.dataset.model;
    this.setData({ defaultModel: m });
    const s = getSettings();
    s.defaultModel = m;
    saveSettings(s);
  },

  // ---- 默认仅清洗 ----
  toggleNoLLM() {
    const v = !this.data.defaultNoLLM;
    this.setData({ defaultNoLLM: v });
    const s = getSettings();
    s.defaultNoLLM = v;
    saveSettings(s);
  },

  // ---- 标注上限 ----
  onMaxLabelInput(e) {
    const clamped = clampNumber(e.detail.value, 200, 10, 500);
    this.setData({ maxLabelRecords: clamped });
    const s = getSettings();
    s.maxLabelRecords = clamped;
    saveSettings(s);
  },

  // ---- 并发数 ----
  onConcurrencyInput(e) {
    const clamped = clampNumber(e.detail.value, 5, 1, 10);
    this.setData({ labelConcurrency: clamped });
    const s = getSettings();
    s.labelConcurrency = clamped;
    saveSettings(s);
  },

  // ---- 关于 ----
  showAbout() {
    wx.showModal({
      title: '反馈分析',
      content: 'v1.0.0\n\n上传反馈文件，自动清洗、标注并生成分析看板。AI 分析由后端安全处理。',
      showCancel: false,
    });
  },
});
