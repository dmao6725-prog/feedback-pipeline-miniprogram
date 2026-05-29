// result.ts — 结果看板
// 从 Swift ResultView.swift 迁移

import { getTaskResult } from '../../utils/api';
import { TaskResult } from '../../utils/models';

const TOPIC_OPTIONS = ['全部', '账号问题', '翻译问题', '审核与内容治理', '隐私与合规',
  '推荐算法', '产品bug', '性能', '内容生态', '跨文化互动', '广告与商业化', '客服', '其他'];
const SENTIMENT_OPTIONS = ['全部', '正面', '负面', '中性', '混合'];
const SEVERITY_OPTIONS = ['全部', '高', '中', '低'];

Page({
  data: {
    taskId: '' as string,
    loading: true as boolean,
    error: '' as string,
    emptyMessage: '' as string,
    result: null as TaskResult | null,

    activeTab: 'overview' as string,

    // filter indices
    topicIdx: 0 as number,
    sentimentIdx: 0 as number,
    severityIdx: 0 as number,
    meaningfulOnly: false as boolean,

    // filter options
    topicOptions: TOPIC_OPTIONS as string[],
    sentimentOptions: SENTIMENT_OPTIONS as string[],
    severityOptions: SEVERITY_OPTIONS as string[],

    // filtered rows (computed in TS)
    filteredRows: [] as any[],
    expandedIds: [] as string[],
  },

  onLoad(options: any) {
    const taskId = options && options.taskId ? options.taskId : '';
    if (!taskId) {
      this.setData({
        taskId: '',
        loading: false,
        error: '',
        emptyMessage: '暂无分析结果，请先完成一次分析',
      });
      return;
    }

    this.setData({ taskId, emptyMessage: '' });
    this.loadResult();
  },

  async loadResult() {
    if (!this.data.taskId) {
      this.setData({
        loading: false,
        error: '',
        emptyMessage: '暂无分析结果，请先完成一次分析',
      });
      return;
    }

    this.setData({ loading: true, error: '', emptyMessage: '' });
    try {
      const resp = await getTaskResult(this.data.taskId);
      if (resp.result) {
        this.setData({ result: resp.result, loading: false });
        this.applyFilters();
      } else if (resp.status === 'failed') {
        this.setData({ error: resp.error || '任务处理失败', loading: false });
      } else if (resp.status) {
        this.setData({ error: `任务状态: ${resp.status}，请稍后重试`, loading: false });
      } else {
        this.setData({ error: '任务结果不存在', loading: false });
      }
    } catch (err: any) {
      this.setData({ error: err.message || '加载失败', loading: false });
    }
  },

  // ---- tab ----
  switchTab(e: any) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  // ---- 筛选 ----
  onTopicChange(e: any) {
    this.setData({ topicIdx: parseInt(e.detail.value, 10) || 0 });
    this.applyFilters();
  },
  onSentimentChange(e: any) {
    this.setData({ sentimentIdx: parseInt(e.detail.value, 10) || 0 });
    this.applyFilters();
  },
  onSeverityChange(e: any) {
    this.setData({ severityIdx: parseInt(e.detail.value, 10) || 0 });
    this.applyFilters();
  },
  toggleMeaningful() {
    this.setData({ meaningfulOnly: !this.data.meaningfulOnly });
    this.applyFilters();
  },

  applyFilters() {
    const { result, topicIdx, sentimentIdx, severityIdx, meaningfulOnly, topicOptions, sentimentOptions, severityOptions } = this.data;
    if (!result?.tables?.common?.rows) {
      this.setData({ filteredRows: [] });
      return;
    }

    const topicVal = topicOptions[topicIdx] || '全部';
    const sentimentVal = sentimentOptions[sentimentIdx] || '全部';
    const severityVal = severityOptions[severityIdx] || '全部';

    const rows = result.tables.common.rows
      .map((r: any, i: number) => ({ ...r, _idx: i }))
      .filter((r: any) => {
        if (topicVal !== '全部' && r['议题分类'] !== topicVal) return false;
        if (sentimentVal !== '全部' && r['情感倾向'] !== sentimentVal) return false;
        if (severityVal !== '全部' && r['严重程度'] !== severityVal) return false;
        if (meaningfulOnly && !r['核心含义'] && !r['可落地性'] && r['核心含义'] !== '—' && r['可落地性'] !== '—') return false;
        return true;
      });

    this.setData({ filteredRows: rows });
  },

  // ---- 展开/收起 ----
  toggleSample(e: any) {
    const id = String(e.currentTarget.dataset.id);
    const expandedIds = [...this.data.expandedIds];
    const idx = expandedIds.indexOf(id);
    if (idx >= 0) expandedIds.splice(idx, 1);
    else expandedIds.push(id);
    this.setData({ expandedIds });
  },

  // ---- 导出 CSV ----
  exportCSV() {
    const { result } = this.data;
    if (!result?.tables?.common?.rows?.length) {
      wx.showToast({ title: '没有可导出的数据', icon: 'none' });
      return;
    }
    const table = result.tables.common;
    const header = table.columns.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(',');
    const rows = table.rows.map((r: any) =>
      table.columns.map((c: string) => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = '﻿' + header + '\n' + rows.join('\n');

    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/analysis_result.csv`;
    fs.writeFile({
      filePath,
      data: csv,
      encoding: 'utf8',
      success: () => {
        wx.shareFileMessage({ filePath, fileName: 'analysis_result.csv' });
      },
      fail: (err: any) => {
        wx.showToast({ title: '导出失败: ' + (err.errMsg || ''), icon: 'none' });
      },
    });
  },
});
