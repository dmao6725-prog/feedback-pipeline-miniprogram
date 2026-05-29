// ============================================================
// storage.ts — 本地存储工具（历史记录缓存 & 设置）
// ============================================================

const STORAGE_KEYS = {
  HISTORY_LIST: 'fp_history_list',
  SETTINGS: 'fp_settings',
  LAST_MODEL: 'fp_last_model',
  LAST_CONTEXT: 'fp_last_context',
  LAST_NO_LLM: 'fp_last_no_llm',
};

// ---- 历史列表缓存 ----
export function getLocalHistoryList(): any[] {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.HISTORY_LIST);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalHistoryList(items: any[]): void {
  wx.setStorageSync(STORAGE_KEYS.HISTORY_LIST, JSON.stringify(items.slice(0, 100)));
}

export function addLocalHistoryItem(item: any): void {
  const list = getLocalHistoryList();
  list.unshift(item);
  setLocalHistoryList(list);
}

// ---- 设置 ----
export interface AppSettings {
  defaultModel: string;
  defaultNoLLM: boolean;
}

export function getSettings(): AppSettings {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.SETTINGS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { defaultModel: 'deepseek-v4-flash', defaultNoLLM: false };
}

export function saveSettings(settings: AppSettings): void {
  wx.setStorageSync(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// ---- 上次运行参数 ----
export function getLastRunParams(): { model: string; context: string; noLLM: boolean } {
  return {
    model: wx.getStorageSync(STORAGE_KEYS.LAST_MODEL) || 'deepseek-v4-flash',
    context: wx.getStorageSync(STORAGE_KEYS.LAST_CONTEXT) || '',
    noLLM: wx.getStorageSync(STORAGE_KEYS.LAST_NO_LLM) || false,
  };
}

export function saveLastRunParams(params: { model: string; context: string; noLLM: boolean }): void {
  wx.setStorageSync(STORAGE_KEYS.LAST_MODEL, params.model);
  wx.setStorageSync(STORAGE_KEYS.LAST_CONTEXT, params.context);
  wx.setStorageSync(STORAGE_KEYS.LAST_NO_LLM, params.noLLM);
}
