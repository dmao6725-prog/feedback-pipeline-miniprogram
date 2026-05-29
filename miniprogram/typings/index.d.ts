// 微信小程序全局类型声明

interface IAppOption {
  globalData: {
    userInfo: any;
    openid: string;
    cloudReady: boolean;
  };
  initCloud(): void;
  getOpenid(): void;
}
