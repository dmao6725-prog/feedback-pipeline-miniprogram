// ============================================================
// format.ts — 格式化工具函数
// ============================================================

/**
 * 百分比格式化
 */
export function percent(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return (n * 100).toFixed(1) + '%';
}

/**
 * 大整数简写
 */
export function compact(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

/**
 * 文件大小显示
 */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * 日期格式化
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 年月格式化
 */
export function formatYearMonth(ym: string): string {
  if (!ym || ym.length < 7) return ym || '—';
  const [y, m] = ym.split('-');
  return `${y}年${parseInt(m)}月`;
}

/**
 * 情感颜色映射
 */
export function sentimentColor(sentiment: string): string {
  switch (sentiment) {
    case '正面': return '#10b981';
    case '负面': return '#ef4444';
    case '中性': return '#9ca3af';
    case '混合': return '#f59e0b';
    default: return '#6b7280';
  }
}

/**
 * 严重程度颜色映射
 */
export function severityColor(severity: string): string {
  switch (severity) {
    case '高': return '#ef4444';
    case '中': return '#f59e0b';
    case '低': return '#3b82f6';
    default: return '#6b7280';
  }
}

/**
 * 平台名称映射
 */
export function platformLabel(code: string): string {
  const map: Record<string, string> = {
    google_play: 'Google Play',
    app_store: 'App Store',
    reddit: 'Reddit',
    local: '本地文件',
  };
  return map[code] || code || '本地文件';
}

/**
 * 字符串截断
 */
export function truncate(text: string, maxLen = 120): string {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}
