// ============================================================
// deepseek.js — DeepSeek API 客户端（OpenAI-compatible）
// 从 Swift DeepSeekClient.swift 迁移
// ============================================================

const ENDPOINT = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT =
  '你是一名资深用户研究员。请对单条用户反馈做结构化标注。必须直接输出一个合法的 json 对象，不要任何解释文字，不要 markdown 代码块，不要 ```json 包裹，第一个字符必须是 { 最后一个字符必须是 }。';

const SUMMARY_SYSTEM_PROMPT =
  '你是资深产品分析师，向产品负责人汇报。语言精炼、结论先行、可执行。只用正常中文标点，不要 markdown 符号或 emoji。';

const DEFAULT_TOPICS = [
  '账号问题', '翻译问题', '审核与内容治理', '隐私与合规', '推荐算法',
  '产品bug', '性能', '内容生态', '跨文化互动', '广告与商业化', '客服', '其他',
];

/**
 * 创建 DeepSeekClient 实例
 * @param {string} apiKey
 */
function createClient(apiKey) {
  const key = (apiKey || '').trim();
  if (!key) throw new Error('请输入 DeepSeek API Key');

  return { label: (text, model, context, topics) => _label(key, text, model, context, topics),
           summarize: (records, model, context) => _summarize(key, records, model, context) };
}

// ---- 单条标注 ----
async function _label(apiKey, text, model, context, topics) {
  const topicList = (topics && topics.length > 0) ? topics : DEFAULT_TOPICS;
  const prompt = labelPrompt(text, context, topicList);

  const content = await chat(apiKey, {
    model: model || 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  return decodeLabel(content);
}

// ---- 聚合摘要 ----
async function _summarize(apiKey, records, model, context) {
  const digest = buildDigest(records, context);
  if (!digest) return '';

  const content = await chat(apiKey, {
    model: model || 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: digest },
    ],
    temperature: 0.3,
    max_tokens: 1200,
  });

  return (content || '').trim();
}

// ---- Chat Completions 核心调用 ----
async function chat(apiKey, params, attempt = 1) {
  const maxAttempts = 3;

  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout?.(90000), // 90s timeout
    });

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '');
      if (isRetryableStatus(resp.status) && attempt < maxAttempts) {
        await backoff(attempt);
        return chat(apiKey, params, attempt + 1);
      }
      throw mapHTTPError(resp.status, bodyText);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content && content.trim()) return content;

    throw new Error('DeepSeek 返回为空');
  } catch (err) {
    // 网络错误可重试
    if (isRetryableNetwork(err) && attempt < maxAttempts) {
      await backoff(attempt);
      return chat(apiKey, params, attempt + 1);
    }
    throw err;
  }
}

// ---- 标注 prompt ----
function labelPrompt(text, context, topics) {
  const contextLine = (context || '').trim()
    ? `本次分析的主题/场景：${context}\n请结合该场景理解反馈。\n\n`
    : '';

  return `${contextLine}用户反馈：
"""${(text || '').substring(0, 2200)}"""

只输出下列字段的 JSON 对象：
- sentiment：从 ["正面","负面","中性","混合"] 中选一个
- topic：从 ${JSON.stringify(topics)} 中选一个主类
- intent：从 ["投诉","求助","表扬","建议","询问","讨论","预警","其他"] 中选一个
- severity：从 ["高","中","低"] 中选一个。高=封禁/无法登录/支付隐私安全/严重影响使用；中=功能异常或反复出现的问题；低=轻微建议或普通吐槽
- actionability：从 ["高","中","低"] 中选一个。高=可转化为明确产品动作；中=需进一步验证；低=纯情绪表达
- core_meaning：一句话中文概括，40 字以内
- evidence_quote：最能代表观点的一句原文（保留原语言）
- ai_confidence：1-5 的整数，表示你对本条标注的确定程度`;
}

// ---- 摘要 digest ----
function buildDigest(records, context) {
  if (!records || !records.length) return '';

  const total = records.length;

  const sentimentCounts = {};
  const topicCounts = {};
  for (const r of records) {
    const s = r.sentiment || '未标注';
    sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;
    const t = r.topic || r.keywordTopic || '未标注';
    topicCounts[t] = (topicCounts[t] || 0) + 1;
  }

  const negative = sentimentCounts['负面'] || 0;
  const severe = records.filter((r) => r.severity === '高').length;

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => `- ${k}: ${v} 条`)
    .join('\n');

  const quotes = records
    .sort((a, b) => (b.resonanceScore || 0) - (a.resonanceScore || 0))
    .slice(0, 8)
    .map((r) => `- ${r.coreMeaning || r.summaryText || ''}`)
    .join('\n');

  const contextLine = context ? `分析主题/场景：${context}\n` : '';

  return `${contextLine}下面是一份本地处理得到的用户反馈标注统计。请产出面向产品负责人的摘要，分为"核心结论""高优先级问题""行动建议"三段。

样本总量：${total}
负面样本：${negative}，负面率：${total > 0 ? ((negative / total) * 100).toFixed(1) : 0}%
高严重度样本：${severe}

情感分布：${JSON.stringify(sentimentCounts)}

议题分布：
${topTopics}

高共鸣或代表性样本：
${quotes}`;
}

// ---- JSON 解码与 normalize ----
function decodeLabel(rawContent) {
  const cleaned = extractJSONObject(rawContent) || stripCodeFence(rawContent);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`JSON 语法错误；原始内容=${preview(rawContent)}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`顶层应为 JSON object；原始内容=${preview(rawContent)}`);
  }

  return normalizeAnnotation(parsed, preview(rawContent));
}

function normalizeAnnotation(raw) {
  const required = ['sentiment', 'topic', 'intent', 'severity', 'actionability'];
  const missing = required.filter((f) => !coalesceString(raw, f));
  if (missing.length) {
    throw new Error(`缺少字段 ${missing.join(', ')}`);
  }

  return {
    sentiment: coalesceString(raw, 'sentiment') || '',
    topic: coalesceString(raw, 'topic') || '',
    intent: coalesceString(raw, 'intent') || '',
    severity: coalesceString(raw, 'severity') || '',
    actionability: coalesceString(raw, 'actionability') || '',
    core_meaning: coalesceString(raw, 'core_meaning', 'coreMeaning') || '',
    evidence_quote: coalesceString(raw, 'evidence_quote', 'evidenceQuote') || '',
    ai_confidence: coalesceNumberString(raw, 'ai_confidence', 'aiConfidence') || '',
    label_error: coalesceString(raw, 'label_error', 'labelError') || '',
  };
}

function coalesceString(raw, ...keys) {
  for (const k of keys) {
    const v = raw[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) return t;
    } else if (typeof v === 'number') {
      return String(v);
    } else {
      return String(v);
    }
  }
  return null;
}

function coalesceNumberString(raw, ...keys) {
  for (const k of keys) {
    const v = raw[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) return t;
    }
  }
  return null;
}

// ---- JSON 提取（处理 LLM 可能包裹的 markdown / 多余文字） ----
function extractJSONObject(value) {
  const start = value.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < value.length; i++) {
    const c = value[i];
    if (escaped) { escaped = false; continue; }
    if (inString) {
      if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else {
      if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return value.substring(start, i + 1);
      }
    }
  }
  return null;
}

function stripCodeFence(value) {
  let text = value.trim();
  const fenceMatch = text.match(/```(?:json)?\s*\n?/);
  if (fenceMatch) {
    text = text.substring(fenceMatch.index + fenceMatch[0].length);
    const endIdx = text.lastIndexOf('```');
    if (endIdx !== -1) text = text.substring(0, endIdx);
  }
  return text.trim();
}

// ---- 错误处理与重试 ----
function isRetryableStatus(code) {
  return code === 429 || (code >= 500 && code <= 599);
}

function isRetryableNetwork(err) {
  const msg = (err.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('fetch') || msg.includes('network') ||
         msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('abort');
}

function mapHTTPError(code, bodyText) {
  const detail = (() => {
    try { return JSON.parse(bodyText).error?.message; } catch {}
    try { return JSON.parse(bodyText).detail; } catch {}
    return String(bodyText || '');
  })();

  switch (code) {
    case 401:
    case 403:
      return new Error('DeepSeek API Key 无效或无权限');
    case 429:
      return new Error('DeepSeek 请求过于频繁，请稍后重试');
    case 500:
    case 502:
    case 503:
    case 504:
      return new Error(`DeepSeek 服务错误：${detail || `HTTP ${code}`}`);
    default:
      return new Error(detail || `HTTP ${code}`);
  }
}

function backoff(attempt) {
  const base = 0.5 * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.25;
  return new Promise((resolve) => setTimeout(resolve, (base + jitter) * 1000));
}

function preview(content, limit = 300) {
  return content.length > limit ? content.substring(0, limit) + '…' : content;
}

// ---- 自检 ----
function selfCheck() {
  const fixture = `{
    "sentiment": "混合",
    "topic": "账号问题",
    "intent": "投诉",
    "severity": "中",
    "actionability": "高",
    "core_meaning": "用户账号被无故限制，无法发帖评论但仍能浏览内容。",
    "evidence_quote": "Like many my account has been restricted...",
    "ai_confidence": 4
  }`;

  const label = decodeLabel(fixture);
  console.assert(label.sentiment === '混合', `sentiment fail: ${label.sentiment}`);
  console.assert(label.severity === '中', `severity fail: ${label.severity}`);
  console.assert(label.ai_confidence === '4', `aiConfidence fail: ${label.ai_confidence}`);
  console.log('[DeepSeek selfCheck] OK');

  // 反向用例：缺字段
  try {
    decodeLabel('{"sentiment":"负面"}');
    console.assert(false, 'expected missing-field error');
  } catch (e) {
    console.assert(e.message.includes('缺少字段'), `missing-field message wrong: ${e.message}`);
  }

  // 反向用例：顶层是 array
  try {
    decodeLabel('[]');
    console.assert(false, 'expected top-level array error');
  } catch (e) {
    console.assert(e.message.includes('顶层应为'), `array error wrong: ${e.message}`);
  }

  console.log('[DeepSeek selfCheck] All passed');
}

module.exports = { createClient, decodeLabel, selfCheck, DEFAULT_TOPICS };
