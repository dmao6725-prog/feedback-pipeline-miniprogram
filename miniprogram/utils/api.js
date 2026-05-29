// ============================================================
// api.js - 微信小程序通用 API 封装
// ============================================================

function getErrorMessage(err) {
  if (!err) return '';
  if (err.message) return err.message;
  if (err.errMsg) return err.errMsg;
  return String(err);
}

function createCloudUnavailableError() {
  return new Error('云环境未配置。请先在 miniprogram/app.js 中设置真实 CLOUD_ENV_ID，并部署云函数');
}

function createCloudError(name, err) {
  const message = getErrorMessage(err);
  if (message) return new Error(`云函数 ${name} 调用失败：${message}`);
  return new Error(`云函数 ${name} 调用失败，请检查云函数是否已部署、云环境 ID 是否正确`);
}

function getAppSafe() {
  try {
    return getApp();
  } catch (err) {
    return null;
  }
}

function ensureCloudReady() {
  if (!wx.cloud) {
    throw new Error('当前微信版本不支持云开发，请升级微信或基础库');
  }

  const app = getAppSafe();
  if (!app || !app.globalData || !app.globalData.cloudReady) {
    throw createCloudUnavailableError();
  }
}

function callFunctionWithTimeout(name, data = {}, timeoutMs = 60000) {
  ensureCloudReady();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error(`云函数 ${name} 调用超时，请检查云函数是否已部署、云环境 ID 是否正确`));
    }, timeoutMs);

    wx.cloud.callFunction({
      name,
      data,
      success: (res) => {
        finish(resolve, res.result);
      },
      fail: (err) => {
        finish(reject, createCloudError(name, err));
      },
    });
  });
}

/**
 * 调用云函数（带超时保护）
 */
function callCloudFunction(name, data = {}, timeoutMs = 60000) {
  return callFunctionWithTimeout(name, data, timeoutMs);
}

/**
 * 上传文件到云存储
 */
function uploadFile(filePath, cloudPath, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    try {
      ensureCloudReady();
    } catch (err) {
      reject(err);
      return;
    }

    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error('文件上传超时，请检查云环境 ID 是否正确、云存储是否可用'));
    }, timeoutMs);

    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => finish(resolve, res.fileID),
      fail: (err) => finish(reject, createCloudError('uploadFile', err)),
    });
  });
}

/**
 * 获取临时下载链接
 */
function getTempFileURL(fileID) {
  return new Promise((resolve, reject) => {
    try {
      ensureCloudReady();
    } catch (err) {
      reject(err);
      return;
    }

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
  if (!result || result.code !== 0) {
    throw new Error((result && result.message) || '分析任务提交失败');
  }
  return result.data;
}

/**
 * 获取任务结果
 */
async function getTaskResult(taskId) {
  const result = await callCloudFunction('getTaskResult', { taskId });
  if (!result || result.code !== 0) {
    throw new Error((result && result.message) || '获取任务结果失败');
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
  ensureCloudReady,
  callFunctionWithTimeout,
  callCloudFunction,
  uploadFile,
  getTempFileURL,
  submitAnalysis,
  getTaskResult,
  pollTaskResult,
};
