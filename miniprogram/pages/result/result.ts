// ============================================================
// result.ts — 结果看板
// 从 Swift ResultView.swift 迁移
// ============================================================

import { getTaskResult } from '../../utils/api';
import { percent, formatYearMonth, sentimentColor, severityColor } from '../../utils/format';
import { TaskResult, Overview, Topic, TrendPoint, ResultTable } from '../../utils/models';

Page({
  data: {
    taskId: '',
    loading: true,
    error: '',
    result: null as TaskResult | null,

    // tab
    activeTab: 'overview',

    // filters
    topicFilter: '全部',
    sentimentFilter: '全部',
    severityFilter: '全部',
    meaningfulOnly: false,

    // expanded sample IDs
    expandedIds: [] as string[],
  },

  onLoad(options: any) {
    const taskId = options.taskId || '';
    this.setData({ taskId });
    if (taskId) this.loadResult();
  },

  async loadResult() {
    this.setData({ loading: true, error: '' });
    try {
      const resp = await getTaskResult(this.data.taskId);
      if (resp.result) {
        this.setData({ result: resp.result, loading: false });
      } else if (resp.status === 'failed') {
        this.setData({ error: resp.error || '任务处理失败', loading: false });
      } else {
        this.setData({ error: '任务仍在处理中，请稍后查看', loading: false });
      }
    } catch (err: any) {
      this.setData({ error: err.message || '加载失败', loading: false });
    }
  },

  // ---- tab 切换 ----
  switchTab(e: any) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  // ---- 筛选 ----
  onTopicFilter(e: any) {
    this.setData({ topicFilter: e.detail.value });
  },
  onSentimentFilter(e: any) {
    this.setData({ sentimentFilter: e.detail.value });
  },
  onSeverityFilter(e: any) {
    this.setData({ severityFilter: e.detail.value });
  },
  toggleMeaningful() {
    this.setData({ meaningfulOnly: !this.data.meaningfulOnly });
  },

  // ---- 展开/收起样本 ----
  toggleSample(e: any) {
    const id = e.currentTarget.dataset.id;
    const expandedIds = [...this.data.expandedIds];
    const idx = expandedIds.indexOf(id);
    if (idx >= 0) expandedIds.splice(idx, 1);
    else expandedIds.push(id);
    this.setData({ expandedIds });
  },

  // ---- 计算属性（通过 wxml 引用） ----
  getSamples(): any[] {
    const { result } = this.data;
    if (!result) return [];
    const table = result.tables?.common;
    if (table?.rows) return table.rows.map((r: any, i: number) => ({ ...r, _idx: i }));
    return [];
  },

  getFilteredSamples(): any[] {
    const { topicFilter, sentimentFilter, severityFilter, meaningfulOnly } = this.data;
    return this.getSamples().filter((s: any) => {
      if (topicFilter !== '全部' && s['议题分类'] !== topicFilter) return false;
      if (sentimentFilter !== '全部' && s['情感倾向'] !== sentimentFilter) return false;
      if (severityFilter !== '全部' && s['严重程度'] !== severityFilter) return false;
      if (meaningfulOnly && !s['核心含义'] && !s['可落地性']) return false;
      return true;
    });
  },

  // ---- 导出 CSV ----
  exportCSV() {
    const { result } = this.data;
    if (!result?.tables?.common?.rows?.length) {
      wx.showToast({ title: '没有可导出的数据', icon: 'none' });
      return;
    }
    const table = result.tables.common;
    const header = table.columns.join(',');
    const rows = table.rows.map((r: any) =>
      table.columns.map((c: string) => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');

    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/analysis_result.csv`;
    fs.writeFile({
      filePath,
      data: csv,
      encoding: 'utf8',
      success: () => {
        wx.shareFileMessage({
          filePath,
          fileName: 'analysis_result.csv',
        });
      },
      fail: () => {
        wx.showToast({ title: '导出失败', icon: 'none' });
      },
    });
  },
});
