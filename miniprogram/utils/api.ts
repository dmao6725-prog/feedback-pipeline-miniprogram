// ============================================================
// api.ts — 微信小程序通用 API 封装
// ============================================================

const CLOUD_FUNC_PREFIX = 'cloudfunctions';

/**
 * 调用云函数（带超时和重试）
 */
export async function callCloudFunction(
  name: string,
  data: Record<string, any> = {},
  timeoutMs = 120000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('云函数调用超时')), timeoutMs);
    wx.cloud.callFunction({
      name,
      data,
      success: (res: any) => {
        clearTimeout(timer);
        resolve(res.result);
      },
      fail: (err: any) => {
        clearTimeout(timer);
        reject(err);
      },
    });
  });
}

/**
 * 上传文件到云存储
 */
export function uploadFile(filePath: string, cloudPath: string): Promise<string> {
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
export function getTempFileURL(fileID: string): Promise<string> {
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
  if (result.code !== 0) {
    throw new Error(result.message || '分析任务提交失败');
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
  if (result.code !== 0) {
    throw new Error(result.message || '获取任务结果失败');
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
