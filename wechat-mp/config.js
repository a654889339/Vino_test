/**
 * 微信小程序运行时配置（**唯一**主源）。
 * 换服务器 / 换域名 / 切 HTTPS 时只改这一个文件，其它页面必须从
 * `getApp().globalData.baseUrl` 或直接 `require('../../config.js')` 读取，
 * 禁止再在代码里出现形如 `|| 'http://106.xxx'` 的兜底字面量。
 *
 * 常见控制台报错对照（开发者工具 → Console）：
 * - `net::ERR_CONNECTION_REFUSED` + `http://localhost:xxxx`：本机没有在该端口跑后端，
 *   或端口写错。当前 Go 后端默认 **5202**（不是 5502）。要么启动本机 `vino-server`，
 *   要么把下面改成已部署的 `http://<IP>:5202/api`。
 * - `net::ERR_NAME_NOT_RESOLVED` + `*.example.com`：`example.com` 仅为文档占位域名，
 *   不能解析。请改成真实 IP 或已在微信公众平台「服务器域名」里配置过的合法域名。
 */
const BASE_URL = 'http://106.54.50.88:5202/api';

module.exports = {
  BASE_URL,
  /** 后端域名（不含 /api 前缀）——用于拼接静态资源 URL（图片等） */
  BASE_ORIGIN: BASE_URL.replace(/\/api\/?$/, ''),
};
