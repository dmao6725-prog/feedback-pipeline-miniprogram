// history.js - 历史记录页
// 从 Swift HistoryListView.swift 迁移

const { getLocalHistoryList, setLocalHistoryList } = require('../../utils/storage');

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function formatPercent(value) {
  if (!hasValue(value)) return '';
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : '';
}

function normalizeHistoryItem(item) {
  const summary = item.resultSummary || {};
  const status = item.status || 'failed';
  const isCompleted = status === 'completed';
  const negativeRateText = formatPercent(summary.negative_rate);

  return Object.assign({}, item, {
    statusClass: status,
    statusChipClass: isCompleted ? 'chip-pos' : 'chip-neg',
    statusText: isCompleted ? '已完成' : '失败',
    createdAtText: item.createdAt || '',
    hasSummary: !!item.resultSummary,
    hasSampleCount: hasValue(summary.total),
    sampleCountText: hasValue(summary.total) ? `${summary.total} 条` : '',
    hasLlmStatus: hasValue(summary.llm_enabled),
    llmStatusText: summary.llm_enabled ? 'AI 标注' : '仅清洗',
    hasNegativeRate: !!negativeRateText,
    negativeRateText,
    canView: isCompleted,
  });
}

function normalizeHistoryList(list) {
  return (list || []).map(normalizeHistoryItem);
}

Page({
  data: {
    historyList: [],
    loading: true,
  },

  onShow() {
    this.loadHistory();
  },

  loadHistory() {
    const list = getLocalHistoryList();
    this.setData({
      historyList: normalizeHistoryList(list),
      loading: false,
    });
  },

  viewDetail(e) {
    const taskId = e.currentTarget.dataset.taskId;
    if (!taskId || taskId.startsWith('failed_')) {
      wx.showToast({ title: '该任务已失败，无法查看结果', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/result/result?taskId=${taskId}` });
  },

  deleteItem(e) {
    const taskId = e.currentTarget.dataset.taskId;
    wx.showModal({
      title: '删除记录',
      content: '删除后可在云数据库中重新查询',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          const list = getLocalHistoryList().filter((h) => h.taskId !== taskId);
          setLocalHistoryList(list);
          this.setData({ historyList: normalizeHistoryList(list) });
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      },
    });
  },

  clearAll() {
    wx.showModal({
      title: '清空全部历史',
      content: '仅清除本地缓存，云数据库记录不受影响。',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          setLocalHistoryList([]);
          this.setData({ historyList: [] });
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      },
    });
  },
});
