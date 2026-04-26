/**
 * 与 Web、微信相同的媒体 URL 规则；5 分钟仅支付宝端内存+临时文件路径缓存
 * cosHost 须与后端 cos.go 一致，由 GET /api/media/cos-config 下发。
 */
const DEFAULT_DISPLAY_CACHE_MS = 5 * 60 * 1000;
const isMediaCosPath = (s) => typeof s === 'string' && s.includes('/media/cos?key=');
const filePathByUrl = new Map();

let cosHostPrefix = '';
let displayCacheTtlMs = DEFAULT_DISPLAY_CACHE_MS;

function setCosMediaConfig(cfg) {
  const h = cfg && cfg.cosHost;
  cosHostPrefix = typeof h === 'string' ? h.trim().replace(/\/$/, '') : '';
  const imgTtl = cfg && cfg.imageDisplayCacheTtlMs;
  displayCacheTtlMs =
    typeof imgTtl === 'number' && imgTtl > 0 ? imgTtl : DEFAULT_DISPLAY_CACHE_MS;
}

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
 * @param {string} apiBase
 * @param {() => void} [done]
 */
function fetchCosMediaConfig(apiBase, done) {
  const { media } = splitForMp(apiBase);
  const finish = () => {
    if (typeof done === 'function') done();
  };
  if (typeof my === 'undefined' || !my.request) {
    finish();
    return;
  }
  my.request({
    url: media + '/media/cos-config',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    success(res) {
      const status = res.status != null ? res.status : res.statusCode;
      const body = res.data;
      if (status === 200 && body && body.code === 0 && body.data && body.data.cosHost) {
        setCosMediaConfig(body.data);
      }
      finish();
    },
    fail: finish,
  });
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

function fetchMediaCatalog(apiBase, done) {
  const { media } = splitForMp(apiBase);
  const finish = () => {
    if (typeof done === 'function') done();
  };
  if (typeof my === 'undefined' || !my.request) {
    finish();
    return;
  }
  my.request({
    url: media + '/media/catalog',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    success(res) {
      const status = res.status != null ? res.status : res.statusCode;
      const body = res.data;
      if (status === 200 && body && body.code === 0 && body.data) {
        mediaCatalog = body.data;
        mediaCatalogFetchedAt = Date.now();
      }
      finish();
    },
    fail: finish,
  });
}

function maybeRefreshCatalog(apiBase) {
  if (Date.now() - mediaCatalogFetchedAt < CATALOG_TTL_MS) return;
  fetchMediaCatalog(apiBase, () => {});
}

function guideProductMediaUrl(guideId, role, opt) {
  opt = opt || {};
  maybeRefreshCatalog(opt.apiBase || '');
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
  const key = 'front_page_config/product/' + id + '/' + file;
  const { media } = splitForMp(opt.apiBase || '');
  return media + '/media/cos?key=' + encodeURIComponent(key);
}

function resolveMediaUrl(u, apiBase) {
  if (u == null) return '';
  if (typeof u !== 'string') u = String(u);
  const t = u.trim();
  if (!t) return '';
  if (t.includes('/media/cos?key=')) return t;
  const { site, media } = splitForMp(apiBase);

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
          filePathByUrl.set(url, { exp: now + displayCacheTtlMs, path: p });
        }
        resolve(p);
      },
      fail: reject,
    });
  });
}

module.exports = {
  resolveMediaUrl,
  downloadFileCached,
  setCosMediaConfig,
  fetchCosMediaConfig,
  fetchMediaCatalog,
  guideProductMediaUrl,
};
