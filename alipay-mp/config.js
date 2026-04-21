/**
 * 支付宝小程序运行时配置（**唯一**主源）。
 * 换服务器 / 换域名 / 切 HTTPS 时只改这一个文件，其它页面必须从
 * `getApp().globalData.baseUrl` 或直接 `require('../../config.js')` 读取，
 * 禁止再在代码里出现形如 `|| 'http://106.xxx'` 的兜底字面量。
 *
 * 常见报错：`ERR_CONNECTION_REFUSED`（本机未起服务或端口错，后端默认 **5202**）、
 * `ERR_NAME_NOT_RESOLVED`（`*.example.com` 等占位域名无效，请改为真实 IP/已配置域名）。
 */
const BASE_URL = 'http://106.54.50.88:5202/api';

module.exports = {
  BASE_URL,
  /** 后端域名（不含 /api 前缀）——用于拼接静态资源 URL（图片等） */
  BASE_ORIGIN: BASE_URL.replace(/\/api\/?$/, ''),
};
