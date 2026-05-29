// ============================================================
// storage.js - 本地存储工具（历史记录缓存 & 设置）
// ============================================================

const STORAGE_KEYS = {
  HISTORY_LIST: 'fp_history_list',
  SETTINGS: 'fp_settings',
  LAST_MODEL: 'fp_last_model',
  LAST_CONTEXT: 'fp_last_context',
  LAST_NO_LLM: 'fp_last_no_llm',
};

// ---- 历史列表缓存 ----
function getLocalHistoryList() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.HISTORY_LIST);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function setLocalHistoryList(items) {
  wx.setStorageSync(STORAGE_KEYS.HISTORY_LIST, JSON.stringify(items.slice(0, 100)));
}

function addLocalHistoryItem(item) {
  const list = getLocalHistoryList();
  list.unshift(item);
  setLocalHistoryList(list);
}

// ---- 设置 ----
function getSettings() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.SETTINGS);
    if (raw) return JSON.parse(raw);
  } catch (err) {}
  return { defaultModel: 'deepseek-v4-flash', defaultNoLLM: false };
}

function saveSettings(settings) {
  wx.setStorageSync(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// ---- 上次运行参数 ----
function getLastRunParams() {
  return {
    model: wx.getStorageSync(STORAGE_KEYS.LAST_MODEL) || 'deepseek-v4-flash',
    context: wx.getStorageSync(STORAGE_KEYS.LAST_CONTEXT) || '',
    noLLM: wx.getStorageSync(STORAGE_KEYS.LAST_NO_LLM) || false,
  };
}

function saveLastRunParams(params) {
  wx.setStorageSync(STORAGE_KEYS.LAST_MODEL, params.model);
  wx.setStorageSync(STORAGE_KEYS.LAST_CONTEXT, params.context);
  wx.setStorageSync(STORAGE_KEYS.LAST_NO_LLM, params.noLLM);
}

module.exports = {
  getLocalHistoryList,
  setLocalHistoryList,
  addLocalHistoryItem,
  getSettings,
  saveSettings,
  getLastRunParams,
  saveLastRunParams,
};
