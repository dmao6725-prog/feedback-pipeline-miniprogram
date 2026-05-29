// ============================================================
// history.ts — 历史记录页
// 从 Swift HistoryListView.swift 迁移
// ============================================================

import { getLocalHistoryList, setLocalHistoryList } from '../../utils/storage';
import { formatDate } from '../../utils/format';

interface HistoryEntry {
  taskId: string;
  status: string;
  createdAt: string;
  resultSummary?: {
    total: number | null;
    llm_enabled: boolean | null;
    negative_rate: number | null;
    high_severity_rate: number | null;
  };
  error?: string;
}

Page({
  data: {
    historyList: [] as HistoryEntry[],
    loading: true,
  },

  onShow() {
    this.loadHistory();
  },

  loadHistory() {
    const list = getLocalHistoryList();
    this.setData({ historyList: list, loading: false });
  },

  // ---- 查看详情 ----
  viewDetail(e: any) {
    const taskId = e.currentTarget.dataset.taskId;
    if (!taskId || taskId.startsWith('failed_')) {
      wx.showToast({ title: '该任务已失败，无法查看结果', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/result/result?taskId=${taskId}` });
  },

  // ---- 删除 ----
  deleteItem(e: any) {
    const taskId = e.currentTarget.dataset.taskId;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          const list = getLocalHistoryList().filter((h: HistoryEntry) => h.taskId !== taskId);
          setLocalHistoryList(list);
          this.setData({ historyList: list });
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      },
    });
  },

  // ---- 清空 ----
  clearAll() {
    wx.showModal({
      title: '清空全部历史',
      content: '将删除所有本地历史记录，不可恢复',
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

  // ---- 格式化辅助 ----
  formatDate(d: string): string {
    return formatDate(d);
  },

  statusText(status: string): string {
    switch (status) {
      case 'completed': return '完成';
      case 'failed': return '失败';
      case 'parsing': case 'cleaning': case 'analyzing': case 'summarizing': return '进行中';
      default: return status;
    }
  },

  statusClass(status: string): string {
    switch (status) {
      case 'completed': return 'chip-pos';
      case 'failed': return 'chip-neg';
      default: return 'chip-warn';
    }
  },
});
