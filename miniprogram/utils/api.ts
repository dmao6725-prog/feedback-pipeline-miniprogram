// ============================================================
// api.ts — 微信小程序通用 API 封装
// ============================================================

function getErrorMessage(err: any): string {
  if (!err) return '';
  if (err.message) return err.message;
  if (err.errMsg) return err.errMsg;
  return String(err);
}

function getAppSafe(): any {
  try {
    return getApp();
  } catch {
    return null;
  }
}

export function ensureCloudReady(): void {
  if (!wx.cloud) {
    throw new Error('当前微信版本不支持云开发，请升级微信或基础库');
  }

  const app = getAppSafe();
  if (!app || !app.globalData || !app.globalData.cloudReady) {
    throw new Error('云环境未配置。请先在 miniprogram/app.js 中设置真实 CLOUD_ENV_ID，并部署云函数');
  }
}

function createCloudError(name: string, err: any): Error {
  const message = getErrorMessage(err);
  if (message) return new Error(`云函数 ${name} 调用失败：${message}`);
  return new Error(`云函数 ${name} 调用失败，请检查云函数是否已部署、云环境 ID 是否正确`);
}

export function callFunctionWithTimeout(
  name: string,
  data: Record<string, any> = {},
  timeoutMs = 60000
): Promise<any> {
  ensureCloudReady();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler: (value: any) => void, value: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error(`云函数 ${name} 调用超时，请检查云环境 ID、云函数部署状态和网络`));
    }, timeoutMs);

    wx.cloud.callFunction({
      name,
      data,
      success: (res: any) => finish(resolve, res.result),
      fail: (err: any) => finish(reject, createCloudError(name, err)),
    });
  });
}

/**
 * 调用云函数（带超时保护）
 */
export async function callCloudFunction(
  name: string,
  data: Record<string, any> = {},
  timeoutMs = 60000
): Promise<any> {
  return callFunctionWithTimeout(name, data, timeoutMs);
}

/**
 * 上传文件到云存储
 */
export function uploadFile(filePath: string, cloudPath: string, timeoutMs = 60000): Promise<string> {
  ensureCloudReady();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler: (value: any) => void, value: any) => {
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
      success: (res) => {
        clearTimeout(timer);
        finish(resolve, res.fileID);
      },
      fail: (err: any) => {
        finish(reject, createCloudError('uploadFile', err));
      },
    });
  });
}

/**
 * 获取临时下载链接
 */
export function getTempFileURL(fileID: string): Promise<string> {
  ensureCloudReady();
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
export async function submitAnalysis(params: {
  fileID: string;
  model?: string;
  analysisContext?: string;
  noLLM?: boolean;
  topics?: string[];
  maxLabelRecords?: number;
  labelConcurrency?: number;
}): Promise<{ taskId: string; meta: any }> {
  const result = await callCloudFunction('analyzeFeedback', params);
  if (!result || result.code !== 0) {
    throw new Error((result && result.message) || '分析任务提交失败');
  }
  return result.data;
}

/**
 * 获取任务结果
 */
export async function getTaskResult(taskId: string): Promise<{
  taskId: string;
  status: string;
  progress: any;
  error: string;
  result: any;
  resultSummary: any;
  meta: any;
}> {
  const result = await callCloudFunction('getTaskResult', { taskId });
  if (!result || result.code !== 0) {
    throw new Error((result && result.message) || '获取任务结果失败');
  }
  return result.data;
}

/**
 * 轮询任务直到完成
 * @param taskId 任务 ID
 * @param onStatus 状态回调
 * @param intervalMs 轮询间隔
 * @param maxAttempts 最大轮询次数
 */
export function pollTaskResult(
  taskId: string,
  onStatus: (status: any) => void,
  intervalMs = 2000,
  maxAttempts = 300
): Promise<any> {
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
