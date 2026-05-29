// app.ts — 反馈分析小程序入口

const CLOUD_ENV_ID = 'cloud1-d4gx7r9psc7c29864';

function isCloudConfigured(): boolean {
  return !!CLOUD_ENV_ID && CLOUD_ENV_ID !== 'your-env-id';
}

App<IAppOption>({
  globalData: {
    userInfo: null,
    openid: '',
    cloudReady: false,
    cloudEnvId: CLOUD_ENV_ID,
  },

  onLaunch() {
    this.initCloud();
  },

  initCloud() {
    if (!wx.cloud) {
      console.warn('[App] 当前微信版本不支持云开发');
      return;
    }

    if (!isCloudConfigured()) {
      console.warn('[App] 请在 miniprogram/app.js 中配置真实云环境 ID');
      return;
    }

    try {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: false,
      });
      this.globalData.cloudReady = true;
    } catch (err) {
      console.error('[App] 云开发初始化失败:', err);
    }
  },
});
