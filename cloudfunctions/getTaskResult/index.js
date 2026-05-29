// ============================================================
// getTaskResult 云函数 — 获取任务状态和结果
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 获取单个任务结果
 * event.taskId: 任务 ID
 */
exports.main = async (event, context) => {
  const { taskId } = event;
  if (!taskId) return { code: -1, message: '缺少 taskId', data: null };

  try {
    const res = await db.collection('analysis_tasks').doc(taskId).get();
    if (!res.data) {
      return { code: -1, message: '任务不存在', data: null };
    }

    return {
      code: 0,
      message: 'success',
      data: {
        taskId: res.data._id,
        status: res.data.status,
        progress: res.data.progress,
        error: res.data.error,
        result: res.data.result || null,
        resultSummary: res.data.resultSummary || null,
        meta: res.data.result ? res.data.result.meta : null,
        createdAt: res.data.createdAt,
      },
    };
  } catch (err) {
    return { code: -1, message: err.message, data: null };
  }
};
