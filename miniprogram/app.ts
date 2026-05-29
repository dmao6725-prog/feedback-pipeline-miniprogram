// app.ts
App<IAppOption>({
  globalData: {
    userInfo: null,
    openid: '',
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'your-env-id', // 替换为实际云环境 ID
        traceUser: true,
      });
    }

    // 获取用户 openid
    this.getOpenid();
  },

  getOpenid() {
    wx.cloud
      ?.callFunction({
        name: 'login',
        data: {},
      })
      .then((res: any) => {
        this.globalData.openid = res.result?.openid || '';
      })
      .catch(() => {
        // 非云开发模式忽略
      });
  },
});
