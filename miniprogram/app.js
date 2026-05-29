// app.js - 反馈分析小程序入口

const CLOUD_ENV_ID = 'your-env-id'; // TODO: 替换为你的云开发环境 ID

App({
  globalData: {
    userInfo: null,
    openid: '',
    cloudReady: false,
  },

  onLaunch() {
    this.initCloud();
  },

  initCloud() {
    if (!wx.cloud) {
      console.warn('[App] 当前微信版本不支持云开发');
      return;
    }

    try {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true,
      });
      this.globalData.cloudReady = true;
      this.getOpenid();
    } catch (err) {
      console.error('[App] 云开发初始化失败:', err);
    }
  },

  async getOpenid() {
    try {
      await wx.cloud.callFunction({
        name: 'getTaskResult',
        data: { taskId: '_ping_' },
      });
      // 云函数会返回错误（taskId 不存在），但 openid 可从 wxContext 获取。
      this.globalData.openid = '';
    } catch (err) {
      // 非云开发模式或未部署云函数时忽略。
    }
  },
});
