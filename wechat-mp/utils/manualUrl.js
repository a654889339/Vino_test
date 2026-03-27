/** 说明书链接：补全域名 + 判断是否 PDF 直链（用于 downloadFile + openDocument） */

function toFullUrl(raw, app) {
  let url = String(raw || '').trim();
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (app && app.globalData && app.globalData.baseUrl ? app.globalData.baseUrl : '').replace(/\/api\/?$/, '') || '';
  return base + (url.startsWith('/') ? url : '/' + url);
}

/** 根据路径判断是否为 PDF；无后缀的非常规链接仍走 webview */
function isLikelyPdfUrl(url) {
  if (!url) return false;
  const path = String(url).split('?')[0].split('#')[0].toLowerCase();
  return path.endsWith('.pdf');
}

module.exports = { toFullUrl, isLikelyPdfUrl };
