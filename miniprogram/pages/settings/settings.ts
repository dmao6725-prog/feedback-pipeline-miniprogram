// ============================================================
// settings.ts — 设置页
// 从 Swift SettingsView.swift 迁移
// ============================================================

import { getSettings, saveSettings, saveLastRunParams } from '../../utils/storage';

const APP = getApp<IAppOption>();

Page({
  data: {
    defaultModel: 'deepseek-v4-flash',
    defaultNoLLM: false,
    maxLabelRecords: 200,
    labelConcurrency: 5,
    cloudEnvId: '',
    showAPIGuide: false,
  },

  onLoad() {
    const s = getSettings();
    const envId = wx.cloud ? '已初始化' : '未配置';
    this.setData({
      defaultModel: s.defaultModel,
      defaultNoLLM: s.defaultNoLLM,
      cloudEnvId: envId,
    });
  },

  // ---- 模型选择 ----
  selectModel(e: any) {
    const m = e.currentTarget.dataset.model;
    this.setData({ defaultModel: m });
    const s = getSettings();
    s.defaultModel = m;
    saveSettings(s);
  },

  // ---- 默认 LLM 开关 ----
  toggleNoLLM() {
    const v = !this.data.defaultNoLLM;
    this.setData({ defaultNoLLM: v });
    const s = getSettings();
    s.defaultNoLLM = v;
    saveSettings(s);
  },

  // ---- 标注上限 ----
  onMaxLabelInput(e: any) {
    const v = parseInt(e.detail.value, 10);
    this.setData({ maxLabelRecords: isNaN(v) ? 200 : Math.max(10, Math.min(500, v)) });
  },

  // ---- 并发数 ----
  onConcurrencyInput(e: any) {
    const v = parseInt(e.detail.value, 10);
    this.setData({ labelConcurrency: isNaN(v) ? 5 : Math.max(1, Math.min(10, v)) });
  },

  // ---- API Key 说明 ----
  toggleAPIGuide() {
    this.setData({ showAPIGuide: !this.data.showAPIGuide });
  },

  // ---- 关于 ----
  showAbout() {
    wx.showModal({
      title: '关于反馈分析',
      content: '反馈分析小程序 v1.0.0\n\n从 iOS SwiftUI 项目 FeedbackPipeline 迁移。\n支持多格式文件解析和 DeepSeek AI 标注。\n\nAPI Key 存储在云函数环境变量中，不会暴露给前端。',
      showCancel: false,
    });
  },
});
