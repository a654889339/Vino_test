/**
 * 与 Web frontend/src/utils/cosMedia 一致的媒体 URL 规则；5 分钟仅微信端内存+临时文件路径缓存
 */
const CACHE_MS = 5 * 60 * 1000;
const COS_HOST_RE = /^https?:\/\/[^/]+\.cos\.[^/]+\.myqcloud\.com\/?/i;
const isMediaCosPath = (s) => typeof s === 'string' && s.includes('/media/cos?key=');
const filePathByUrl = new Map();

function splitForMp(apiBase) {
  const a = (apiBase || '').trim().replace(/\/$/, '');
  if (a) {
    const hasApi = /\/api$/.test(a) || a.endsWith('/api');
    const media = hasApi ? a : a + '/api';
    const site = a.replace(/\/api$/, '') || a;
    return { site, media };
  }
  return { site: '', media: '/api' };
}

/**
 * 统一媒体 URL；COS/上传类走与 Web 相同代理路径
 * @param {string} u
 * @param {string} apiBase 如 https://host/api
 * @returns {string}
 */
function resolveMediaUrl(u, apiBase) {
  if (u == null) return '';
  if (typeof u !== 'string') u = String(u);
  const t = u.trim();
  if (!t) return '';
  if (t.includes('/media/cos?key=')) return t;
  const { site, media } = splitForMp(apiBase);
  if (COS_HOST_RE.test(t)) {
    const key = t.replace(COS_HOST_RE, '').replace(/^\//, '');
    return media + '/media/cos?key=' + encodeURIComponent(key);
  }
  if (t.startsWith('http://')) {
    const m = t.match(/\/uploads\/(.+)$/i);
    if (m) {
      return media + '/media/cos?key=' + encodeURIComponent('vino/uploads/' + m[1]);
    }
    return t.replace(/^http:\/\//i, 'https://');
  }
  if (t.startsWith('https://')) return t;
  if (t.startsWith('/uploads/')) {
    return media + '/media/cos?key=' + encodeURIComponent('vino' + t);
  }
  if (t.startsWith('/')) return (site || '') + t;
  return (site || '') + '/' + t;
}

/**
 * 兼容原 image.js 导出名
 */
function normalizeImageUrl(u, apiBase) {
  return resolveMediaUrl(u, apiBase);
}

/**
 * 供 model-viewer 等需 downloadFile 的场景；同一 URL 5 分钟内不重复请求
 * @param {{url: string, header?: object}} opts
 * @param {any} api 默认 wx
 * @returns {Promise<string>} tempFilePath
 */
function downloadFileCached(opts, api) {
  const x = api || (typeof wx !== 'undefined' ? wx : null);
  if (!x || !x.downloadFile) {
    return Promise.reject(new Error('no downloadFile'));
  }
  const url = (opts && opts.url) || '';
  if (!isMediaCosPath(url)) {
    return new Promise((resolve, reject) => {
      x.downloadFile({ ...opts, success: (r) => resolve(r.tempFilePath), fail: reject });
    });
  }
  const now = Date.now();
  const c = filePathByUrl.get(url);
  if (c && c.exp > now && c.path) {
    return Promise.resolve(c.path);
  }
  return new Promise((resolve, reject) => {
    x.downloadFile({
      ...opts,
      success: (r) => {
        if (r.statusCode === 200) {
          filePathByUrl.set(url, { exp: now + CACHE_MS, path: r.tempFilePath });
        }
        resolve(r.tempFilePath);
      },
      fail: reject,
    });
  });
}

module.exports = {
  resolveMediaUrl,
  normalizeImageUrl,
  downloadFileCached,
};
