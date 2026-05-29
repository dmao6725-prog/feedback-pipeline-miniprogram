// ============================================================
// run.ts — 首页：选择文件、配置参数、启动分析、进度跟踪
// 从 Swift HomeView.swift 迁移
// ============================================================

import { submitAnalysis, pollTaskResult } from '../../utils/api';
import { percent, fileSize } from '../../utils/format';
import { addLocalHistoryItem, getLastRunParams, saveLastRunParams, getSettings } from '../../utils/storage';
import { LocalFile, SUPPORTED_EXTENSIONS } from '../../utils/models';

const MAX_FILE_COUNT = 5;

interface RunData {
  files: LocalFile[];
  model: string;
  contextText: string;
  noLLM: boolean;
  isRunning: boolean;
  progress: number;
  statusMessage: string;
  errorMessage: string;
  lastTaskId: string;
}

Page<RunData, {}>({
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
  },

  onLoad() {
    const params = getLastRunParams();
    const settings = getSettings();
    this.setData({
      model: params.model || settings.defaultModel,
      contextText: params.context,
      noLLM: params.noLLM || settings.defaultNoLLM,
    });
  },

  // ---- 选择文件 ----
  chooseFile() {
    if (this.data.isRunning) return;

    const count = this.data.files.filter((f) => f.status === 'ok').length;
    if (count >= MAX_FILE_COUNT) {
      wx.showToast({ title: `最多选择 ${MAX_FILE_COUNT} 个文件`, icon: 'none' });
      return;
    }

    wx.chooseMessageFile({
      count: MAX_FILE_COUNT - count,
      type: 'file',
      success: (res) => {
        const newFiles: LocalFile[] = [];
        for (const f of res.tempFiles) {
          const ext = (f.name.split('.').pop() || '').toLowerCase();
          const supported = SUPPORTED_EXTENSIONS.includes(ext);
          newFiles.push({
            id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: f.name,
            path: f.path,
            ext,
            size: f.size,
            status: supported ? 'ok' : 'error',
            error: supported ? undefined : `暂不支持 .${ext} 文件`,
          });
        }
        const allFiles = [...this.data.files, ...newFiles];
        const ok = newFiles.filter((f) => f.status === 'ok').length;
        if (ok > 0) wx.showToast({ title: `已选择 ${ok} 个文件`, icon: 'success' });
        const bad = newFiles.length - ok;
        if (bad > 0) wx.showToast({ title: `${bad} 个文件格式不支持`, icon: 'none' });
        this.setData({ files: allFiles });
      },
    });
  },

  // ---- 删除文件 ----
  removeFile(e: any) {
    const idx = e.currentTarget.dataset.index;
    const files = [...this.data.files];
    files.splice(idx, 1);
    this.setData({ files });
  },

  // ---- 模型选择 ----
  selectModel(e: any) {
    this.setData({ model: e.currentTarget.dataset.model });
  },

  // ---- 上下文输入 ----
  onContextInput(e: any) {
    this.setData({ contextText: e.detail.value });
  },

  // ---- 仅清洗模式 ----
  toggleNoLLM() {
    this.setData({ noLLM: !this.data.noLLM });
  },

  // ---- 忽略错误 ----
  dismissError() {
    this.setData({ errorMessage: '' });
  },

  // ---- 运行分析 ----
  async runAnalysis() {
    const { files, model, contextText, noLLM } = this.data;
    const okFiles = files.filter((f) => f.status === 'ok');
    if (!okFiles.length) {
      wx.showToast({ title: '请先选择可分析的文件', icon: 'none' });
      return;
    }

    saveLastRunParams({ model, context: contextText, noLLM });
    this.setData({ isRunning: true, progress: 0, statusMessage: '正在上传文件...', errorMessage: '' });

    try {
      // 1. 上传文件到云存储
      const fileIDs: string[] = [];
      for (let i = 0; i < okFiles.length; i++) {
        const f = okFiles[i];
        const filesCopy = [...this.data.files];
        const item = filesCopy.find((x) => x.id === f.id);
        if (item) item.status = 'uploading';
        this.setData({ files: filesCopy, statusMessage: `正在上传 ${f.name} (${i + 1}/${okFiles.length})...` });

        const cloudPath = `uploads/${Date.now()}_${f.name}`;
        const res: any = await new Promise((resolve, reject) => {
          wx.cloud.uploadFile({ cloudPath, filePath: f.path, success: resolve, fail: reject });
        });
        fileIDs.push(res.fileID);
      }

      // 2. 调用云函数
      this.setData({ progress: 10, statusMessage: '正在提交分析任务...' });
      const { taskId } = await submitAnalysis({
        fileID: fileIDs[0], // 云函数目前只接受单个 fileID
        model,
        analysisContext: contextText,
        noLLM,
      });

      this.setData({ lastTaskId: taskId });

      // 3. 轮询进度
      this.setData({ progress: 15, statusMessage: '任务已提交，等待云函数处理...' });
      const result = await pollTaskResult(
        taskId,
        (status: any) => {
          const pct = Math.min(95, 15 + (status.progress?.label_done || 0) * 0.8);
          const msg = status.progress?.last_message || status.status || '处理中...';
          this.setData({
            progress: Math.round(pct),
            statusMessage: msg,
          });
        },
        3000,
        300
      );

      this.setData({ progress: 100, statusMessage: '处理完成', isRunning: false });

      // 4. 保存到本地历史
      addLocalHistoryItem({
        taskId,
        status: 'completed',
        createdAt: new Date().toISOString(),
        resultSummary: {
          total: result.result?.meta?.total ?? null,
          llm_enabled: !noLLM,
          negative_rate: result.result?.overview?.negative_rate ?? null,
          high_severity_rate: result.result?.overview?.high_severity_rate ?? null,
        },
      });

      // 5. 跳转结果页
      wx.navigateTo({ url: `/pages/result/result?taskId=${taskId}` });
    } catch (err: any) {
      console.error('[run] Error:', err);
      // 保存失败记录
      addLocalHistoryItem({
        taskId: `failed_${Date.now()}`,
        status: 'failed',
        createdAt: new Date().toISOString(),
        error: err.message || '未知错误',
      });
      this.setData({
        isRunning: false,
        errorMessage: err.message || '分析失败，请检查网络或参数后重试',
      });
    }
  },

  // ---- 计算属性 ----
  get cannotRun(): boolean {
    const { files, isRunning, noLLM } = this.data;
    if (isRunning) return true;
    return !files.some((f) => f.status === 'ok');
  },
});
