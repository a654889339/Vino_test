/**
 * COS 读统一入口：与 wechat/alipay 小程序 utils/cosMedia 行为一致
 * - 本桶直链（前缀来自 GET /api/media/cos-config 的 cosHost，与后端 cos.go 一致）、/uploads 相对路径一律走同源 GET /api/media/cos?key=...
 * - 5 分钟仅内存缓存；后端接口对 COS 直读已 no-store
 */
const DEFAULT_DISPLAY_CACHE_MS = 5 * 60 * 1000;
const isMediaCosPath = (s) => typeof s === 'string' && s.includes('/media/cos?key=');
const entryByKey = new Map();

/** 与后端 CosBase() 一致的前缀，由 initCosMediaFromServer / setCosMediaConfig 注入 */
let cosHostPrefix = '';
/** 与 GET /api/media/cos-config 的 imageDisplayCacheTtlMs 对齐，用于 blob/Response 内存缓存 */
let displayCacheTtlMs = DEFAULT_DISPLAY_CACHE_MS;

export function setCosMediaConfig(cfg) {
  const h = cfg && cfg.cosHost;
  cosHostPrefix = typeof h === 'string' ? h.trim().replace(/\/$/, '') : '';
  const imgTtl = cfg && cfg.imageDisplayCacheTtlMs;
  if (typeof imgTtl === 'number' && imgTtl > 0) {
    displayCacheTtlMs = imgTtl;
  } else {
    displayCacheTtlMs = DEFAULT_DISPLAY_CACHE_MS;
  }
}

/**
 * 若 u 为本配置桶直链（可带 query），返回 object key；否则 null。
 * @param {string} t
 * @returns {string|null}
 */
function cosUrlToKey(t) {
  if (!cosHostPrefix) return null;
  const norm = cosHostPrefix.replace(/\/$/, '');
  const bases = [norm];
  if (norm.startsWith('https://')) {
    bases.push('http://' + norm.slice(8));
  } else if (norm.startsWith('http://')) {
    bases.push('https://' + norm.slice(7));
  }
  const u = String(t).split('?')[0];
  for (const b of bases) {
    if (u === b) return '';
    if (u.startsWith(b + '/')) return u.slice(b.length + 1);
  }
  return null;
}

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
 * 启动时拉取 /api/media/cos-config 并注入 cosHost（与后端桶一致）。
 * @param {string|undefined} [optApiBase]
 * @returns {Promise<void>}
 */
export async function initCosMediaFromServer(optApiBase) {
  const { media } = splitForWeb(optApiBase);
  try {
    const r = await fetch(media + '/media/cos-config', { credentials: 'include' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.code === 0 && j.data) setCosMediaConfig(j.data);
  } catch (err) {
    // ignore
  }
}

const CATALOG_TTL_MS = 5 * 60 * 1000;
let mediaCatalog = null;
let mediaCatalogFetchedAt = 0;

const FALLBACK_PRODUCT_DEFAULTS = {
  cover: 'banner_page.jpg',
  cover_en: 'banner_page_en.jpg',
  cover_thumb: 'cover_thumbnail.jpg',
  cover_thumb_en: 'cover_thumbnail_en.jpg',
  icon: 'icon.png',
  icon_en: 'icon_en.png',
  pdf: 'description.pdf',
  model3d: 'model3d.glb',
  decal: 'decal.png',
  skybox: 'model3d_skybox.jpg',
  scan: 'scan.png',
};

function productDefaults() {
  const defs = (mediaCatalog && mediaCatalog.productMedia && mediaCatalog.productMedia.defaults) || {};
  return {
    cover: defs.cover || FALLBACK_PRODUCT_DEFAULTS.cover,
    cover_en: defs.cover_en || FALLBACK_PRODUCT_DEFAULTS.cover_en,
    cover_thumb: defs.cover_thumb || FALLBACK_PRODUCT_DEFAULTS.cover_thumb,
    cover_thumb_en: defs.cover_thumb_en || FALLBACK_PRODUCT_DEFAULTS.cover_thumb_en,
    icon: defs.icon || FALLBACK_PRODUCT_DEFAULTS.icon,
    icon_en: defs.icon_en || FALLBACK_PRODUCT_DEFAULTS.icon_en,
    pdf: defs.pdf || FALLBACK_PRODUCT_DEFAULTS.pdf,
    model3d: defs.model3d || FALLBACK_PRODUCT_DEFAULTS.model3d,
    decal: defs.decal || FALLBACK_PRODUCT_DEFAULTS.decal,
    skybox: defs.skybox || FALLBACK_PRODUCT_DEFAULTS.skybox,
    scan: defs.scan || FALLBACK_PRODUCT_DEFAULTS.scan,
  };
}

/**
 * 拉取 GET /api/media/catalog（5 分钟内存 TTL，与 Cache-Control 一致）
 * @param {string|undefined} [optApiBase]
 */
export async function initMediaCatalogFromServer(optApiBase) {
  const { media } = splitForWeb(optApiBase);
  try {
    const r = await fetch(media + '/media/catalog', { credentials: 'include' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.code === 0 && j.data) {
      mediaCatalog = j.data;
      mediaCatalogFetchedAt = Date.now();
    }
  } catch (_) {
    // ignore
  }
}

function maybeRefreshCatalog(optApiBase) {
  if (Date.now() - mediaCatalogFetchedAt < CATALOG_TTL_MS) return;
  void initMediaCatalogFromServer(optApiBase);
}

/**
 * 商品 DeviceGuide 媒体：按 catalog 约定拼同源代理 URL（忽略 DB 内旧 URL）。
 * @param {number|string} guideId device_guides.id
 * @param {'cover'|'cover_thumb'|'icon'|'pdf'|'model3d'|'decal'|'skybox'|'scan'} role
 * @param {{ lang?: 'zh'|'en', apiBase?: string }} [opt]
 * @returns {string}
 */
export function guideProductMediaUrl(guideId, role, opt = {}) {
  maybeRefreshCatalog(opt.apiBase);
  const id = Number(guideId);
  if (!Number.isFinite(id) || id <= 0) return '';
  const lang = opt.lang === 'en' ? 'en' : 'zh';
  const d = productDefaults();
  let file = '';
  switch (role) {
    case 'cover':
      file = lang === 'en' ? d.cover_en : d.cover;
      break;
    case 'cover_thumb':
      file = lang === 'en' ? d.cover_thumb_en : d.cover_thumb;
      break;
    case 'icon':
      file = lang === 'en' ? d.icon_en : d.icon;
      break;
    case 'pdf':
      file = d.pdf;
      break;
    case 'model3d':
      file = d.model3d;
      break;
    case 'decal':
      file = d.decal;
      break;
    case 'skybox':
      file = d.skybox;
      break;
    case 'scan':
      file = d.scan;
      break;
    default:
      file = '';
  }
  if (!file) return '';
  const key = `front_page_config/product/${id}/${file}`;
  const { media } = splitForWeb(opt.apiBase);
  return `${media}/media/cos?key=${encodeURIComponent(key)}`;
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

  const ck = cosUrlToKey(t);
  if (ck !== null) {
    if (ck === '') return media + '/media/cos?key=';
    return media + '/media/cos?key=' + encodeURIComponent(ck);
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
  entryByKey.set(abs, { type: 'obj', exp: Date.now() + displayCacheTtlMs, objectUrl, blob: b });
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
  entryByKey.set(abs, { type: 'ab', exp: Date.now() + displayCacheTtlMs, buffer: buf, contentType: ct });
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
