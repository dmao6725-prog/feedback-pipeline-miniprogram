// run.ts — 分析页：文件选择、参数配置、启动分析、进度跟踪
// 从 Swift HomeView.swift 迁移

import { submitAnalysis, pollTaskResult } from '../../utils/api';
import { addLocalHistoryItem, getLastRunParams, saveLastRunParams, getSettings } from '../../utils/storage';
import { SUPPORTED_EXTENSIONS } from '../../utils/models';

const MAX_FILE_COUNT = 5;

interface LocalFile {
  id: string;
  name: string;
  path: string;
  ext: string;
  size: number;
  sizeText: string;
  status: 'ok' | 'error' | 'uploading';
  error?: string;
}

Page({
  data: {
    files: [] as LocalFile[],
    model: 'deepseek-v4-flash' as string,
    contextText: '' as string,
    noLLM: false as boolean,
    isRunning: false as boolean,
    progress: 0 as number,
    statusMessage: '' as string,
    errorMessage: '' as string,
    lastTaskId: '' as string,
    // computed
    hasValidFiles: false as boolean,
    canRun: false as boolean,
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
        const newFiles: LocalFile[] = [];
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

        this.setData({ files: [...this.data.files, ...newFiles] });
        this.refreshState();
      },
    });
  },

  removeFile(e: any) {
    const idx = e.currentTarget.dataset.index;
    const files = [...this.data.files];
    files.splice(idx, 1);
    this.setData({ files });
    this.refreshState();
  },

  // ---- 参数变更 ----
  selectModel(e: any) {
    this.setData({ model: e.currentTarget.dataset.model });
  },

  onContextInput(e: any) {
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
      // 上传文件到云存储
      const cloudPath = `uploads/${Date.now()}_${okFiles[0].name}`;
      this.setData({ statusMessage: `上传中: ${okFiles[0].name}` });

      const uploadRes: any = await new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath,
          filePath: okFiles[0].path,
          success: resolve,
          fail: reject,
        });
      });
      const fileID = uploadRes.fileID;

      // 提交分析任务
      this.setData({ progress: 10, statusMessage: '任务已提交，等待云函数处理...' });
      const { taskId } = await submitAnalysis({
        fileID,
        model,
        analysisContext: contextText,
        noLLM,
      });

      this.setData({ lastTaskId: taskId });

      // 轮询进度
      await pollTaskResult(
        taskId,
        (status: any) => {
          const done = status.progress?.label_done || 0;
          const total = status.progress?.label_total || 100;
          const pct = Math.min(95, 15 + Math.round((done / Math.max(total, 1)) * 80));
          const msg = status.progress?.last_message || status.status || '处理中...';
          this.setData({
            progress: pct,
            statusMessage: msg,
          });
        },
        3000,
        300
      );

      this.setData({ progress: 100, statusMessage: '处理完成', isRunning: false });

      // 保存历史
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

      // 跳转结果页
      wx.navigateTo({ url: `/pages/result/result?taskId=${taskId}` });
    } catch (err: any) {
      const msg = err.message || '分析失败，请检查网络或参数后重试';
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
