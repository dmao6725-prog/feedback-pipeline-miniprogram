// ============================================================
// api.js - 微信小程序通用 API 封装
// ============================================================

/**
 * 调用云函数（带超时和重试）
 */
function callCloudFunction(name, data = {}, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('云函数调用超时')), timeoutMs);
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => {
        clearTimeout(timer);
        resolve(res.result);
      },
      fail: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });
  });
}

/**
 * 上传文件到云存储
 */
function uploadFile(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => resolve(res.fileID),
      fail: reject,
    });
  });
}

/**
 * 获取临时下载链接
 */
function getTempFileURL(fileID) {
  return new Promise((resolve, reject) => {
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (res) => resolve(res.fileList[0].tempFileURL),
      fail: reject,
    });
  });
}

/**
 * 提交分析任务
 */
async function submitAnalysis(params) {
  const result = await callCloudFunction('analyzeFeedback', params);
  if (result.code !== 0) {
    throw new Error(result.message || '分析任务提交失败');
  }
  return result.data;
}

/**
 * 获取任务结果
 */
async function getTaskResult(taskId) {
  const result = await callCloudFunction('getTaskResult', { taskId });
  if (result.code !== 0) {
    throw new Error(result.message || '获取任务结果失败');
  }
  return result.data;
}

/**
 * 轮询任务直到完成
 */
function pollTaskResult(taskId, onStatus, intervalMs = 2000, maxAttempts = 300) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const status = await getTaskResult(taskId);
        onStatus(status);

        if (status.status === 'completed') {
          resolve(status);
        } else if (status.status === 'failed') {
          reject(new Error(status.error || '任务处理失败'));
        } else if (attempts >= maxAttempts) {
          reject(new Error('任务超时，请刷新后重试'));
        } else {
          setTimeout(poll, intervalMs);
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          reject(err);
        } else {
          setTimeout(poll, intervalMs);
        }
      }
    };
    poll();
  });
}

module.exports = {
  callCloudFunction,
  uploadFile,
  getTempFileURL,
  submitAnalysis,
  getTaskResult,
  pollTaskResult,
};
