// analyzeFeedback 云函数入口
// 文件下载 → 解析 → LLM 标注 → 聚合 → 保存云数据库

const cloud = require('wx-server-sdk');
const pipeline = require('./pipeline');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

/**
 * event.fileID:        云存储文件 ID（必填）
 * event.model:         DeepSeek 模型名（默认 deepseek-v4-flash）
 * event.analysisContext: 分析主题/场景
 * event.noLLM:         是否仅清洗统计
 * event.topics:        自定义议题列表
 * event.maxLabelRecords: LLM 标注上限（默认 200）
 * event.labelConcurrency: LLM 并发（默认 5）
 */
exports.main = async (event, context) => {
  const {
    fileID,
    model = 'deepseek-v4-flash',
    analysisContext = '',
    noLLM = false,
    topics = undefined,
    maxLabelRecords = 200,
    labelConcurrency = 5,
  } = event;

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || 'anonymous';
  const taskCollection = db.collection('analysis_tasks');

  // 1. 参数校验
  if (!fileID) {
    return errorResponse('缺少参数 fileID');
  }

  await ensureCollection('analysis_tasks');

  // 2. 创建任务记录
  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await taskCollection.add({
    data: {
      _id: taskId,
      openid,
      status: 'parsing',
      fileID,
      model,
      noLLM,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      progress: { label_done: 0, label_total: 0, last_message: '开始解析...' },
      error: '',
      result: {},
    },
  });

  // 进度上报阈值跟踪（需要在此作用域声明）
  let lastReportedFraction = 0;

  try {
    // 3. 下载云存储文件
    await updateStatus(taskId, 'parsing', 0, '正在下载文件...');
    const downloadResult = await cloud.downloadFile({ fileID });
    const fileBuffer = downloadResult.fileContent;

    if (!fileBuffer || (Buffer.isBuffer(fileBuffer) && fileBuffer.length === 0)) {
      throw new Error('下载的文件为空');
    }

    const fileName = (() => {
      const parts = fileID.split('/');
      const last = parts[parts.length - 1];
      return last || 'unknown.txt';
    })();

    // 4. 解析 API Key
    let apiKey = '';
    if (!noLLM) {
      apiKey = process.env.DEEPSEEK_API_KEY || '';

      // fallback: 从云数据库 settings 读取
      if (!apiKey) {
        try {
          const settingsRes = await db.collection('settings')
            .doc('deepseek_config')
            .get()
            .catch(() => null);
          if (settingsRes?.data?.apiKey) {
            apiKey = settingsRes.data.apiKey;
          }
        } catch (_) { /* settings 不存在时忽略 */ }
      }

      if (!apiKey) {
        await updateStatus(taskId, 'failed', 0, '未配置 DeepSeek API Key');
        return errorResponse(
          '未配置 DeepSeek API Key。请在云函数环境变量中设置 DEEPSEEK_API_KEY，或在云数据库 settings 集合中添加记录。'
        );
      }
    }

    // 5. 执行分析流水线
    const result = await pipeline.process(
      fileBuffer,
      fileName,
      {
        apiKey,
        model,
        context: analysisContext,
        noLLM,
        topics,
        maxLabelRecords: Math.min(Math.max(maxLabelRecords, 10), 500),
        labelConcurrency: Math.min(Math.max(labelConcurrency, 1), 10),
      },
      (stage, fraction) => {
        if (fraction > lastReportedFraction + 0.05 || stage === 'completed') {
          lastReportedFraction = fraction;
          updateStatus(taskId, stageToStatus(stage), fraction, stage).catch(() => {});
        }
      }
    );

    // 6. 保存结果
    await taskCollection.doc(taskId).update({
      data: {
        status: 'completed',
        updatedAt: db.serverDate(),
        progress: {
          label_done: result.meta.total,
          label_total: result.meta.total,
          last_message: '处理完成',
        },
        result,
        resultSummary: {
          total: result.meta.total,
          llm_enabled: !noLLM,
          platforms: result.meta.platforms || [],
          negative_rate: result.overview.negative_rate,
          high_severity_rate: result.overview.high_severity_rate,
        },
      },
    });

    return successResponse({ taskId, meta: result.meta });
  } catch (err) {
    console.error('[analyzeFeedback] Error:', err);

    await taskCollection.doc(taskId).update({
      data: {
        status: 'failed',
        updatedAt: db.serverDate(),
        progress: { label_done: 0, label_total: 0, last_message: '处理失败' },
        error: err.message || '未知错误',
      },
    }).catch(() => {});

    return errorResponse(err.message || '处理失败');
  }
};

// ---- 辅助函数 ----

function stageToStatus(stage) {
  switch (stage) {
    case 'readingFile':    return 'parsing';
    case 'extractingText': return 'cleaning';
    case 'chunkingText':   return 'cleaning';
    case 'callingDeepSeek': return 'analyzing';
    case 'mergingResult':  return 'summarizing';
    case 'completed':      return 'completed';
    default:               return 'parsing';
  }
}

async function updateStatus(taskId, status, fraction, message) {
  try {
    await db.collection('analysis_tasks').doc(taskId).update({
      data: {
        status,
        updatedAt: db.serverDate(),
        progress: {
          label_done: Math.round(fraction * 100),
          label_total: 100,
          last_message: message || status,
        },
      },
    });
  } catch (_) { /* 非致命错误，忽略 */ }
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (err) {
    const message = err && (err.message || err.errMsg || String(err));
    if (!message || !/exist|already|duplicate|collection|集合|已存在/i.test(message)) {
      throw err;
    }
  }
}

function successResponse(data) {
  return { code: 0, message: 'success', data };
}

function errorResponse(message) {
  return { code: -1, message, data: null };
}
