// settings.js - 设置页
// 从 Swift SettingsView.swift 迁移

const { getSettings, saveSettings } = require('../../utils/storage');

Page({
  data: {
    defaultModel: 'deepseek-v4-flash',
    defaultNoLLM: false,
    maxLabelRecords: 200,
    labelConcurrency: 5,
    showAPIGuide: false,
  },

  onLoad() {
    const s = getSettings();
    this.setData({
      defaultModel: s.defaultModel || 'deepseek-v4-flash',
      defaultNoLLM: s.defaultNoLLM || false,
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
    const v = parseInt(e.detail.value, 10);
    const clamped = isNaN(v) ? 200 : Math.max(10, Math.min(500, v));
    this.setData({ maxLabelRecords: clamped });
  },

  // ---- 并发数 ----
  onConcurrencyInput(e) {
    const v = parseInt(e.detail.value, 10);
    const clamped = isNaN(v) ? 5 : Math.max(1, Math.min(10, v));
    this.setData({ labelConcurrency: clamped });
  },

  // ---- API Key 指南 ----
  toggleAPIGuide() {
    this.setData({ showAPIGuide: !this.data.showAPIGuide });
  },

  // ---- 关于 ----
  showAbout() {
    wx.showModal({
      title: '反馈分析',
      content: 'v1.0.0\n\n从 iOS FeedbackPipeline (SwiftUI) 迁移\n为微信小程序重新设计\n\nDeepSeek API Key 存储在云函数环境变量中\n不暴露给前端',
      showCancel: false,
    });
  },
});
