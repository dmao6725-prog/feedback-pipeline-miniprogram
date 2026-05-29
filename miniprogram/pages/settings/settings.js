// settings.js - 设置页
// 从 Swift SettingsView.swift 迁移

const { getSettings, saveSettings } = require('../../utils/storage');

function getCloudConfigView() {
  const app = typeof getApp === 'function' ? getApp() : null;
  const globalData = app && app.globalData ? app.globalData : {};
  const envId = globalData.cloudEnvId || 'your-env-id';
  const configured = !!envId && envId !== 'your-env-id';
  return {
    cloudEnvText: configured ? envId : 'your-env-id',
    cloudStatusText: configured ? '已配置' : '未配置',
    cloudStatusClass: configured ? 'chip-pos' : 'chip-warn',
  };
}

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
    showAPIGuide: false,
    apiGuideToggleText: '展开',
    cloudEnvText: 'your-env-id',
    cloudStatusText: '未配置',
    cloudStatusClass: 'chip-warn',
  },

  onLoad() {
    const s = getSettings();
    this.setData({
      defaultModel: s.defaultModel || 'deepseek-v4-flash',
      defaultNoLLM: s.defaultNoLLM || false,
      maxLabelRecords: s.maxLabelRecords || 200,
      labelConcurrency: s.labelConcurrency || 5,
      ...getCloudConfigView(),
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

  // ---- API Key 指南 ----
  toggleAPIGuide() {
    const showAPIGuide = !this.data.showAPIGuide;
    this.setData({
      showAPIGuide,
      apiGuideToggleText: showAPIGuide ? '收起' : '展开',
    });
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
