# Sentry 小程序 SDK

用于小程序、小游戏平台的 Sentry SDK

## 开发

### 微信小游戏使用时可能会遇到的问题

##### 微信小游戏提示：Uncaught ReferenceError: URLSearchParams is not defined

解决办法：

- 在项目中安装 `Polyfill`：`npm install url-search-params-polyfill`
- 可以在调用的入口文件或微信小游戏的 `game.js` 文件中引入该包：`import 'url-search-params-polyfill';`

### 知识储备

开发前请仔细阅读下面内容：

- [sentry-miniapp 原作者地址](https://github.com/lizhiyao/sentry-miniapp)

由于原作者许久未更新，Sentry 版本落后过多，在 Sentry 上报时会提示版本落后。故本库将 Sentry 的基础库 ( @sentry/core ) 已升级至 v9.22.0

## 贡献

欢迎通过 `issue`、`pull request`等方式贡献 `sentry-miniapp`。