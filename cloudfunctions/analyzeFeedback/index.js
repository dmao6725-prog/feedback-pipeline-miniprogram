// ============================================================
// analyzeFeedback 云函数入口
// ============================================================

const cloud = require('wx-server-sdk');
const pipeline = require('./pipeline');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

/**
 * 云函数主入口
 * event.fileID: 云存储文件 ID（必填）
 * event.model: DeepSeek 模型名（默认 deepseek-v4-flash）
 * event.context: 分析主题/场景
 * event.noLLM: 是否仅清洗统计
 * event.topics: 自定义议题列表
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

  // 1. 参数校验
  if (!fileID) {
    return errorResponse('缺少参数 fileID');
  }

  // 2. 创建任务记录
  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.collection('analysis_tasks').add({
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
      result: null,
    },
  });

  try {
    // 3. 下载云存储文件
    await updateStatus(taskId, 'parsing', 0, '正在下载文件...');
    const downloadResult = await cloud.downloadFile({ fileID });
    const fileBuffer = downloadResult.fileContent;

    const fileName = (() => {
      // 尝试从 fileID 中提取文件名
      const parts = fileID.split('/');
      const last = parts[parts.length - 1];
      return last || 'unknown.txt';
    })();

    // 4. 解析 API Key（从云环境变量读取，优先级：环境变量 > 云数据库配置）
    let apiKey = process.env.DEEPSEEK_API_KEY || '';
    if (!apiKey && !noLLM) {
      // fallback: 从云数据库 settings 读取
      try {
        const settingsRes = await db.collection('settings').doc('deepseek_config').get();
        if (settingsRes.data && settingsRes.data.apiKey) {
          apiKey = settingsRes.data.apiKey;
        }
      } catch (e) {
        // settings 不存在时忽略
      }
    }

    if (!noLLM && !apiKey) {
      await updateStatus(taskId, 'failed', 0, '未配置 DeepSeek API Key，请在云环境变量或云数据库设置中配置。');
      return errorResponse('未配置 DeepSeek API Key');
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
        maxLabelRecords,
        labelConcurrency,
      },
      (stage, fraction) => {
        // 每 5% 或关键阶段更新进度
        if (fraction > lastReportedFraction + 0.05 || stage === 'completed') {
          lastReportedFraction = fraction;
          updateStatus(taskId, stageToStatus(stage), fraction, stage).catch(() => {});
        }
      }
    );

    // 6. 保存结果到数据库
    let lastReportedFraction = 0;
    await db.collection('analysis_tasks').doc(taskId).update({
      data: {
        status: 'completed',
        updatedAt: db.serverDate(),
        progress: { label_done: result.meta.total, label_total: result.meta.total, last_message: '处理完成' },
        result,
        resultSummary: {
          total: result.meta.total,
          llm_enabled: !noLLM,
          platforms: result.meta.platforms,
          negative_rate: result.overview.negative_rate,
          high_severity_rate: result.overview.high_severity_rate,
        },
      },
    });

    return successResponse({ taskId, meta: result.meta });
  } catch (err) {
    console.error('[analyzeFeedback] Error:', err);
    await db.collection('analysis_tasks').doc(taskId).update({
      data: {
        status: 'failed',
        updatedAt: db.serverDate(),
        progress: { label_done: 0, label_total: 0, last_message: '处理失败' },
        error: err.message || '未知错误',
      },
    });
    return errorResponse(err.message || '处理失败');
  }
};

// ---- 辅助函数 ----
function stageToStatus(stage) {
  switch (stage) {
    case 'readingFile': return 'parsing';
    case 'extractingText': return 'cleaning';
    case 'chunkingText': return 'cleaning';
    case 'callingDeepSeek': return 'analyzing';
    case 'mergingResult': return 'summarizing';
    case 'completed': return 'completed';
    default: return 'parsing';
  }
}

async function updateStatus(taskId, status, progress, message) {
  try {
    await db.collection('analysis_tasks').doc(taskId).update({
      data: {
        status,
        updatedAt: db.serverDate(),
        progress: { label_done: Math.round(progress * 100), label_total: 100, last_message: message },
      },
    });
  } catch (e) {
    // 非关键错误，忽略
  }
}

function successResponse(data) {
  return { code: 0, message: 'success', data };
}

function errorResponse(message) {
  return { code: -1, message, data: null };
}
