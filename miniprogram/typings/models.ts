// ============================================================
// 数据模型：与后端 JSON 契约对齐
// 从 Swift Models.swift / LocalModels.swift 迁移
// ============================================================

// ---- 进度 ----
export interface ProgressLabel {
  label_done: number;
  label_total: number;
  last_message: string;
}

export interface ProgressEvent {
  type: string;
  task_id?: string;
  status?: string;
  message?: string;
  progress?: ProgressLabel;
}

// ---- 结果元数据 ----
export interface FailedFile {
  file: string;
  error: string;
}

export interface PlatformCount {
  code: string;
  label: string;
  count: number;
}

export interface ResultMeta {
  task_id: string;
  llm_enabled: boolean;
  no_llm: boolean;
  total: number;
  platforms: PlatformCount[];
  topics: string[];
  competitors: string[];
  failed_files: FailedFile[];
}

// ---- 字段说明 ----
export interface GuideEntry {
  字段名: string;
  说明: string;
  '出现位置·取值': string;
}

// ---- 概览 KPI ----
export interface RatingBucket {
  rating: string;
  count: number;
}

export interface Overview {
  total: number;
  negative_count: number | null;
  negative_rate: number | null;
  high_severity_count: number | null;
  high_severity_rate: number | null;
  play_avg_rating: number | null;
  display_platform_counts: Record<string, number>;
  sentiment_counts: Record<string, number>;
  severity_counts: Record<string, number>;
  play_rating_distribution: RatingBucket[];
}

// ---- 议题分布 ----
export interface Topic {
  topic: string;
  count: number;
  share: number;
  negative_rate: number | null;
  high_severity_rate: number | null;
}

// ---- 趋势 ----
export interface TrendPoint {
  year_month: string;
  count: number;
  negative_rate: number | null;
  high_severity_rate: number | null;
  low_sample: boolean;
}

// ---- 问题簇 ----
export interface Cluster {
  cluster_id: string;
  label: string;
  size: number;
  negative_rate: number | null;
  high_severity_rate: number | null;
  actionability_high_rate: number | null;
  nature: string;
  main_intent: string;
  platforms: string;
  products: string | null;
  quote: string;
  url: string;
  priority_score: number;
  priority_band: string;
  priority: string;
}

// ---- 竞品热力图 ----
export interface CompetitorRow {
  topic: string;
  cells: Record<string, number | null>;
}

export interface Competitors {
  products: string[];
  matrix: CompetitorRow[];
}

// ---- 摘要 ----
export interface Summaries {
  overview: string;
  topic: string;
  trend: string;
  executive_summary: string;
}

// ---- 表格（通用） ----
export type AnyJSON = string | number | boolean | null;

export interface ResultTable {
  columns: string[];
  rows: Record<string, AnyJSON>[];
  banner?: string;
  label?: string;
  platform_label?: string;
}

export interface TablesContainer {
  common: ResultTable;
}

// ---- 完整结果 ----
export interface TaskResult {
  meta: ResultMeta;
  guide: GuideEntry[];
  overview: Overview;
  topics: Topic[];
  trend: TrendPoint[];
  high_resonance: ResultTable;
  clusters: Cluster[];
  competitors: Competitors;
  summaries: Summaries;
  tables: TablesContainer;
  platform_tables: Record<string, ResultTable>;
  downloads: Record<string, string>;
}

// ---- 历史记录 ----
export interface InputFile {
  file_id: string;
  filename: string;
  platform: string;
  rows: number | null;
  size: number | null;
}

export interface Params {
  model?: string;
  context?: string;
  no_llm?: boolean;
  uses_api_key?: boolean;
}

export interface Summary {
  total: number | null;
  llm_enabled: boolean | null;
  platforms: PlatformCount[] | null;
  negative_rate: number | null;
  high_severity_rate: number | null;
}

export interface HistoryItem {
  task_id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  inputs: InputFile[];
  params: Params;
  progress: ProgressLabel | null;
  error: string;
  summary: Summary;
  downloadable: boolean;
}

// ---- 本地处理模型 ----
export interface LocalFeedbackRecord {
  id: string;
  platform: string;
  sourceFile: string;
  product: string;
  title: string;
  rawText: string;
  cleanedText: string;
  summaryText: string;
  date: string;
  yearMonth: string;
  engagement: number;
  rating: string;
  keywordTopic: string;
  resonanceScore: number;
  resonanceLevel: string;
  sentiment: string;
  topic: string;
  intent: string;
  severity: string;
  actionability: string;
  coreMeaning: string;
  evidenceQuote: string;
  aiConfidence: string;
  labelError: string;
}

export interface DeepSeekLabel {
  sentiment: string;
  topic: string;
  intent: string;
  severity: string;
  actionability: string;
  core_meaning: string;
  evidence_quote: string;
  ai_confidence: string;
  label_error: string;
}

export interface ParsedDocument {
  fileName: string;
  fileType: string;
  text: string;
  records: LocalFeedbackRecord[];
}

export interface LocalInputFile {
  id: string;
  url: string;
  fileName: string;
  fileType: string;
  size: number;
  status: string;
  error: string;
}

// ---- 请求参数 ----
export interface AnalyzeRequest {
  fileID: string;
  model: string;
  context: string;
  noLLM: boolean;
  topics?: string[];
  maxLabelRecords?: number;
  labelConcurrency?: number;
}
