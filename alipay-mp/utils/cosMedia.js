/**
 * 与 Web、微信相同：桶基址与 GET /api/media/cos-config 同构；相对路径与 /uploads/ 兼容与 Web 对齐。
 */
const { createCosMediaPathCache } = require('../../common/frontend/cos_base/cosMediaPathCache.js');

const DEFAULT_DISPLAY_CACHE_MS = 5 * 60 * 1000;
const cosDownloadPathCache = createCosMediaPathCache({ ttlMs: DEFAULT_DISPLAY_CACHE_MS });

let cosHostPrefix = '';
let displayCacheTtlMs = DEFAULT_DISPLAY_CACHE_MS;
const DEFAULT_FRONT_PAGE_CONFIG = {
  root: 'front_page_config',
  homepageCarouselTemplate: 'Homepagecarousel/{id}_{lang}.jpg',
  productIconTemplate: 'product/{product_id}/icon_{lang}.png',
  productCoverTemplate: 'product/{product_id}/banner_page_{lang}.jpg',
  productCoverThumbTemplate: 'product/{product_id}/cover_thumbnail_{lang}.jpg',
  model3d: 'product/{product_id}/model3d.glb',
  model3dDecal: 'product/{product_id}/model3d_decal_{lang}.png',
  model3dSkyBox: 'product/{product_id}/model3d_skybox.jpg',
  descriptionPdf: 'product/{product_id}/desc_{lang}.pdf',
};
let frontPageConfig = { ...DEFAULT_FRONT_PAGE_CONFIG };

const isMediaCosPath = (s) => {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return !!(cosHostPrefix && (t === cosHostPrefix || t.startsWith(`${cosHostPrefix}/`)));
};

function setCosMediaConfig(cfg) {
  const h = cfg && cfg.cosHost;
  cosHostPrefix = typeof h === 'string' ? h.trim().replace(/\/$/, '') : '';
  const imgTtl = cfg && cfg.imageDisplayCacheTtlMs;
  displayCacheTtlMs =
    typeof imgTtl === 'number' && imgTtl > 0 ? imgTtl : DEFAULT_DISPLAY_CACHE_MS;
  cosDownloadPathCache.setTtlMs(displayCacheTtlMs);
}

function setFrontPageConfig(cfg) {
  const r = cfg && cfg.root;
  const root = typeof r === 'string' && r.trim() ? r.trim().replace(/^\/+|\/+$/g, '') : DEFAULT_FRONT_PAGE_CONFIG.root;
  const carTpl = cfg && cfg.homepageCarouselTemplate;
  const iconTpl = cfg && cfg.productIconTemplate;
  const coverTpl = cfg && cfg.productCoverTemplate;
  const coverThumbTpl = cfg && cfg.productCoverThumbTemplate;
  const m3Tpl = cfg && cfg.model3d;
  const m3DecalTpl = cfg && cfg.model3dDecal;
  const m3SkyTpl = cfg && cfg.model3dSkyBox;
  const descPdfTpl = cfg && cfg.descriptionPdf;
  frontPageConfig = {
    root,
    homepageCarouselTemplate:
      typeof carTpl === 'string' && carTpl.trim()
        ? carTpl.trim().replace(/^\/+|\/+$/g, '')
        : DEFAULT_FRONT_PAGE_CONFIG.homepageCarouselTemplate,
    productIconTemplate:
      typeof iconTpl === 'string' && iconTpl.trim()
        ? iconTpl.trim().replace(/^\/+|\/+$/g, '')
        : DEFAULT_FRONT_PAGE_CONFIG.productIconTemplate,
    productCoverTemplate:
      typeof coverTpl === 'string' && coverTpl.trim()
        ? coverTpl.trim().replace(/^\/+|\/+$/g, '')
        : DEFAULT_FRONT_PAGE_CONFIG.productCoverTemplate,
    productCoverThumbTemplate:
      typeof coverThumbTpl === 'string' && coverThumbTpl.trim()
        ? coverThumbTpl.trim().replace(/^\/+|\/+$/g, '')
        : DEFAULT_FRONT_PAGE_CONFIG.productCoverThumbTemplate,
    model3d:
      typeof m3Tpl === 'string' && m3Tpl.trim()
        ? m3Tpl.trim().replace(/^\/+|\/+$/g, '')
        : DEFAULT_FRONT_PAGE_CONFIG.model3d,
    model3dDecal:
      typeof m3DecalTpl === 'string' && m3DecalTpl.trim()
        ? m3DecalTpl.trim().replace(/^\/+|\/+$/g, '')
        : DEFAULT_FRONT_PAGE_CONFIG.model3dDecal,
    model3dSkyBox:
      typeof m3SkyTpl === 'string' && m3SkyTpl.trim()
        ? m3SkyTpl.trim().replace(/^\/+|\/+$/g, '')
        : DEFAULT_FRONT_PAGE_CONFIG.model3dSkyBox,
    descriptionPdf:
      typeof descPdfTpl === 'string' && descPdfTpl.trim()
        ? descPdfTpl.trim().replace(/^\/+|\/+$/g, '')
        : DEFAULT_FRONT_PAGE_CONFIG.descriptionPdf,
  };
}

function renderCosKeyTemplate(tpl, vars) {
  const t = String(tpl || '').trim().replace(/^\/+|\/+$/g, '');
  if (!t) return '';
  let out = t;
  Object.keys(vars || {}).forEach((k) => {
    out = out.split(`{${k}}`).join(String(vars[k]));
  });
  if (!out || out.includes('{') || out.includes('}') || out.includes('..') || out.includes('\\')) return '';
  return out.replace(/^\/+/, '');
}

function homepageCarouselUrl(id, lang) {
  const k = String(id == null ? '' : id).trim();
  const language = String(lang || '').trim();
  if (!k || (language !== 'zh' && language !== 'en')) return '';
  const fp = frontPageConfig || DEFAULT_FRONT_PAGE_CONFIG;
  const root = fp.root || DEFAULT_FRONT_PAGE_CONFIG.root;
  const rel = renderCosKeyTemplate(fp.homepageCarouselTemplate, { id: k, lang: language });
  if (!rel) return '';
  const key = `${root}/${rel}`.replace(/^\/+/, '');
  // 小程序统一走后端同源媒体接口（baseUrl 通常已包含 /api）
  return `/media/cos?key=${encodeURIComponent(key)}`;
}

function getCosPublicBase() {
  return cosHostPrefix;
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
 * @param {string} apiBase 与 config.BASE_URL 一致
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
      if (status === 200 && body && body.code === 0 && body.data) {
        const d = body.data;
        const raw =
          d.ossPublicBaseDefault != null && String(d.ossPublicBaseDefault).trim() !== ''
            ? String(d.ossPublicBaseDefault).trim()
            : d.cosHost != null
              ? String(d.cosHost).trim()
              : '';
        if (raw) {
          const n = raw.replace(/\/$/, '');
          const imgT = d.imageDisplayCacheTtlMs;
          setCosMediaConfig({
            cosHost: n,
            imageDisplayCacheTtlMs: typeof imgT === 'number' && imgT > 0 ? imgT : displayCacheTtlMs,
          });
        }
        if (d.frontPageConfig && typeof d.frontPageConfig === 'object') {
          setFrontPageConfig({
            root: d.frontPageConfig.root,
            homepageCarouselTemplate: d.frontPageConfig.homepageCarouselTemplate,
            productIconTemplate: d.frontPageConfig.productIconTemplate,
            productCoverTemplate: d.frontPageConfig.productCoverTemplate,
            productCoverThumbTemplate: d.frontPageConfig.productCoverThumbTemplate,
            model3d: d.frontPageConfig.model3d,
            model3dDecal: d.frontPageConfig.model3dDecal,
            model3dSkyBox: d.frontPageConfig.model3dSkyBox,
            descriptionPdf: d.frontPageConfig.descriptionPdf,
          });
        }
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
  const fp = frontPageConfig || DEFAULT_FRONT_PAGE_CONFIG;
  const root = fp.root || DEFAULT_FRONT_PAGE_CONFIG.root;
  const vars = { product_id: String(id), lang };
  let rel = '';
  switch (role) {
    case 'cover':
      rel = renderCosKeyTemplate(fp.productCoverTemplate, vars);
      break;
    case 'cover_thumb':
      rel = renderCosKeyTemplate(fp.productCoverThumbTemplate, vars);
      break;
    case 'icon':
      rel = renderCosKeyTemplate(fp.productIconTemplate, vars);
      break;
    case 'pdf':
      rel = renderCosKeyTemplate(fp.descriptionPdf, vars);
      break;
    case 'model3d':
      rel = renderCosKeyTemplate(fp.model3d, { product_id: String(id) });
      break;
    case 'decal':
      rel = renderCosKeyTemplate(fp.model3dDecal, vars);
      break;
    case 'skybox':
      rel = renderCosKeyTemplate(fp.model3dSkyBox, { product_id: String(id) });
      break;
    case 'scan':
      rel = renderCosKeyTemplate(`product/{product_id}/${productDefaults().scan || ''}`, { product_id: String(id) });
      break;
    default:
      rel = '';
  }
  if (!rel) return '';
  const key = `${root}/${rel}`.replace(/^\/+/, '');
  if (!cosHostPrefix) return '';
  return `${cosHostPrefix}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function resolveMediaUrl(u, apiBase) {
  if (u == null) return '';
  if (typeof u !== 'string') u = String(u);
  const t = u.trim();
  if (!t) return '';
  if (t.includes('/media/cos?key=') || t.includes('/api/media/cos?key=')) {
    if (t.startsWith('/')) {
      const { site } = splitForMp(apiBase);
      return (site || '') + t;
    }
    if (t.startsWith('http://') || t.startsWith('https://')) return t;
    const { site } = splitForMp(apiBase);
    return (site || '') + '/' + t.replace(/^\/+/, '');
  }
  const { site } = splitForMp(apiBase);

  const ck = cosUrlToKey(t);
  if (ck !== null) {
    if (ck === '') return cosHostPrefix || '';
    if (cosHostPrefix) return `${cosHostPrefix}/${ck.split('/').map(encodeURIComponent).join('/')}`;
  }
  if (t.startsWith('http://')) {
    const m = t.match(/\/uploads\/(.+)$/i);
    if (m && cosHostPrefix) {
      const key = `vino/uploads/${m[1]}`;
      return `${cosHostPrefix}/${key.split('/').map(encodeURIComponent).join('/')}`;
    }
    return t.replace(/^http:\/\//i, 'https://');
  }
  if (t.startsWith('https://')) return t;
  if (t.startsWith('/uploads/') && cosHostPrefix) {
    return `${cosHostPrefix}/${('vino' + t).split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
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
  const hit = cosDownloadPathCache.getCachedPath(url);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    x.downloadFile({
      ...opts,
      success: (r) => {
        const p = r.apFilePath || r.tempFilePath;
        if (p) {
          cosDownloadPathCache.setCachedPath(url, p);
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
  getCosPublicBase,
  fetchCosMediaConfig,
  fetchMediaCatalog,
  guideProductMediaUrl,
  homepageCarouselUrl,
};
