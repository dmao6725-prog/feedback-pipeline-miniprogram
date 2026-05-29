// ============================================================
// pipeline.js — 核心处理流水线：解析 -> 共鸣 -> LLM 标注 -> 聚合
// 从 Swift LocalProcessingPipeline.swift 迁移
// ============================================================

const parser = require('./parser');
const { createClient } = require('./deepseek');

const DEFAULT_TOPICS = [
  '账号问题', '翻译问题', '审核与内容治理', '隐私与合规', '推荐算法',
  '产品bug', '性能', '内容生态', '跨文化互动', '广告与商业化', '客服', '其他',
];

const DEFAULT_MAX_LABEL = 200;
const DEFAULT_CONCURRENCY = 5;

/**
 * 完整处理：buffer → TaskResult
 * @param {Buffer|string} fileBuffer
 * @param {string} fileName
 * @param {object} options
 * @param {function} onProgress - (stage: string, fraction: number) => void
 */
async function process(fileBuffer, fileName, options = {}, onProgress = () => {}) {
  const {
    apiKey = '',
    model = 'deepseek-v4-flash',
    context = '',
    noLLM = false,
    topics = DEFAULT_TOPICS,
    maxLabelRecords = DEFAULT_MAX_LABEL,
    labelConcurrency = DEFAULT_CONCURRENCY,
  } = options;

  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  // 1. 解析文件
  onProgress('readingFile', 0.05);
  const doc = parser.parse(fileName, fileBuffer);
  if (!doc || !doc.records || !doc.records.length) {
    throw new Error('文件内容为空或解析无记录');
  }

  // 2. 计算共鸣度
  onProgress('extractingText', 0.25);
  let records = parser.addResonance(doc.records);

  // 3. LLM 标注 或 noLLM fallback
  let executiveSummary = '';
  let sampledNotice = '';

  if (noLLM) {
    onProgress('chunkingText', 0.60);
    executiveSummary = fallbackSummary(records);
    onProgress('mergingResult', 0.80);
  } else {
    if (!apiKey || !apiKey.trim()) throw new Error('请输入 DeepSeek API Key');

    const client = createClient(apiKey);
    const total = records.length;
    const labelTarget = Math.min(total, maxLabelRecords);
    if (total > maxLabelRecords) {
      sampledNotice = `本次共解析 ${total} 段，按抽样上限标注前 ${labelTarget} 段（其余段保留原文/启发式信息，不参与 LLM 标注）。`;
    }
    const startLLM = Date.now();
    onProgress('callingDeepSeek', 0.35);

    // 并发标注
    const labels = await runLabelTasks(client, records, labelTarget, model, context, topics, labelConcurrency, (done, total) => {
      const fraction = 0.35 + 0.50 * (done / Math.max(total, 1));
      onProgress('callingDeepSeek', Math.min(fraction, 0.88));
    });

    // 写入标注
    for (const [idx, label] of labels) {
      if (idx < records.length) {
        records[idx].sentiment = label.sentiment;
        records[idx].topic = label.topic;
        records[idx].intent = label.intent;
        records[idx].severity = label.severity;
        records[idx].actionability = label.actionability;
        records[idx].coreMeaning = label.core_meaning;
        records[idx].evidenceQuote = label.evidence_quote;
        records[idx].aiConfidence = label.ai_confidence;
        records[idx].labelError = label.label_error;
      }
    }

    const llmMs = Date.now() - startLLM;
    console.log(`[Pipeline] LLM 标注结束: total=${total} labeled=${labelTarget} concurrency=${labelConcurrency} ms=${llmMs}`);

    // 4. 生成摘要
    onProgress('mergingResult', 0.90);
    executiveSummary = await client.summarize(records, model, context);
    if (sampledNotice) {
      executiveSummary = sampledNotice + '\n\n' + executiveSummary;
    }
  }

  // 5. 构建 TaskResult
  const result = buildTaskResult(taskId, records, noLLM, executiveSummary);

  const totalMs = Date.now() - startTime;
  console.log(`[Pipeline] 完成: totalMs=${totalMs} records=${records.length} noLLM=${noLLM}`);

  onProgress('completed', 1.0);
  return result;
}

// ---- 并发标注 ----
async function runLabelTasks(client, records, limit, model, context, topics, concurrency, onProgress) {
  if (limit <= 0) return [];

  const indices = records.slice(0, limit).map((_, i) => i);
  const results = [];
  let cursor = 0;
  let done = 0;

  const runOne = async (idx) => {
    try {
      const text = records[idx].cleanedText;
      const label = await client.label(text, model, context, topics);
      return [idx, label];
    } catch (err) {
      console.error(`[Pipeline] label ${idx} failed:`, err.message);
      return [idx, {
        sentiment: '', topic: '', intent: '', severity: '', actionability: '',
        core_meaning: '', evidence_quote: '', ai_confidence: '',
        label_error: err.message || '未知错误',
      }];
    }
  };

  // 使用 semaphore 控制并发
  const tasks = [];
  for (let i = 0; i < Math.min(concurrency, indices.length); i++) {
    tasks.push(runWorker());
  }

  async function runWorker() {
    while (cursor < indices.length) {
      const idx = indices[cursor++];
      const result = await runOne(idx);
      results.push(result);
      done++;
      onProgress(done, indices.length);
    }
  }

  await Promise.all(tasks);
  return results;
}

// ---- noLLM fallback 摘要 ----
function fallbackSummary(records) {
  if (!records.length) return '';

  const topicCounts = {};
  for (const r of records) {
    const t = r.topic || r.keywordTopic || '其他';
    topicCounts[t] = (topicCounts[t] || 0) + 1;
  }

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k} ${v} 条`)
    .join('，');

  const negative = records.filter((r) => r.sentiment === '负面').length;
  if (negative > 0) {
    return `本次共处理 ${records.length} 段反馈，负面 ${negative} 段。主要议题包括：${topTopics}。`;
  }
  return `本次共处理 ${records.length} 段反馈。主要议题包括：${topTopics}。`;
}

// ---- 构建 TaskResult ----
function buildTaskResult(taskId, records, noLLM, executiveSummary) {
  const total = records.length;
  const platforms = platformCounts(records);
  const topics = topicRows(records);
  const sentimentCounts = countBy(records.map((r) => r.sentiment).filter(Boolean));
  const severityCounts = countBy(records.map((r) => r.severity).filter(Boolean));
  const negativeCount = sentimentCounts['负面'] || 0;
  const highSeverityCount = severityCounts['高'] || 0;
  const common = buildTable(records);

  return {
    meta: {
      task_id: taskId,
      llm_enabled: !noLLM,
      no_llm: noLLM,
      total,
      platforms: platforms.map((p) => ({ code: p.code, label: p.label, count: p.count })),
      topics: topics.map((t) => t.topic),
      competitors: [],
      failed_files: [],
    },
    guide: guideEntries(),
    overview: {
      total,
      negative_count: negativeCount || null,
      negative_rate: rate(negativeCount, total),
      high_severity_count: highSeverityCount || null,
      high_severity_rate: rate(highSeverityCount, total),
      play_avg_rating: playAverage(records),
      display_platform_counts: Object.fromEntries(platforms.map((p) => [p.label, p.count])),
      sentiment_counts: sentimentCounts,
      severity_counts: severityCounts,
      play_rating_distribution: ratingDistribution(records),
    },
    topics,
    trend: trendRows(records),
    high_resonance: { columns: [], rows: [], banner: '' },
    clusters: [],
    competitors: { products: [], matrix: [] },
    summaries: {
      overview: fallbackSummary(records),
      topic: topics.slice(0, 5).map((t) => `${t.topic}：${t.count} 条`).join('；'),
      trend: '',
      executive_summary: executiveSummary || fallbackSummary(records),
    },
    tables: { common },
    platform_tables: { local: common },
    downloads: {},
  };
}

// ---- 聚合辅助 ----
function platformCounts(records) {
  const counts = countBy(records.map((r) => r.platform));
  return Object.entries(counts)
    .map(([code, count]) => ({ code, label: platformLabel(code), count }))
    .sort((a, b) => b.count - a.count);
}

function topicRows(records) {
  const grouped = {};
  for (const r of records) {
    const key = r.topic || r.keywordTopic || '其他';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  return Object.entries(grouped)
    .map(([topic, rows]) => {
      const negative = rows.filter((r) => r.sentiment === '负面').length;
      const severe = rows.filter((r) => r.severity === '高').length;
      return {
        topic,
        count: rows.length,
        share: rows.length / Math.max(records.length, 1),
        negative_rate: rate(negative, rows.length),
        high_severity_rate: rate(severe, rows.length),
      };
    })
    .sort((a, b) => b.count - a.count);
}

function trendRows(records) {
  const dated = records.filter((r) => r.yearMonth && r.yearMonth.length >= 7);
  const grouped = {};
  for (const r of dated) {
    if (!grouped[r.yearMonth]) grouped[r.yearMonth] = [];
    grouped[r.yearMonth].push(r);
  }
  return Object.entries(grouped)
    .map(([month, rows]) => {
      const negative = rows.filter((r) => r.sentiment === '负面').length;
      const severe = rows.filter((r) => r.severity === '高').length;
      return {
        year_month: month,
        count: rows.length,
        negative_rate: rate(negative, rows.length),
        high_severity_rate: rate(severe, rows.length),
        low_sample: rows.length < 5,
      };
    })
    .sort((a, b) => a.year_month.localeCompare(b.year_month));
}

function buildTable(records) {
  const columns = ['平台', '产品', '议题分类', '情感倾向', '严重程度', '用户意图', '可落地性', '核心含义', '证据原文', '摘要文本', '来源文件'];
  const rows = records.map((r) => ({
    '平台': r.platform ? platformLabel(r.platform) : '本地文件',
    '产品': r.product || '本地文件',
    '议题分类': r.topic || r.keywordTopic || '其他',
    '情感倾向': r.sentiment || '—',
    '严重程度': r.severity || '—',
    '用户意图': r.intent || '—',
    '可落地性': r.actionability || '—',
    '核心含义': r.coreMeaning || '—',
    '证据原文': r.evidenceQuote || r.cleanedText || '',
    '摘要文本': r.summaryText || '',
    '来源文件': r.sourceFile || '',
  }));
  return { columns, rows, banner: '', label: '本地文件明细', platform_label: '本地文件' };
}

function guideEntries() {
  return [
    { '字段名': '情感倾向', '说明': '系统对反馈情绪的结构化标注。', '出现位置·取值': '正面 / 负面 / 中性 / 混合' },
    { '字段名': '议题分类', '说明': '基于项目默认议题体系。', '出现位置·取值': DEFAULT_TOPICS.join(' / ') },
    { '字段名': '严重程度', '说明': '高代表封禁、登录、支付、隐私或严重影响使用的问题。', '出现位置·取值': '高 / 中 / 低' },
    { '字段名': '可落地性', '说明': '该反馈是否能转化为明确产品动作。', '出现位置·取值': '高 / 中 / 低' },
  ];
}

function countBy(values) {
  const counts = {};
  for (const v of values) {
    if (v !== null && v !== undefined && v !== '') counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

function rate(count, total) {
  if (count === undefined || count === null || total <= 0) return null;
  return Math.round((count / total) * 10000) / 10000;
}

function playAverage(records) {
  const values = records
    .filter((r) => r.platform === 'google_play' || r.platform === 'app_store')
    .map((r) => parseFloat(r.rating))
    .filter((v) => !isNaN(v));
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

function ratingDistribution(records) {
  const values = records
    .map((r) => parseInt(r.rating, 10))
    .filter((v) => !isNaN(v) && v > 0);
  const grouped = {};
  for (const v of values) {
    grouped[v] = (grouped[v] || 0) + 1;
  }
  return Object.entries(grouped)
    .map(([rating, count]) => ({ rating: `${rating}星`, count }))
    .sort((a, b) => a.rating.localeCompare(b.rating));
}

function platformLabel(code) {
  switch (code) {
    case 'google_play': return 'Google Play';
    case 'app_store': return 'App Store';
    case 'reddit': return 'Reddit';
    case 'local': return '本地文件';
    default: return code || '本地文件';
  }
}

module.exports = { process, fallbackSummary, buildTaskResult, DEFAULT_TOPICS, DEFAULT_MAX_LABEL, DEFAULT_CONCURRENCY };
