// ============================================================
// models.ts — 前端数据模型（从 typings/models.ts 导出）
// ============================================================

export interface ProgressLabel {
  label_done: number;
  label_total: number;
  last_message: string;
}

export interface ResultMeta {
  task_id: string;
  llm_enabled: boolean;
  no_llm: boolean;
  total: number;
  platforms: PlatformCount[];
  topics: string[];
  competitors: string[];
  failed_files: { file: string; error: string }[];
}

export interface PlatformCount {
  code: string;
  label: string;
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
  play_rating_distribution: { rating: string; count: number }[];
}

export interface Topic {
  topic: string;
  count: number;
  share: number;
  negative_rate: number | null;
  high_severity_rate: number | null;
}

export interface TrendPoint {
  year_month: string;
  count: number;
  negative_rate: number | null;
  high_severity_rate: number | null;
  low_sample: boolean;
}

export interface Cluster {
  cluster_id: string;
  label: string;
  size: number;
  negative_rate: number | null;
  high_severity_rate: number | null;
  priority_band: string;
  priority: string;
  nature: string;
  quote: string;
}

export interface Summaries {
  overview: string;
  topic: string;
  trend: string;
  executive_summary: string;
}

export interface ResultTable {
  columns: string[];
  rows: Record<string, any>[];
  banner?: string;
  label?: string;
  platform_label?: string;
}

export interface TaskResult {
  meta: ResultMeta;
  guide: any[];
  overview: Overview;
  topics: Topic[];
  trend: TrendPoint[];
  high_resonance: ResultTable;
  clusters: Cluster[];
  competitors: any;
  summaries: Summaries;
  tables: { common: ResultTable };
  platform_tables: Record<string, ResultTable>;
  downloads: Record<string, string>;
}

export interface HistoryItem {
  taskId: string;
  status: string;
  createdAt: string;
  resultSummary?: {
    total: number | null;
    llm_enabled: boolean | null;
    negative_rate: number | null;
    high_severity_rate: number | null;
  };
  error?: string;
  progress?: ProgressLabel;
}

// ---- 本地文件模型 ----
export interface LocalFile {
  id: string;
  name: string;
  path: string;
  ext: string;
  size: number;
  status: 'ok' | 'error' | 'uploading';
  error?: string;
}

export const SUPPORTED_EXTENSIONS = [
  'txt', 'md', 'markdown', 'csv', 'tsv',
  'json', 'jsonl', 'ndjson', 'xml', 'html', 'htm',
];

export const MODELS = [
  { label: 'Flash (快速)', value: 'deepseek-v4-flash' },
  { label: 'Pro (高质量)', value: 'deepseek-v4-pro' },
];
