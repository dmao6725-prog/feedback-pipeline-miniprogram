// run.js - 分析页：文件选择、参数配置、启动分析、进度跟踪
// 从 Swift HomeView.swift 迁移

const { submitAnalysis, pollTaskResult, uploadFile } = require('../../utils/api');
const {
  addLocalHistoryItem,
  getLastRunParams,
  saveLastRunParams,
  getSettings,
} = require('../../utils/storage');
const { SUPPORTED_EXTENSIONS } = require('../../utils/models');

const MAX_FILE_COUNT = 5;

function getCloudUnavailableMessage() {
  if (!wx.cloud) {
    return '云开发不可用，请在微信开发者工具中启用云开发。';
  }

  const app = typeof getApp === 'function' ? getApp() : null;
  const globalData = app && app.globalData ? app.globalData : {};
  if (!globalData.cloudReady) {
    return '请先在 miniprogram/app.js 中配置真实云环境 ID，并确认云函数已部署。';
  }

  return '';
}

function showAnalysisError(message) {
  wx.showModal({
    title: '分析失败',
    content: message,
    showCancel: false,
  });
}

function normalizeFile(file) {
  const status = file.status || 'ok';
  return Object.assign({}, file, {
    statusClass: status,
    statusIcon: status === 'ok' ? 'F' : '!',
    typeText: file.ext ? `.${file.ext.toUpperCase()}` : '未知类型',
    metaText: status === 'ok' ? `${file.sizeText || ''} · ${file.ext ? file.ext.toUpperCase() : 'FILE'}` : '',
  });
}

function formatFileCount(files) {
  const count = files.length;
  if (count === 0) return '0 个';
  return `${count} 个`;
}

function fixedNumber(value, digits) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (!digits) return String(parseInt(n + 0.5, 10));
  const scale = 10 ** digits;
  const rounded = parseInt((n * scale) + 0.5, 10);
  const whole = parseInt(rounded / scale, 10);
  const fraction = String(rounded % scale).padStart(digits, '0');
  return `${whole}.${fraction}`;
}

function percentFromProgress(done, total) {
  const ratio = done / (total > 0 ? total : 1);
  const pct = 15 + parseInt((ratio * 80) + 0.5, 10);
  return pct > 95 ? 95 : pct;
}

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
    fileCountText: '0 个',
    runButtonText: '请先选择文件',
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
    const { files, isRunning, noLLM } = this.data;
    const validCount = files.filter((f) => f.status === 'ok').length;
    this.setData({
      hasValidFiles: validCount > 0,
      canRun: !isRunning && validCount > 0,
      fileCountText: formatFileCount(files),
      runButtonText: isRunning
        ? '分析中...'
        : validCount > 0
          ? (noLLM ? '开始清洗分析' : '开始 AI 分析')
          : '请先选择文件',
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
        for (let i = 0; i < res.tempFiles.length; i++) {
          const f = res.tempFiles[i];
          const ext = (f.name.split('.').pop() || '').toLowerCase();
          const supported = SUPPORTED_EXTENSIONS.includes(ext);
          const sizeText = f.size < 1024
            ? `${f.size} B`
            : f.size < 1024 * 1024
              ? `${fixedNumber(f.size / 1024, 1)} KB`
              : `${fixedNumber(f.size / (1024 * 1024), 1)} MB`;
          newFiles.push(normalizeFile({
            id: `file_${Date.now()}_${this.data.files.length}_${i}`,
            name: f.name,
            path: f.path,
            ext,
            size: f.size,
            sizeText,
            status: supported ? 'ok' : 'error',
            error: supported ? undefined : '暂不支持该文件格式',
          }));
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
    this.refreshState();
  },

  dismissError() {
    this.setData({ errorMessage: '' });
  },

  // ---- 运行分析 ----
  async runAnalysis() {
    const cloudMessage = getCloudUnavailableMessage();
    if (cloudMessage) {
      showAnalysisError(cloudMessage);
      return;
    }

    const { files, model, contextText, noLLM } = this.data;
    const okFiles = files.filter((f) => f.status === 'ok');
    if (!okFiles.length) {
      wx.showToast({ title: '请先选择文件', icon: 'none' });
      return;
    }

    saveLastRunParams({ model, context: contextText, noLLM });
    const settings = getSettings();

    this.setData({
      isRunning: true,
      progress: 0,
      statusMessage: '准备上传文件...',
      errorMessage: '',
    });
    this.refreshState();

    let taskId = '';
    try {
      const cloudPath = `uploads/${Date.now()}_${okFiles[0].name}`;
      this.setData({ statusMessage: `上传中: ${okFiles[0].name}` });

      const fileID = await uploadFile(okFiles[0].path, cloudPath);

      this.setData({ progress: 10, statusMessage: '任务已提交，等待云函数处理...' });
      const submitResult = await submitAnalysis({
        fileID,
        model,
        analysisContext: contextText,
        noLLM,
        maxLabelRecords: settings.maxLabelRecords || 200,
        labelConcurrency: settings.labelConcurrency || 5,
      });
      taskId = submitResult.taskId;

      this.setData({ lastTaskId: taskId });

      await pollTaskResult(
        taskId,
        (status) => {
          const progress = status.progress || {};
          const done = progress.label_done || 0;
          const total = progress.label_total || 100;
          const pct = percentFromProgress(done, total);
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
        createdAt: (new (Date)()).toISOString(),
        fileName: okFiles[0].name,
        model,
        noLLM,
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
        taskId: taskId || `failed_${Date.now()}`,
        status: 'failed',
        createdAt: (new (Date)()).toISOString(),
        fileName: okFiles[0] ? okFiles[0].name : '反馈分析任务',
        model,
        noLLM,
        error: msg,
      });
      this.setData({
        isRunning: false,
        errorMessage: msg,
        statusMessage: '',
      });
      this.refreshState();
      showAnalysisError(msg);
    }
  },
});
