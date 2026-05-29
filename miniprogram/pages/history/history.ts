// history.ts — 历史记录页
// 从 Swift HistoryListView.swift 迁移

import { getLocalHistoryList, setLocalHistoryList } from '../../utils/storage';

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
    loading: true as boolean,
  },

  onShow() {
    this.loadHistory();
  },

  loadHistory() {
    const list = getLocalHistoryList();
    this.setData({
      historyList: list,
      loading: false,
    });
  },

  viewDetail(e: any) {
    const taskId = e.currentTarget.dataset.taskId;
    if (!taskId || taskId.startsWith('failed_')) {
      wx.showToast({ title: '该任务已失败，无法查看结果', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/result/result?taskId=${taskId}`,
      fail(err) {
        console.error('navigateTo result failed', err);
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      },
    });
  },

  deleteItem(e: any) {
    const taskId = e.currentTarget.dataset.taskId;
    wx.showModal({
      title: '删除记录',
      content: '删除后可在云数据库中重新查询',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          const list = getLocalHistoryList().filter(
            (h: HistoryEntry) => h.taskId !== taskId
          );
          setLocalHistoryList(list);
          this.setData({ historyList: list });
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
