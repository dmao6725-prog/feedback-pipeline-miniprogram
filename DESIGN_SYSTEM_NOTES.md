# Design System Notes

FeedbackPipeline 小程序不采用 Liquid Glass，也不使用 `backdrop-filter` 或复杂透明叠层。

本项目采用跨平台兼容的 Soft Surface 设计语言：实色背景、轻边框、轻阴影、统一圆角和克制的蓝色 accent。目标是保持 iOS 端的信息结构、数据产品气质和高级感，而不是复刻 iOS 专属视觉效果。

所有页面必须优先使用 `miniprogram/styles/tokens.wxss` 中的 `--fp-*` token，并通过 `theme.wxss` 与 `components.wxss` 复用按钮、卡片、输入框、分段控件、空状态、历史列表和文件列表样式。

设计约束：

- 背景使用 `--fp-bg`
- 卡片使用 `--fp-surface`、`--fp-border`、`--fp-shadow-card`
- 输入框高度不低于 `72rpx`
- 主按钮高度不低于 `88rpx`
- 页面底部保留 `calc(120rpx + env(safe-area-inset-bottom))`
- WXML 不写复杂计算，展示字符串在 JS 中提前生成
- tabBar 使用 `miniprogram/assets/icons/` 下的本地 PNG 图标，避免远程资源和字体图标差异

## 图标规范

小程序端不使用 emoji、iconfont 或远程图标。所有关键图标使用本地 PNG，保证 iOS、Android、鸿蒙和微信开发者工具一致显示。图标采用圆角线性风格，未选中灰色 `#98A2B3`，选中蓝色 `#2F6DF6`。
