// run.js - 分析页：文件选择、参数配置、启动分析、进度跟踪
// 从 Swift HomeView.swift 迁移

const { submitAnalysis, pollTaskResult } = require('../../utils/api');
const {
  addLocalHistoryItem,
  getLastRunParams,
  saveLastRunParams,
  getSettings,
} = require('../../utils/storage');
const { SUPPORTED_EXTENSIONS } = require('../../utils/models');

const MAX_FILE_COUNT = 5;

Page({
  data: {
    files: [],
    model: 'deepseek-v4-flash',
    contextText: '',
    noLLM: false,
    isRunning: false,
    progress: 0,
    statusMessage: '',
    errorMessage: '',
    lastTaskId: '',
    hasValidFiles: false,
    canRun: false,
  },

  onLoad() {
    const params = getLastRunParams();
    const settings = getSettings();
    this.setData({
      model: params.model || settings.defaultModel || 'deepseek-v4-flash',
      contextText: params.context || '',
      noLLM: params.noLLM !== undefined ? params.noLLM : settings.defaultNoLLM,
    });
    this.refreshState();
  },

  refreshState() {
    const { files, isRunning } = this.data;
    const validCount = files.filter((f) => f.status === 'ok').length;
    this.setData({
      hasValidFiles: validCount > 0,
      canRun: !isRunning && validCount > 0,
    });
  },

  // ---- 文件选择 ----
  chooseFile() {
    if (this.data.isRunning) return;

    const validCount = this.data.files.filter((f) => f.status === 'ok').length;
    if (validCount >= MAX_FILE_COUNT) {
      wx.showToast({ title: `最多选择 ${MAX_FILE_COUNT} 个文件`, icon: 'none' });
      return;
    }

    wx.chooseMessageFile({
      count: MAX_FILE_COUNT - validCount,
      type: 'file',
      success: (res) => {
        const newFiles = [];
        for (const f of res.tempFiles) {
          const ext = (f.name.split('.').pop() || '').toLowerCase();
          const supported = SUPPORTED_EXTENSIONS.includes(ext);
          const sizeText = f.size < 1024
            ? `${f.size} B`
            : f.size < 1024 * 1024
              ? `${(f.size / 1024).toFixed(1)} KB`
              : `${(f.size / (1024 * 1024)).toFixed(1)} MB`;
          newFiles.push({
            id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: f.name,
            path: f.path,
            ext,
            size: f.size,
            sizeText,
            status: supported ? 'ok' : 'error',
            error: supported ? undefined : `暂不支持 .${ext} 文件`,
          });
        }
        const ok = newFiles.filter((f) => f.status === 'ok').length;
        const bad = newFiles.length - ok;
        if (ok > 0) wx.showToast({ title: `已添加 ${ok} 个文件`, icon: 'success' });
        if (bad > 0) wx.showToast({ title: `${bad} 个文件格式暂不支持`, icon: 'none' });

        this.setData({ files: this.data.files.concat(newFiles) });
        this.refreshState();
      },
    });
  },

  removeFile(e) {
    const idx = e.currentTarget.dataset.index;
    const files = this.data.files.slice();
    files.splice(idx, 1);
    this.setData({ files });
    this.refreshState();
  },

  // ---- 参数变更 ----
  selectModel(e) {
    this.setData({ model: e.currentTarget.dataset.model });
  },

  onContextInput(e) {
    this.setData({ contextText: e.detail.value });
  },

  toggleNoLLM() {
    this.setData({ noLLM: !this.data.noLLM });
  },

  dismissError() {
    this.setData({ errorMessage: '' });
  },

  // ---- 运行分析 ----
  async runAnalysis() {
    const { files, model, contextText, noLLM } = this.data;
    const okFiles = files.filter((f) => f.status === 'ok');
    if (!okFiles.length) {
      wx.showToast({ title: '请先选择文件', icon: 'none' });
      return;
    }

    saveLastRunParams({ model, context: contextText, noLLM });

    this.setData({
      isRunning: true,
      progress: 0,
      statusMessage: '准备上传文件...',
      errorMessage: '',
    });
    this.refreshState();

    try {
      const cloudPath = `uploads/${Date.now()}_${okFiles[0].name}`;
      this.setData({ statusMessage: `上传中: ${okFiles[0].name}` });

      const uploadRes = await new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath,
          filePath: okFiles[0].path,
          success: resolve,
          fail: reject,
        });
      });
      const fileID = uploadRes.fileID;

      this.setData({ progress: 10, statusMessage: '任务已提交，等待云函数处理...' });
      const { taskId } = await submitAnalysis({
        fileID,
        model,
        analysisContext: contextText,
        noLLM,
      });

      this.setData({ lastTaskId: taskId });

      await pollTaskResult(
        taskId,
        (status) => {
          const progress = status.progress || {};
          const done = progress.label_done || 0;
          const total = progress.label_total || 100;
          const pct = Math.min(95, 15 + Math.round((done / Math.max(total, 1)) * 80));
          const msg = progress.last_message || status.status || '处理中...';
          this.setData({
            progress: pct,
            statusMessage: msg,
          });
        },
        3000,
        300
      );

      this.setData({ progress: 100, statusMessage: '处理完成', isRunning: false });

      addLocalHistoryItem({
        taskId,
        status: 'completed',
        createdAt: new Date().toISOString(),
        resultSummary: {
          total: null,
          llm_enabled: !noLLM,
          negative_rate: null,
          high_severity_rate: null,
        },
      });

      wx.navigateTo({ url: `/pages/result/result?taskId=${taskId}` });
    } catch (err) {
      const msg = err && err.message ? err.message : '分析失败，请检查网络或参数后重试';
      addLocalHistoryItem({
        taskId: `failed_${Date.now()}`,
        status: 'failed',
        createdAt: new Date().toISOString(),
        error: msg,
      });
      this.setData({
        isRunning: false,
        errorMessage: msg,
        statusMessage: '',
      });
      this.refreshState();
    }
  },
});
