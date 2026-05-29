# 可运行性验证指南

在微信开发者工具中按以下步骤逐步验证项目可正常编译运行。

## 本次启动修复记录

- 原因：微信开发者工具按 `miniprogram/app.json` 查找页面运行文件时，需要 `pages/run/run.js`，但项目只有 `.ts` 源文件。
- 修复：保留现有 `.ts` 源文件，同时为 `app`、页面、组件和 `utils` 补齐同名 `.js` 运行文件。
- 验证：`miniprogram/pages/run/run.js`、`result.js`、`history.js`、`settings.js` 已生成，组件 `.json` 均包含 `"component": true`。

## 前置条件

- 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（macOS/Windows 均可）
- 注册微信小程序 AppID（或使用测试号）
- 开通云开发环境（用于云函数部署）

## 第一步：导入项目

1. 打开微信开发者工具，点击 **「+」导入项目**
2. 目录选择：`feedback-pipeline-miniprogram/`（包含 `project.config.json` 的目录）
3. AppID：填写你的小程序 AppID（或选择「测试号」）
4. 点击「导入」

**验证点**：
- [ ] 项目导入成功，无弹窗报错
- [ ] 左侧文件树正常显示所有文件
- [ ] 模拟器可以看到小程序界面

## 第二步：检查编译

1. 点击工具栏 **「编译」** 按钮
2. 观察下方控制台输出

**验证点**：
- [ ] 编译成功，无红色报错
- [ ] 控制台无 `Component is not found` 错误
- [ ] 控制台无 `Page is not found` 错误
- [ ] tabBar 底部显示三个标签：分析 / 历史 / 设置
- [ ] tabBar 标签可正常切换

## 第三步：配置云开发

1. 点击工具栏 **「云开发」** 图标
2. 开通云开发（如未开通），选择基础版
3. 记下 **环境 ID**（格式如 `cloud1-xxxxx`）
4. 在项目中修改 `miniprogram/app.js` 第 3 行：
   ```javascript
   const CLOUD_ENV_ID = 'your-env-id'; // 替换为真实环境 ID
   ```
5. 重新编译

**验证点**：
- [ ] 控制台无云开发初始化报错
- [ ] `globalData.cloudReady` 应为 `true`

## 第四步：部署云函数

1. 在左侧文件树找到 `cloudfunctions/` 目录
2. 右键 `analyzeFeedback` → **「上传并部署：云端安装依赖」**
3. 右键 `getTaskResult` → **「上传并部署：云端安装依赖」**

**验证点**：
- [ ] 两个云函数部署成功
- [ ] 在云开发控制台「云函数」中可以看到它们

## 第五步：测试 noLLM 模式

> 此模式不需要 DeepSeek API Key，适合快速验证流水线是否通畅。

1. 在小程序页面中，点击 **「仅清洗 / 启发式统计」** 开关（打开）
2. 点击文件选择区域
3. 选择 `test-fixtures/sample_feedback.csv`

> 注意：微信开发者工具模拟器中，`wx.chooseMessageFile` 需要在 **真机** 或 **模拟器聊天会话** 中选择文件。模拟器中可先进入「发现→小程序→选择聊天文件」触发。

**替代方案**：在云开发控制台手动上传测试文件到云存储，然后在云函数中直接测试：

1. 云开发控制台 → 云存储 → 上传 `test-fixtures/sample_feedback.json`
2. 复制 `fileID`（格式如 `cloud://xxx.xxx/sample_feedback.json`）
3. 云开发控制台 → 云函数 → `analyzeFeedback` → 测试
4. 传入参数：
   ```json
   {
     "fileID": "cloud://xxx.xxx/sample_feedback.json",
     "noLLM": true
   }
   ```

**验证点**：
- [ ] 云函数返回 `code: 0`
- [ ] `data.meta.total` > 0
- [ ] `data.meta.no_llm` 为 `true`
- [ ] 结果中包含议题分布和表格数据
- [ ] `data.result.overview.total` 显示正确的样本数

## 第六步：测试 CSV / JSON / JSONL / TXT 解析

在云函数测试面板中分别测试四种格式：

### CSV
```json
{ "fileID": "cloud://xxx/sample_feedback.csv", "noLLM": true }
```
**验证点**：
- [ ] 正确识别表头（title, content, rating, date, platform, engagement）
- [ ] 记录数 = 10

### JSON
```json
{ "fileID": "cloud://xxx/sample_feedback.json", "noLLM": true }
```
**验证点**：
- [ ] 正确解析 JSON 数组
- [ ] 字段扁平化正确（content → reviewtext 映射）

### JSONL
```json
{ "fileID": "cloud://xxx/sample_feedback.jsonl", "noLLM": true }
```
**验证点**：
- [ ] 逐行解析 JSON
- [ ] reviewtext 字段被正确识别为正文

### TXT
上传一个纯文本文件，参数同上。
**验证点**：
- [ ] 按段落自动分段
- [ ] 每段不超过 2400 字符

## 第七步：配置 DeepSeek API Key（可选）

> 仅在需要测试 LLM 标注模式时执行。

1. 云开发控制台 → 云函数 → `analyzeFeedback` → 环境变量
2. 添加：`DEEPSEEK_API_KEY` = `sk-xxxxxxxxxxxxxxxx`
3. 重新部署云函数

**验证点**：
- [ ] 使用 `noLLM: false` 参数调用云函数
- [ ] 返回结果中 `meta.llm_enabled` 为 `true`
- [ ] 表格中 `情感倾向`、`严重程度`、`用户意图` 等字段有值
- [ ] 有 `executive_summary` 决策摘要

## 第八步：查看结果页

1. 在云函数测试中获取返回的 `taskId`
2. 调用 `getTaskResult` 云函数：
   ```json
   { "taskId": "task_xxxxx" }
   ```
3. 确认返回完整结果

**验证点**：
- [ ] `code: 0`
- [ ] `data.status` 为 `completed`
- [ ] `data.result` 包含完整 TaskResult 对象

## 第九步：GitHub 确认

```bash
cd /Users/danmao/feedback-pipeline-miniprogram
git log --oneline -5
git remote -v
```

## 已知限制

- `wx.chooseMessageFile` 在模拟器中需要进入聊天会话才能触发，真机无此限制
- XLSX 和 PDF 格式暂不支持，选择后会提示「暂不支持」
- tabBar 使用纯文字，无图标
- 云函数环境 `your-env-id` 和 AppID `wx_your_appid_here` 是占位符，需替换

## 测试文件说明

| 文件 | 格式 | 记录数 | 字段 |
|------|------|--------|------|
| `test-fixtures/sample_feedback.csv` | CSV | 10 | title, content, rating, date, platform, engagement |
| `test-fixtures/sample_feedback.json` | JSON | 10 | title, content, rating, date, platform, engagement |
| `test-fixtures/sample_feedback.jsonl` | JSONL | 10 | reviewtext, rating, date, platform, likes |
