/**
 * COS 读统一入口：与 wechat/alipay 小程序 utils/cosMedia 行为一致
 * - 本桶直链、/uploads 相对路径一律走同源 GET /api/media/cos?key=...
 * - 5 分钟仅内存缓存；后端接口对 COS 直读已 no-store
 */
const CACHE_MS = 5 * 60 * 1000;
const COS_HOST_RE = /^https?:\/\/[^/]+\.cos\.[^/]+\.myqcloud\.com\/?/i;
const isMediaCosPath = (s) => typeof s === 'string' && s.includes('/media/cos?key=');
const entryByKey = new Map();

function getViteApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  return '';
}

/**
 * 由 api 根推站点根与 /api 基址（如 https://host:5202/api）
 * @param {string|undefined} optApiBase
 */
function splitForWeb(optApiBase) {
  const raw = optApiBase !== undefined && optApiBase !== null ? String(optApiBase) : getViteApiBase();
  const a = (raw || '').trim().replace(/\/$/, '');
  if (a) {
    const hasApi = /\/api$/.test(a) || a.endsWith('/api');
    const media = hasApi ? a : a + '/api';
    const site = a.replace(/\/api$/, '') || a;
    return { site, media };
  }
  if (typeof location === 'undefined') {
    return { site: '', media: '/api' };
  }
  return { site: location.origin, media: location.origin + '/api' };
}

/**
 * @param {string} u
 * @param {{apiBase?: string}} [opt]
 * @returns {string}
 */
export function resolveMediaUrl(u, opt = {}) {
  if (u == null) return '';
  if (typeof u !== 'string') u = String(u);
  const t = u.trim();
  if (!t) return '';
  if (t.includes('/media/cos?key=')) return t;
  const { site, media } = splitForWeb(opt.apiBase);

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
  if (t.startsWith('/')) return site + t;
  return site + '/' + t;
}

/**
 * @param {string} u
 * @param {{apiBase?: string}} [opt]
 * @returns {string}
 */
export function toAbsoluteMediaUrl(u, opt) {
  const s = resolveMediaUrl(u, opt);
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (typeof location === 'undefined') return s;
  return s.startsWith('/') ? location.origin + s : s;
}

function prune() {
  const n = Date.now();
  for (const [k, e] of entryByKey) {
    if (e && e.exp < n) {
      if (e.type === 'obj' && e.objectUrl) {
        try {
          URL.revokeObjectURL(e.objectUrl);
        } catch (err) {
          // ignore
        }
      }
      entryByKey.delete(k);
    }
  }
}

/**
 * 用于 &lt;img>：仅 COS 代理用 blob:；非代理保持绝对 http(s) 直链
 * @param {string} u
 * @param {{apiBase?: string}} [opt]
 * @returns {Promise<string>}
 */
export async function getBlobUrlForDisplay(u, opt) {
  const abs = toAbsoluteMediaUrl(u, opt);
  if (!abs) return '';
  if (!isMediaCosPath(abs)) {
    if (abs.startsWith('http')) return abs;
    if (typeof location !== 'undefined' && abs.startsWith('/')) return location.origin + abs;
    return abs;
  }
  const b = await fetchCosMediaBodyAbs(abs);
  const prev = entryByKey.get(abs);
  if (prev && prev.type === 'obj' && prev.objectUrl) {
    try {
      URL.revokeObjectURL(prev.objectUrl);
    } catch (err) {
      // ignore
    }
  }
  const objectUrl = URL.createObjectURL(b);
  entryByKey.set(abs, { type: 'obj', exp: Date.now() + CACHE_MS, objectUrl, blob: b });
  return objectUrl;
}

/**
 * 带 5 分钟内存缓存的 fetch，仅对最终 URL 含 /media/cos?key= 的 GET 有效
 * @param {string|Request} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function fetchCosMediaCached(input, init) {
  const u = typeof input === 'string' ? input : input && input.url;
  if (typeof u !== 'string' || !isMediaCosPath(u)) {
    return fetch(input, init);
  }
  const abs = u.startsWith('http') ? u : (typeof location !== 'undefined' ? location.origin + (u.startsWith('/') ? u : `/${u}`) : u);
  prune();
  const hit = entryByKey.get(abs);
  if (hit && hit.type === 'ab' && hit.exp > Date.now() && hit.buffer) {
    const ct = hit.contentType || 'application/octet-stream';
    return new Response(hit.buffer, { status: 200, headers: { 'Content-Type': ct } });
  }
  const r = await fetch(abs, init);
  if (!r.ok) return r;
  const buf = await r.arrayBuffer();
  const ct = (r.headers && r.headers.get('content-type')) || 'application/octet-stream';
  entryByKey.set(abs, { type: 'ab', exp: Date.now() + CACHE_MS, buffer: buf, contentType: ct });
  return new Response(buf.slice(0), { status: 200, headers: { 'Content-Type': ct } });
}

export async function fetchCosMediaBodyAbs(absUrl) {
  const r = await fetchCosMediaCached(absUrl, { credentials: 'include' });
  if (!r.ok) throw new Error(String(r.status));
  return r.blob();
}

/**
 * @param {string} [maybeObjectUrl]
 */
export function revokeIfCachedBlob(maybeObjectUrl) {
  if (typeof maybeObjectUrl !== 'string' || !maybeObjectUrl.startsWith('blob:')) return;
  for (const [k, e] of entryByKey) {
    if (e && e.type === 'obj' && e.objectUrl === maybeObjectUrl) {
      try {
        URL.revokeObjectURL(e.objectUrl);
      } catch (e2) {
        // ignore
      }
      entryByKey.delete(k);
      return;
    }
  }
  try {
    URL.revokeObjectURL(maybeObjectUrl);
  } catch (e3) {
    // ignore
  }
}
