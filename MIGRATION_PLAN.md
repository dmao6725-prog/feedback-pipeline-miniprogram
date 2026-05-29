# 迁移计划：iOS SwiftUI → 微信小程序

本文档记录从 `FeedbackPipeline`（iOS SwiftUI）迁移到微信小程序版本的过程中，每个 Swift 模块的对应关系和关键决策。

## 迁移总览

| 原 Swift 模块 | 新技术栈 | 文件位置 |
|--------------|---------|---------|
| iOS App (SwiftUI) | 微信小程序 (WXML + WXSS + TypeScript) | `miniprogram/` |
| URLSession / DeepSeek API | 云函数 fetch | `cloudfunctions/analyzeFeedback/` |
| LocalHistoryStore (JSON 文件) | wx.setStorageSync | `miniprogram/utils/storage.ts` |
| Keychain (API Key) | 云函数环境变量 / 云数据库 | 云开发控制台配置 |

## 核心模块迁移对照

### 1. LocalFileParser.swift → parser.js

**原文件**：`FeedbackPipeline/Core/LocalFileParser.swift`
**新文件**：`cloudfunctions/analyzeFeedback/parser.js`

| Swift 函数 | JS 函数 | 说明 |
|-----------|---------|------|
| `isSupported(_:)` | `SUPPORTED_EXTENSIONS` Set | 支持的文件扩展名集合 |
| `parse(_:)` | `parse(fileName, buffer)` | 入口函数，按扩展名分发 |
| `chunkText(_:sourceFile:maxCharacters:)` | `chunkText(text, sourceFile, maxChars)` | 按段落 + 字符数分段 |
| `cleanText(_:)` | `cleanText(text)` | 去链接、去标签、合并空白 |
| `inferTopic(_:)` | `inferTopic(text)` | 关键词匹配推断主题 |
| `recordsFromDelimited(_:delimiter:sourceFile:)` | `recordsFromDelimited(text, delimiter, sourceFile)` | CSV/TSV 解析 |
| `parseDelimited(_:delimiter:)` | `parseDelimited(text, delimiter)` | 状态机解析分隔符文本 |
| `recordsFromJSON(_:sourceFile:)` | `recordsFromJSON(text, sourceFile)` | JSON 解析 |
| `recordsFromJSONLines(_:sourceFile:)` | `recordsFromJSONLines(text, sourceFile)` | JSONL 解析 |
| `deduplicate(_:)` | `deduplicate(records)` | 文本去重 |
| `addResonance(_:)` | `addResonance(records)` | 共鸣度计算 |
| `recordFromFields(_:sourceFile:)` | `recordFromFields(fields, sourceFile)` | 字段映射 + 平台检测 |
| `stripTags(_:)` | `stripTags(text)` | HTML 标签去除 |
| `normalizeDate(_:)` | `normalizeDate(value)` | 日期格式标准化 |
| `detectPlatform(_:)` | `detectPlatform(fields)` | 平台检测 |
| `readPDF(_:)` | — | PDF 解析暂未迁移（后续增强） |

### 2. LocalProcessingPipeline.swift → pipeline.js

**原文件**：`FeedbackPipeline/Core/LocalProcessingPipeline.swift`
**新文件**：`cloudfunctions/analyzeFeedback/pipeline.js`

| Swift 函数 | JS 函数 | 说明 |
|-----------|---------|------|
| `process(files:apiKey:model:context:noLLM:progress:)` | `process(fileBuffer, fileName, options, onProgress)` | 主流程入口 |
| `runLabelTasks(client:records:upTo:model:context:onItemDone:)` | `runLabelTasks(client, records, limit, ...)` | 并发 LLM 标注 |
| `fallbackSummary(_:)` | `fallbackSummary(records)` | noLLM 模式摘要 |
| `buildTaskResult(id:records:noLLM:executiveSummary:)` | `buildTaskResult(taskId, records, noLLM, executiveSummary)` | 构建结果对象 |
| `topicRows(_:)` | `topicRows(records)` | 议题聚合 |
| `trendRows(_:)` | `trendRows(records)` | 趋势聚合 |
| `platformCounts(_:)` | `platformCounts(records)` | 平台计数 |
| `buildTable(_:)` | `buildTable(records)` | 明细表构建 |
| `guideEntries()` | `guideEntries()` | 字段说明 |

**关键配置常量**：

| Swift | JS | 值 |
|-------|----|----|
| `labelConcurrency` | `DEFAULT_CONCURRENCY` | 5 |
| `maxLabelRecords` | `DEFAULT_MAX_LABEL` | 200 |
| `defaultTopics` | `DEFAULT_TOPICS` | 12 个议题 |

### 3. DeepSeekClient.swift → deepseek.js

**原文件**：`FeedbackPipeline/Core/DeepSeekClient.swift`
**新文件**：`cloudfunctions/analyzeFeedback/deepseek.js`

| Swift 函数 | JS 函数 | 说明 |
|-----------|---------|------|
| `label(text:model:context:topics:)` | `_label(apiKey, text, model, context, topics)` | 单条标注 |
| `summarize(records:model:context:)` | `_summarize(apiKey, records, model, context)` | 聚合摘要 |
| `chat(model:messages:systemPrompt:temperature:maxTokens:jsonMode:)` | `chat(apiKey, params, attempt)` | API 调用 |
| `decodeLabel(from:)` | `decodeLabel(rawContent)` | JSON 解码 |
| `normalizeAnnotation(_:rawPreview:)` | `normalizeAnnotation(raw)` | Schema 标准化 |
| `extractJSONObject(from:)` | `extractJSONObject(value)` | JSON 提取 |
| `stripCodeFence(_:)` | `stripCodeFence(value)` | Markdown 清理 |
| `labelPrompt(text:context:topics:)` | `labelPrompt(text, context, topics)` | 标注 Prompt |
| `digest(records:context:)` | `buildDigest(records, context)` | 摘要 Digest |
| `isRetryable(status:)` `isRetryable(url:)` | `isRetryableStatus(code)` `isRetryableNetwork(err)` | 重试判断 |
| `backoffNs(_:)` | `backoff(attempt)` | 指数退避 |
| `mapHTTPError(_:data:)` | `mapHTTPError(code, bodyText)` | HTTP 错误映射 |
| `normalizeMessagesForDeepSeek(_:systemPrompt:)` | — | JS 版直接使用 system role |
| `runSelfCheck()` | `selfCheck()` | 自检用例 |

**API 端点**：`https://api.deepseek.com/chat/completions` (不变)

### 4. Models.swift + LocalModels.swift → models.ts

**原文件**：`FeedbackPipeline/Core/Models.swift` + `LocalModels.swift`
**新文件**：`miniprogram/typings/models.ts` + `miniprogram/utils/models.ts`

| Swift 类型 | TypeScript 接口 | 说明 |
|-----------|----------------|------|
| `TaskResult` | `TaskResult` | 完整结果根结构 |
| `ResultMeta` | `ResultMeta` | 结果元数据 |
| `Overview` | `Overview` | KPI 概览 |
| `Topic` | `Topic` | 议题行 |
| `TrendPoint` | `TrendPoint` | 趋势点 |
| `Cluster` | `Cluster` | 问题簇 |
| `Competitors` | `Competitors` | 竞品对比 |
| `Summaries` | `Summaries` | 摘要文本集合 |
| `ResultTable` | `ResultTable` | 通用表格 |
| `AnyJSON` | `AnyJSON` | 任意 JSON 值 |
| `GuideEntry` | `GuideEntry` | 字段说明 |
| `HistoryItem` | `HistoryItem` | 历史条目 |
| `LocalFeedbackRecord` | `LocalFeedbackRecord` | 本地反馈记录 |
| `DeepSeekLabel` | `DeepSeekLabel` | LLM 标注结果 |
| `LocalInputFile` | `LocalFile` | 本地输入文件 |
| `ParsedDocument` | `ParsedDocument` | 解析后文档 |
| `ProcessingStage` enum | 进度回调 string | 处理阶段 |
| `LocalPipelineError` enum | `Error` messages | 错误信息 |

### 5. HomeView.swift → run 页面

**原文件**：`FeedbackPipeline/Features/Run/HomeView.swift`
**新文件**：`miniprogram/pages/run/run.ts` + `run.wxml` + `run.wxss`

| 功能 | Swift UI 组件 | 小程序实现 |
|------|-------------|-----------|
| 文件选择 | `.fileImporter` | `wx.chooseMessageFile` |
| 文件上传 | 本地读取 | `wx.cloud.uploadFile` |
| 文件列表 | `LocalFileRow` | WXML `file-row` 模板 |
| API Key | `SecureField` + Keychain | 云函数环境变量（不暴露给前端） |
| 模型选择 | `Picker(.segmented)` | WXML 自定义分段控件 |
| 仅清洗开关 | `Toggle` (CleaningModeRow) | `switch` 组件 |
| 分析主题 | `TextField` | `input` 组件 |
| 进度条 | `Capsule` + `GeometryReader` | CSS `progress-bar-fill` |
| 进度消息 | `ProgressPanel` | WXML 条件渲染 |
| 运行按钮 | `PrimaryButton` | `btn btn-primary` |

### 6. ResultView.swift → result 页面

**原文件**：`FeedbackPipeline/Features/Result/ResultView.swift`
**新文件**：`miniprogram/pages/result/result.ts` + `result.wxml` + `result.wxss`

| 功能 | Swift UI 实现 | 小程序实现 |
|------|-------------|-----------|
| KPI 网格 | `LazyVGrid` + `KPICard` | CSS Grid `kpi-grid` |
| 议题分布 | `Charts` BarMark | WXML 自定义条形图 |
| 情感分布 | `Charts` BarMark | WXML 自定义条形图 |
| 趋势图 | `Charts` AreaMark + LineMark | WXML 自定义趋势列表 |
| 决策摘要 | `Panel` + Text | WXML `summary-text` |
| 样本卡片 | `sampleCard` expandable | WXML `sample-card` 展开/收起 |
| 筛选 | `filterMenu` (Menu + Picker) | `picker` 组件 |
| 明细表 | `ScrollView(.horizontal)` + table | `scroll-view` 横向滚动 |
| 导出 CSV | `DataExporter` + ShareSheet | `fs.writeFile` + `shareFileMessage` |

### 7. HistoryListView.swift → history 页面

**原文件**：`FeedbackPipeline/Features/History/HistoryListView.swift`
**新文件**：`miniprogram/pages/history/history.ts` + `history.wxml` + `history.wxss`

| 功能 | Swift 实现 | 小程序实现 |
|------|-----------|-----------|
| 列表展示 | `List` + Sections | WXML flat list |
| 状态分段 | running / completed / failed 三段 | 统一列表（按时间排序） |
| 删除 | swipeActions | 长按 + Modal 确认 |
| 清空 | Menu + Alert | `wx.showModal` |
| 持久化 | `LocalHistoryStore` (JSON 文件) | `wx.setStorageSync` |

### 8. SettingsView.swift → settings 页面

**原文件**：`FeedbackPipeline/Features/Settings/SettingsView.swift`
**新文件**：`miniprogram/pages/settings/settings.ts` + `settings.wxml` + `settings.wxss`

| 功能 | Swift 实现 | 小程序实现 |
|------|-----------|-----------|
| 模型选择 | NavigationLink → AnalysisSettingsView | 分段控件 |
| LLM 开关 | 二级页面 | 直接开关 |
| API Key 配置 | Keychain 保存/清除 | 云函数环境变量说明 |
| 通知设置 | NotificationSettingsView | 暂未实现 |
| 外观设置 | AppearanceSettingsView | 暂未实现 |

## 架构变化

### 前端

| 原 iOS | 小程序 |
|--------|--------|
| SwiftUI `@Observable` (AppState) | Page `data` + `setData` |
| `NavigationStack` + Route enum | `wx.navigateTo` / tabBar |
| `Task { await }` async/await | Promise + async/await (ES2017+) |
| `URLSession` 直连 DeepSeek | 通过云函数代理 |
| `@MainActor` | 小程序单线程模型 |
| `withThrowingTaskGroup` | Promise.all |
| Actor (`DeepSeekClient`) | 普通 JS 函数（云函数隔离） |
| Keychain | 云函数环境变量 |

### 后端（新增）

| 原 iOS | 小程序后端 |
|--------|-----------|
| 无后端（纯本地处理） | 云函数 + 云数据库 |
| 文件通过本地 file picker | 文件通过云存储上传下载 |
| 结果存本地 JSON 文件 | 结果存云数据库 + 本地缓存 |
| 无用户隔离 | 按 openid 隔离 |

## 未迁移的功能（后续增强）

| 原功能 | 原因 | 优先级 |
|--------|------|--------|
| PDF 解析 (PDFKit) | 云函数无 PDFKit，需 pdf-parse | Phase 2 |
| XLSX 解析 | 云函数可加载 xlsx 库 | Phase 2 |
| Live Activity / 灵动岛 | 小程序无对应能力 | 不迁移 |
| 本地通知 | 可用订阅消息替代 | Phase 2 |
| 多文件同时上传 | 当前 MVP 支持单个文件 | Phase 2 |
| 竞品热力图 | Charts framework | Phase 2 |
| 问题簇聚类 | 算法迁移较复杂 | Phase 2 |
| 外观切换 (浅/深色) | 需独立适配小程序 darkmode | 可选 |
| Widget Extension | 不适用 | 不迁移 |
