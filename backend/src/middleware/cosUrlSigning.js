const cosUpload = require('../utils/cosUpload');

/**
 * 对 /api 下 JSON 响应中的本桶 COS 直链替换为「本服务 /api/media/cos?key=」代理地址。
 * 小程序等对 COS 签名直链常返回 403，经后端用密钥拉流可稳定显示。
 */
function cosUrlProxyMiddleware(req, res, next) {
  const origJson = res.json.bind(res);
  res.json = function cosProxyJson(body) {
    cosUpload
      .proxyCosUrlsDeepAsync(req, body)
      .then((out) => origJson(out))
      .catch((e) => {
        console.warn('[COS proxy] middleware:', e.message);
        origJson(body);
      });
  };
  next();
}

module.exports = { cosUrlProxyMiddleware };
