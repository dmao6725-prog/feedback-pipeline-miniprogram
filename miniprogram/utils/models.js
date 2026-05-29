// ============================================================
// models.js - 前端运行时常量
// ============================================================

const SUPPORTED_EXTENSIONS = [
  'txt', 'md', 'markdown', 'csv', 'tsv',
  'json', 'jsonl', 'ndjson', 'xml', 'html', 'htm',
];

const MODELS = [
  { label: 'Flash (快速)', value: 'deepseek-v4-flash' },
  { label: 'Pro (高质量)', value: 'deepseek-v4-pro' },
];

module.exports = {
  SUPPORTED_EXTENSIONS,
  MODELS,
};
