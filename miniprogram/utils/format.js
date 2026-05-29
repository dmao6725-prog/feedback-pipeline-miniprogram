// ============================================================
// format.js - 格式化工具函数
// ============================================================

function percent(n) {
  if (n === null || n === undefined) return '—';
  return (n * 100).toFixed(1) + '%';
}

function compact(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function fileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatYearMonth(ym) {
  if (!ym || ym.length < 7) return ym || '—';
  const parts = ym.split('-');
  return `${parts[0]}年${parseInt(parts[1], 10)}月`;
}

function sentimentColor(sentiment) {
  switch (sentiment) {
    case '正面': return '#10b981';
    case '负面': return '#ef4444';
    case '中性': return '#9ca3af';
    case '混合': return '#f59e0b';
    default: return '#6b7280';
  }
}

function severityColor(severity) {
  switch (severity) {
    case '高': return '#ef4444';
    case '中': return '#f59e0b';
    case '低': return '#3b82f6';
    default: return '#6b7280';
  }
}

function platformLabel(code) {
  const map = {
    google_play: 'Google Play',
    app_store: 'App Store',
    reddit: 'Reddit',
    local: '本地文件',
  };
  return map[code] || code || '本地文件';
}

function truncate(text, maxLen = 120) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

module.exports = {
  percent,
  compact,
  fileSize,
  formatDate,
  formatYearMonth,
  sentimentColor,
  severityColor,
  platformLabel,
  truncate,
};
