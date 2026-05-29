// ============================================================
// parser.js — 文件读取、文本提取、清洗、分段、去重、共鸣度
// 从 Swift LocalFileParser.swift 迁移
// ============================================================

/**
 * 支持的扩展名
 */
const SUPPORTED_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'ndjson',
  'xml', 'rss', 'atom', 'html', 'htm'
]);

const DEFAULT_MAX_CHARS = 2400;

// ---- 入口：从 buffer 解析为 ParsedDocument ----
function parse(fileName, buffer) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(`暂不支持 .${ext} 文件类型`);
  }

  let text;
  let records;

  switch (ext) {
    case 'txt':
    case 'md':
    case 'markdown':
      text = bufferToString(buffer);
      records = chunkText(text, fileName);
      break;
    case 'csv':
      text = bufferToString(buffer);
      records = recordsFromDelimited(text, ',', fileName);
      if (!records.length) records = chunkText(text, fileName);
      break;
    case 'tsv':
      text = bufferToString(buffer);
      records = recordsFromDelimited(text, '\t', fileName);
      if (!records.length) records = chunkText(text, fileName);
      break;
    case 'json':
      text = bufferToString(buffer);
      records = recordsFromJSON(text, fileName);
      if (!records.length) records = chunkText(text, fileName);
      break;
    case 'jsonl':
    case 'ndjson':
      text = bufferToString(buffer);
      records = recordsFromJSONLines(text, fileName);
      if (!records.length) records = chunkText(text, fileName);
      break;
    case 'xml':
    case 'rss':
    case 'atom':
    case 'html':
    case 'htm':
      text = stripTags(bufferToString(buffer));
      records = chunkText(text, fileName);
      break;
    case 'xlsx':
    case 'xls':
      throw new Error('XLSX/Excel 文件暂不支持。此功能计划在后续版本中实现。建议将 Excel 导出为 CSV 后导入。');
    case 'pdf':
      throw new Error('PDF 文件暂不支持。此功能计划在后续版本中实现。建议将 PDF 内容复制到 TXT 文件后导入。');
    default:
      text = bufferToString(buffer);
      records = chunkText(text, fileName);
  }

  const clean = cleanText(text);
  if (!clean || clean.length === 0) throw new Error('文件内容为空');

  const deduped = deduplicate(records);
  if (!deduped.length) throw new Error('解析后无有效记录');

  return {
    fileName,
    fileType: ext,
    text: clean,
    records: deduped,
  };
}

// ---- 文本分段 ----
function chunkText(text, sourceFile, maxChars = DEFAULT_MAX_CHARS) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';
  const items = paragraphs.length ? paragraphs : [cleaned];

  for (const para of items) {
    if (current.length + para.length + 1 > maxChars && current) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? current + '\n' + para : para;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((text) => makeRecord(text, '', sourceFile, {}));
}

// ---- 文本清洗 ----
function cleanText(text) {
  let value = stripTags(text);
  value = value.replace(/https?:\/\/\S+|www\.\S+/g, '');
  value = value.replace(/!?\[.*?\]\(.*?\)/g, '');
  value = value.replace(/\s+/g, ' ');
  return value.trim();
}

// ---- HTML 去标签 ----
function stripTags(text) {
  return text.replace(/<[^>]+>/g, ' ');
}

// ---- 启发式主题推断 ----
function inferTopic(text) {
  const lower = text.toLowerCase();
  const topics = [
    ['账号问题', ['account', 'login', 'sign in', 'banned', 'ban', 'verify', '封', '登录', '账号', '申诉', '验证']],
    ['翻译问题', ['translate', 'translation', 'subtitle', '翻译', '字幕']],
    ['隐私与合规', ['privacy', 'data', 'passport', 'id card', 'clipboard', 'server', '隐私', '数据', '护照', '剪贴板', '服务器']],
    ['产品bug', ['bug', 'crash', 'error', 'glitch', 'freeze', '崩溃', '闪退', '报错']],
    ['性能', ['slow', 'lag', 'loading', 'battery', '卡顿', '耗电']],
    ['广告与商业化', ['ad', 'ads', 'subscription', 'premium', 'paywall', '广告', '付费', '订阅']],
    ['推荐算法', ['algorithm', 'recommend', 'feed', 'for you', '推荐', '算法']],
    ['跨文化互动', ['chinese', 'american', 'culture', 'tiktok refugee', '中美', '跨文化', '文化']],
  ];
  for (const [topic, keywords] of topics) {
    if (keywords.some((kw) => lower.includes(kw))) return topic;
  }
  return '其他';
}

// ---- CSV/TSV 解析 ----
function recordsFromDelimited(text, delimiter, sourceFile) {
  const table = parseDelimited(text, delimiter);
  if (!table.length || table.length < 2) return [];
  const header = table[0];
  return table.slice(1).map((row) => {
    const fields = {};
    header.forEach((name, idx) => {
      if (idx < row.length) fields[name] = row[idx];
    });
    return recordFromFields(fields, sourceFile);
  }).filter(Boolean);
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const chars = [...text];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < chars.length && chars[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      row.push(cell); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && i + 1 < chars.length && chars[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim()));
}

// ---- JSON 解析 ----
function recordsFromJSON(text, sourceFile) {
  let root;
  try {
    root = JSON.parse(text);
  } catch { return []; }

  const objects = extractObjects(root);
  if (!objects.length) return [];
  return objects.map((obj) => recordFromFields(flatten(obj), sourceFile)).filter(Boolean);
}

function extractObjects(root) {
  if (Array.isArray(root) && root.every((r) => typeof r === 'object' && r !== null)) return root;
  if (typeof root === 'object' && root !== null) {
    for (const value of Object.values(root)) {
      if (Array.isArray(value) && value.every((v) => typeof v === 'object')) return value;
    }
    return [root];
  }
  return [];
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(out, flatten(value, nextKey));
    } else if (value === null || value === undefined) {
      out[nextKey] = '';
    } else {
      out[nextKey] = String(value);
    }
  }
  return out;
}

// ---- JSONL 解析 ----
function recordsFromJSONLines(text, sourceFile) {
  return text
    .split(/\n/)
    .map((line) => line.trim().replace(/[, \t]+$/, ''))
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean)
    .filter((o) => typeof o === 'object' && !Array.isArray(o))
    .map((obj) => recordFromFields(flatten(obj), sourceFile))
    .filter(Boolean);
}

// ---- 字段识别：从扁平化字段映射到 LocalFeedbackRecord ----
function recordFromFields(fields, sourceFile) {
  const lower = {};
  for (const [k, v] of Object.entries(fields)) {
    lower[normalizeKey(k)] = v;
  }

  const text = firstValue(lower, ['reviewtext', 'review', 'text', 'content', 'body', 'selftext', 'comment', 'message', 'value']);
  const title = firstValue(lower, ['title', 'reviewtitle', 'subject']);
  const joined = Object.values(fields).join(' ');
  const raw = text || joined || '';
  if (!raw.trim() && !title.trim()) return null;

  const record = makeRecord(raw, title, sourceFile, fields);

  record.platform = detectPlatform(fields);
  record.product = firstValue(lower, ['product', 'app', 'appname', 'appid', 'bundleid', 'packagename']) || (record.platform === 'reddit' ? '社区讨论' : '本地文件');
  record.date = normalizeDate(firstValue(lower, ['createdat', 'created', 'date', 'updated', 'at', 'postedat', 'reviewdate']));
  record.yearMonth = record.date.substring(0, 7);
  record.rating = firstValue(lower, ['rating', 'score', 'stars', 'starrating']);
  record.engagement = intValue(firstValue(lower, ['engagement', 'helpfulcount', 'thumbsupcount', 'upvotes', 'ups', 'numcomments', 'commentscount', 'likes', 'likecount', 'score']));

  return record;
}

function makeRecord(rawText, title, sourceFile, fields) {
  const clean = cleanText(rawText);
  const cleanTitle = cleanText(title);
  const full = cleanTitle ? (clean ? cleanTitle + '. ' + clean : cleanTitle) : clean;
  const summary = full.length > 120 ? full.substring(0, 120) + '...' : full;

  return {
    id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    platform: 'local',
    sourceFile,
    product: '本地文件',
    title: cleanTitle,
    rawText,
    cleanedText: full,
    summaryText: summary,
    date: '',
    yearMonth: '',
    engagement: 0,
    rating: '',
    keywordTopic: inferTopic(full),
    resonanceScore: 0,
    resonanceLevel: '低',
    sentiment: '',
    topic: '',
    intent: '',
    severity: '',
    actionability: '',
    coreMeaning: '',
    evidenceQuote: '',
    aiConfidence: '',
    labelError: '',
  };
}

// ---- 去重 ----
function deduplicate(records) {
  const seen = new Set();
  const output = [];
  for (const record of records) {
    const key = record.cleanedText.toLowerCase().replace(/[\s\W_]+/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(record);
  }
  return output;
}

// ---- 共鸣度计算 ----
function addResonance(records) {
  const maxEngagement = Math.max(...records.map((r) => r.engagement || 0), 0);
  const denominator = maxEngagement > 0 ? Math.log1p(maxEngagement) : 1;

  return records.map((r) => {
    const copy = { ...r };
    const score = Math.log1p(Math.max(0, copy.engagement || 0)) / denominator;
    copy.resonanceScore = Math.round(score * 100) / 100;
    copy.resonanceLevel = score >= 0.66 ? '高' : score >= 0.33 ? '中' : '低';
    return copy;
  });
}

// ---- 辅助函数 ----
function bufferToString(buffer) {
  if (typeof buffer === 'string') return buffer;
  if (Buffer.isBuffer(buffer)) {
    // 尝试 UTF-8，失败回退 latin1
    try { return buffer.toString('utf8'); } catch { return buffer.toString('latin1'); }
  }
  return String(buffer || '');
}

function normalizeKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function firstValue(fields, keys) {
  for (const key of keys) {
    const v = (fields[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function intValue(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.floor(n);
}

function normalizeDate(value) {
  if (!value || !value.trim()) return '';
  const trimmed = value.trim();

  // ISO date
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // Timestamp
  const ts = parseFloat(trimmed);
  if (!isNaN(ts) && ts > 0) {
    const sec = ts > 1e12 ? ts / 1000 : ts;
    return new Date(sec * 1000).toISOString().substring(0, 10);
  }

  return trimmed.substring(0, 10);
}

function detectPlatform(fields) {
  const keys = new Set(Object.keys(fields).map(normalizeKey));
  const blob = Object.values(fields).join(' ').toLowerCase();

  if (blob.includes('reddit.com') || keys.has('subreddit') || keys.has('selftext')) return 'reddit';
  if (blob.includes('apps.apple.com') || keys.has('bundleid') || keys.has('trackid')) return 'app_store';
  if (blob.includes('play.google.com') || keys.has('packagename') || keys.has('thumbsupcount')) return 'google_play';
  return 'local';
}

module.exports = {
  parse,
  chunkText,
  cleanText,
  stripTags,
  inferTopic,
  deduplicate,
  addResonance,
  recordsFromDelimited,
  recordsFromJSON,
  recordsFromJSONLines,
  SUPPORTED_EXTENSIONS,
};
