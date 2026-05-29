// result.js - 结果看板
// 从 Swift ResultView.swift 迁移

const { getTaskResult } = require('../../utils/api');

const TOPIC_OPTIONS = ['全部', '账号问题', '翻译问题', '审核与内容治理', '隐私与合规',
  '推荐算法', '产品bug', '性能', '内容生态', '跨文化互动', '广告与商业化', '客服', '其他'];
const SENTIMENT_OPTIONS = ['全部', '正面', '负面', '中性', '混合'];
const SEVERITY_OPTIONS = ['全部', '高', '中', '低'];

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function formatNumber(value, fallback = '0') {
  if (!hasValue(value)) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : fallback;
}

function roundPositive(value) {
  return parseInt(Number(value) + 0.5, 10);
}

function fixedNumber(value, digits) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (!digits) return String(roundPositive(n));
  const scale = 10 ** digits;
  const rounded = roundPositive(n * scale);
  const whole = parseInt(rounded / scale, 10);
  const fraction = String(rounded % scale).padStart(digits, '0');
  return `${whole}.${fraction}`;
}

function maxCount(items) {
  let max = 1;
  for (const item of items || []) {
    const count = Number(item.count || 0);
    if (count > max) max = count;
  }
  return max;
}

function formatPercent(value, digits = 0) {
  if (!hasValue(value)) return '';
  return `${fixedNumber(Number(value) * 100, digits)}%`;
}

function formatRating(value) {
  if (!hasValue(value)) return '';
  return fixedNumber(value, 2);
}

function topicBarColor(negativeRate) {
  const n = Number(negativeRate);
  if (!Number.isFinite(n)) return '#2563eb';
  if (n >= 0.5) return '#ef4444';
  if (n >= 0.25) return '#f59e0b';
  return '#2563eb';
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

function getField(row, keys, fallback = '') {
  for (const key of keys) {
    if (hasValue(row[key])) return row[key];
  }
  return fallback;
}

function meaningfulText(value) {
  return hasValue(value) && value !== '—';
}

function normalizeResultRow(row, index, expandedIds) {
  const rowId = `s-${index}`;
  const product = getField(row, ['产品']);
  const topicText = getField(row, ['议题分类']);
  const sentimentText = getField(row, ['情感倾向']);
  const severityText = getField(row, ['严重程度']);
  const coreMeaningText = getField(row, ['核心含义']);
  const userIntentText = getField(row, ['用户意图']);
  const actionabilityText = getField(row, ['可落地性']);
  const evidenceText = getField(row, ['证据原文']);
  const platformText = getField(row, ['平台'], '本地文件');
  const sourceFileText = getField(row, ['来源文件']);
  const isExpanded = expandedIds.indexOf(rowId) >= 0;

  return Object.assign({}, row, {
    _idx: index,
    rowId,
    sampleTitle: product || `样本 ${index + 1}`,
    summaryText: getField(row, ['摘要文本', '核心含义', '证据原文']),
    topicText,
    hasTopic: meaningfulText(topicText),
    sentimentText,
    isPositive: sentimentText === '正面',
    isNegative: sentimentText === '负面',
    isMixed: sentimentText === '混合',
    isNeutral: sentimentText === '中性',
    severityText,
    isSevere: severityText === '高',
    hasCoreMeaning: meaningfulText(coreMeaningText),
    coreMeaningText,
    hasUserIntent: meaningfulText(userIntentText),
    userIntentText,
    hasActionability: meaningfulText(actionabilityText),
    actionabilityText,
    hasEvidence: meaningfulText(evidenceText),
    evidenceText,
    sourceText: sourceFileText ? `${platformText} · ${sourceFileText}` : platformText,
    isExpanded,
    expandText: isExpanded ? '收起 ▲' : '展开 ▼',
  });
}

function getCommonRows(result) {
  if (!result || !result.tables || !result.tables.common || !result.tables.common.rows) {
    return [];
  }
  return result.tables.common.rows;
}

function normalizeRows(rows, expandedIds) {
  return (rows || []).map((row, index) => normalizeResultRow(row, index, expandedIds || []));
}

function normalizeResult(result, expandedIds) {
  const overview = result.overview || {};
  const meta = result.meta || {};
  const summaries = result.summaries || {};
  const total = Number(overview.total || 0);
  const commonRows = getCommonRows(result);

  const topics = result.topics || [];
  const maxTopicCount = maxCount(topics);
  const topicsView = topics.slice(0, 10).map((item) => ({
    topic: item.topic,
    countText: formatNumber(item.count),
    shareText: formatPercent(item.share, 0),
    widthText: `${roundPositive((Number(item.count || 0) / maxTopicCount) * 100)}%`,
    barColor: topicBarColor(item.negative_rate),
  }));

  const sentimentCounts = overview.sentiment_counts || {};
  const sentimentBarsView = ['正面', '负面', '中性', '混合']
    .filter((name) => Number(sentimentCounts[name] || 0) > 0)
    .map((name) => {
      const count = Number(sentimentCounts[name] || 0);
      const pct = total > 0 ? roundPositive((count / total) * 100) : 0;
      return {
        name,
        color: sentimentColor(name),
        countText: String(count),
        widthText: `${pct}%`,
      };
    });

  const trend = result.trend || [];
  const maxTrendCount = maxCount(trend);
  const trendView = trend.map((item) => ({
    yearMonth: item.year_month,
    countText: formatNumber(item.count),
    widthText: `${roundPositive((Number(item.count || 0) / maxTrendCount) * 100)}%`,
    hasNegativeRate: hasValue(item.negative_rate),
    negativeRateText: formatPercent(item.negative_rate, 0),
  }));

  const negativeRateText = formatPercent(overview.negative_rate, 1);
  const highSeverityRateText = formatPercent(overview.high_severity_rate, 1);
  const avgRatingText = formatRating(overview.play_avg_rating);

  return Object.assign({}, result, {
    meta: Object.assign({}, meta, {
      platforms: meta.platforms || [],
    }),
    overviewView: {
      totalText: formatNumber(overview.total),
      hasNegativeRate: !!negativeRateText,
      negativeRateText,
      hasNegativeCount: hasValue(overview.negative_count),
      negativeCountText: `共 ${formatNumber(overview.negative_count)} 条`,
      hasHighSeverityRate: !!highSeverityRateText,
      highSeverityRateText,
      hasHighSeverityCount: hasValue(overview.high_severity_count),
      highSeverityCountText: `共 ${formatNumber(overview.high_severity_count)} 条`,
      hasAvgRating: !!avgRatingText,
      avgRatingText,
    },
    executiveSummaryText: summaries.executive_summary || '',
    topicSummaryText: summaries.topic || '',
    hasExecutiveSummary: !!summaries.executive_summary,
    hasTopicSummary: !!summaries.topic,
    hasPlatforms: !!(meta.platforms && meta.platforms.length),
    hasTopics: topicsView.length > 0,
    topicCountText: `${topics.length} 个议题`,
    topicsView,
    hasSentiments: sentimentBarsView.length > 0,
    sentimentBarsView,
    hasTrend: trendView.length > 0,
    trendCountText: `${trend.length} 个月`,
    trendView,
    hasRows: commonRows.length > 0,
    sampleRows: normalizeRows(commonRows.slice(0, 3), []),
  });
}

Page({
  data: {
    taskId: '',
    loading: true,
    error: '',
    result: null,

    activeTab: 'overview',

    topicIdx: 0,
    sentimentIdx: 0,
    severityIdx: 0,
    meaningfulOnly: false,

    topicOptions: TOPIC_OPTIONS,
    sentimentOptions: SENTIMENT_OPTIONS,
    severityOptions: SEVERITY_OPTIONS,
    selectedTopicText: '全部',
    selectedSentimentText: '全部',
    selectedSeverityText: '全部',

    filteredRows: [],
    expandedIds: [],
  },

  onLoad(options) {
    const taskId = options.taskId || '';
    this.setData({ taskId });
    if (taskId) this.loadResult();
    else this.setData({ loading: false, error: '缺少任务 ID' });
  },

  async loadResult() {
    this.setData({ loading: true, error: '' });
    try {
      const resp = await getTaskResult(this.data.taskId);
      if (resp.result) {
        const result = normalizeResult(resp.result, this.data.expandedIds);
        this.setData({ result, loading: false });
        this.applyFilters(result);
      } else if (resp.status === 'failed') {
        this.setData({ error: resp.error || '任务处理失败', loading: false });
      } else if (resp.status) {
        this.setData({ error: `任务状态: ${resp.status}，请稍后重试`, loading: false });
      } else {
        this.setData({ error: '任务结果不存在', loading: false });
      }
    } catch (err) {
      this.setData({ error: err && err.message ? err.message : '加载失败', loading: false });
    }
  },

  // ---- tab ----
  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  // ---- 筛选 ----
  onTopicChange(e) {
    const topicIdx = parseInt(e.detail.value, 10) || 0;
    this.setData({
      topicIdx,
      selectedTopicText: this.data.topicOptions[topicIdx] || '全部',
    });
    this.applyFilters(null, null, { topicIdx });
  },

  onSentimentChange(e) {
    const sentimentIdx = parseInt(e.detail.value, 10) || 0;
    this.setData({
      sentimentIdx,
      selectedSentimentText: this.data.sentimentOptions[sentimentIdx] || '全部',
    });
    this.applyFilters(null, null, { sentimentIdx });
  },

  onSeverityChange(e) {
    const severityIdx = parseInt(e.detail.value, 10) || 0;
    this.setData({
      severityIdx,
      selectedSeverityText: this.data.severityOptions[severityIdx] || '全部',
    });
    this.applyFilters(null, null, { severityIdx });
  },

  toggleMeaningful() {
    const meaningfulOnly = !this.data.meaningfulOnly;
    this.setData({ meaningfulOnly });
    this.applyFilters(null, null, { meaningfulOnly });
  },

  applyFilters(resultOverride, expandedIdsOverride, filterOverride) {
    const state = Object.assign({}, this.data, filterOverride || {});
    const result = resultOverride || state.result;
    const expandedIds = expandedIdsOverride || state.expandedIds;

    if (!result) {
      this.setData({ filteredRows: [] });
      return;
    }

    const rows = getCommonRows(result);
    if (!rows.length) {
      this.setData({ filteredRows: [] });
      return;
    }

    const topicVal = state.topicOptions[state.topicIdx] || '全部';
    const sentimentVal = state.sentimentOptions[state.sentimentIdx] || '全部';
    const severityVal = state.severityOptions[state.severityIdx] || '全部';

    const filteredRows = rows
      .map((row, index) => normalizeResultRow(row, index, expandedIds))
      .filter((row) => {
        if (topicVal !== '全部' && row.topicText !== topicVal) return false;
        if (sentimentVal !== '全部' && row.sentimentText !== sentimentVal) return false;
        if (severityVal !== '全部' && row.severityText !== severityVal) return false;
        if (state.meaningfulOnly && !row.hasCoreMeaning && !row.hasActionability) return false;
        return true;
      });

    this.setData({ filteredRows });
  },

  // ---- 展开/收起 ----
  toggleSample(e) {
    const id = String(e.currentTarget.dataset.id);
    const expandedIds = this.data.expandedIds.slice();
    const idx = expandedIds.indexOf(id);
    if (idx >= 0) expandedIds.splice(idx, 1);
    else expandedIds.push(id);
    this.setData({ expandedIds });
    this.applyFilters(null, expandedIds);
  },

  // ---- 导出 CSV ----
  exportCSV() {
    const { result } = this.data;
    if (!result || !result.tables || !result.tables.common || !result.tables.common.rows || !result.tables.common.rows.length) {
      wx.showToast({ title: '没有可导出的数据', icon: 'none' });
      return;
    }
    const table = result.tables.common;
    const header = table.columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
    const rows = table.rows.map((r) =>
      table.columns.map((c) => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = '\ufeff' + header + '\n' + rows.join('\n');

    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/analysis_result.csv`;
    fs.writeFile({
      filePath,
      data: csv,
      encoding: 'utf8',
      success: () => {
        wx.shareFileMessage({ filePath, fileName: 'analysis_result.csv' });
      },
      fail: (err) => {
        wx.showToast({ title: '导出失败: ' + ((err && err.errMsg) || ''), icon: 'none' });
      },
    });
  },
});
