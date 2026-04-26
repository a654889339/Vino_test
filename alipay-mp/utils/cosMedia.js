/**
 * 与 Web、微信相同的媒体 URL 规则；5 分钟仅支付宝端内存+临时文件路径缓存
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

function downloadFileCached(opts, api) {
  const x = api || (typeof my !== 'undefined' ? my : null);
  if (!x || !x.downloadFile) {
    return Promise.reject(new Error('no downloadFile'));
  }
  const url = (opts && opts.url) || '';
  if (!isMediaCosPath(url)) {
    return new Promise((resolve, reject) => {
      x.downloadFile({ ...opts, success: (r) => resolve(r.apFilePath || r.tempFilePath), fail: reject });
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
        const p = r.apFilePath || r.tempFilePath;
        if (p) {
          filePathByUrl.set(url, { exp: now + CACHE_MS, path: p });
        }
        resolve(p);
      },
      fail: reject,
    });
  });
}

module.exports = { resolveMediaUrl, downloadFileCached };
