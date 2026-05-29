# 反馈分析 · 微信小程序

从 iOS SwiftUI 项目 [FeedbackPipeline](https://github.com/dmao6725-prog/feedback-pipeline-ios) 迁移的微信小程序版本。

导入 TXT、CSV、JSON 等格式的反馈数据，通过 DeepSeek 大模型自动对每条反馈进行结构化标注（情感、议题、严重程度、用户意图、可落地性），聚合生成分析看板。

## 功能特性

- **多格式文件导入**：支持 TXT、MD、CSV、TSV、JSON、JSONL、XML、HTML
- **DeepSeek AI 标注**：调用 DeepSeek Chat Completions API，并发 5 路、最多标注 200 段
- **仅清洗模式**：不调用 LLM，仅做文本解析、清洗、去重、启发式统计
- **分析看板**：总览 KPI（样本数、负面率、严重度）、议题分布、情感分布、月度趋势、明细表
- **历史记录**：本地 storage 保存任务历史，支持删除和清空
- **数据安全**：API Key 存储在云函数环境变量中，不暴露给前端

## 项目结构

```
feedback-pipeline-miniprogram/
├── miniprogram/                  # 小程序前端
│   ├── app.ts/json/wxss          # App 入口
│   ├── pages/
│   │   ├── run/                  # 分析页：文件选择、参数配置、启动分析
│   │   ├── result/               # 结果页：KPI、议题、情感、趋势、样本、导出
│   │   ├── history/              # 历史页：本地任务历史列表
│   │   └── settings/             # 设置页：模型、LLM开关、API Key 配置说明
│   ├── components/
│   │   ├── kpi-card/             # KPI 指标卡片
│   │   ├── file-uploader/        # 文件上传区域
│   │   ├── progress-panel/       # 进度展示面板
│   │   ├── topic-chart/          # 议题分布条形图
│   │   ├── detail-table/         # 横向滚动的明细表格
│   │   └── filter-bar/           # 样本筛选条件栏
│   ├── utils/
│   │   ├── api.ts                # 云函数调用 + 文件上传封装
│   │   ├── models.ts             # 前端数据模型
│   │   ├── format.ts             # 格式化工具函数
│   │   └── storage.ts            # 本地 storage 工具
│   └── typings/
│       └── models.ts             # 完整 TypeScript 接口定义
├── cloudfunctions/
│   ├── analyzeFeedback/          # 主云函数：解析 + LLM标注 + 聚合
│   │   ├── index.js              # 入口
│   │   ├── parser.js             # 文件解析器（CSV/TSV/JSON/JSONL/XML等）
│   │   ├── pipeline.js           # 处理流水线
│   │   ├── deepseek.js           # DeepSeek API 客户端
│   │   ├── aggregator.js         # noLLM 纯统计聚合
│   │   └── package.json
│   └── getTaskResult/            # 查询任务结果
│       ├── index.js
│       └── package.json
├── project.config.json
├── README.md
└── MIGRATION_PLAN.md
```

## 快速开始

### 1. 导入微信开发者工具

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开工具，选择「导入项目」
3. 目录选择 `feedback-pipeline-miniprogram/`
4. AppID 填写你的小程序 AppID（或选择「测试号」）
5. 点击「确定」

### 2. 开通云开发

1. 在微信开发者工具中点击「云开发」图标
2. 开通云开发（选择基础版即可）
3. 创建环境，记下**环境 ID**
4. 将 `miniprogram/app.ts` 中的 `env: 'your-env-id'` 替换为实际环境 ID

### 3. 部署云函数

1. 在微信开发者工具左侧文件树中找到 `cloudfunctions/` 目录
2. 右键 `analyzeFeedback` →「上传并部署：云端安装依赖」
3. 右键 `getTaskResult` →「上传并部署：云端安装依赖」

### 4. 配置 DeepSeek API Key

**方式一：云函数环境变量（推荐）**

1. 在微信开发者工具的「云开发」控制台中
2. 选择「云函数」→ `analyzeFeedback` →「环境变量」
3. 添加变量：`DEEPSEEK_API_KEY` = `sk-xxxxxxxxxxxxx`
4. 保存后重新部署云函数

**方式二：云数据库配置**

1. 在云开发控制台创建 `settings` 集合
2. 添加记录，`_id` 设为 `deepseek_config`，`apiKey` 设为你的 Key
3. 云函数会自动从数据库读取作为 fallback

### 5. 运行

1. 点击工具顶部的「编译」按钮
2. 在模拟器中点击「选择文件」上传反馈数据
3. 配置分析参数（可选）
4. 点击「运行分析」
5. 等待云函数处理后自动跳转结果页

## 支持的输入格式

| 格式 | 说明 |
|------|------|
| TXT | 纯文本，按段落自动分段 |
| MD / Markdown | 自动去除链接和图片语法 |
| CSV | 逗号分隔，自动识别表头和字段 |
| TSV | Tab 分隔 |
| JSON | 自动提取数组/嵌套对象，扁平化字段 |
| JSONL / NDJSON | 每行一个 JSON 对象 |
| XML / HTML | 自动去标签，保留文本内容 |

## 字段识别

云函数会自动从原始数据中识别以下字段：

- **文本字段**：reviewtext, review, text, content, body, selftext, comment, message, value
- **标题字段**：title, reviewtitle, subject
- **平台字段**：自动检测 Reddit（subreddit）、App Store（bundleid）、Google Play（packagename）
- **日期字段**：createdat, created, date, updated, postedat, reviewdate
- **评分字段**：rating, score, stars, starrating
- **互动字段**：engagement, upvotes, likes, numcomments

## 数据模型

与 iOS 原版保持一致的核心数据模型：

- `TaskResult` — 分析结果根结构
- `Overview` — KPI 数据（样本数、负面率、严重度等）
- `Topic` — 议题分布
- `TrendPoint` — 月度趋势
- `ResultTable` — 明细表格
- `DeepSeekLabel` — LLM 标注结果

## 局限性

- 微信小程序 `chooseMessageFile` 单次最多选择文件大小受限制（约 10MB）
- 云函数单次执行超时时间 60s，大文件建议分批处理
- 当前 MVP 不支持 PDF 和 XLSX 解析（后续增强）
- 历史记录使用本地 storage，卸载小程序会丢失
- 仅支持单个 DeepSeek API 提供商

## 许可证

MIT
