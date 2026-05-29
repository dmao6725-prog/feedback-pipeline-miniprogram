// app.js - 反馈分析小程序入口

const CLOUD_ENV_ID = 'your-env-id'; // TODO: 替换为你的云开发环境 ID

App({
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

    if (!CLOUD_ENV_ID || CLOUD_ENV_ID === 'your-env-id') {
      console.warn('[App] 请在 miniprogram/app.js 中配置真实云环境 ID');
      return;
    }

    try {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true,
      });
      this.globalData.cloudReady = true;
    } catch (err) {
      console.error('[App] 云开发初始化失败:', err);
    }
  },
});
