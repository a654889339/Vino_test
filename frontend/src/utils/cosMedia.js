/**
 * COS 读统一入口：与 wechat/alipay 小程序一致。
 * - 桶公网基址优先 GET /api/media/cos-config；失败时读包内 common/config/cos/vino.media.yaml（与后端真源一致）；
 * - 最后 VITE_COS_PUBLIC_BASE 仅作本地开发兜底。
 */
import { parseVinoMediaYamlDefaults } from '@cos_base/parseVinoMediaYaml.js';
import vinoMediaYamlRaw from '../../../common/config/cos/vino.media.yaml?raw';

const DEFAULT_DISPLAY_CACHE_MS = 5 * 60 * 1000;

/** 构建期嵌入仓内 vino.media.yaml，与 GET /api/media/cos-config 同源 */
const bundledYamlMediaDefaults = (() => {
  try {
    return parseVinoMediaYamlDefaults(vinoMediaYamlRaw);
  } catch {
    return { ossPublicBaseDefault: '' };
  }
})();

function envCosBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_COS_PUBLIC_BASE) {
    return String(import.meta.env.VITE_COS_PUBLIC_BASE).trim().replace(/\/$/, '');
  }
  return '';
}

/** 公网基址，由 initCosMediaFromServer（cos-config）或 VITE_ 兜底注入 */
let cosHostPrefix = '';
let displayCacheTtlMs = DEFAULT_DISPLAY_CACHE_MS;
const DEFAULT_FRONT_PAGE_CONFIG = {
  root: 'front_page_config',
  logo: 'logo/{lang}.png',
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

export function setFrontPageConfig(cfg) {
  const base = { ...DEFAULT_FRONT_PAGE_CONFIG, ...frontPageConfig, ...(cfg && typeof cfg === 'object' ? cfg : {}) };
  const r = base.root;
  const root = typeof r === 'string' && r.trim() ? r.trim().replace(/^\/+|\/+$/g, '') : DEFAULT_FRONT_PAGE_CONFIG.root;
  const logoTpl = base.logo;
  const carTpl = base.homepageCarouselTemplate;
  const iconTpl = base.productIconTemplate;
  const coverTpl = base.productCoverTemplate;
  const coverThumbTpl = base.productCoverThumbTemplate;
  const m3Tpl = base.model3d;
  const m3DecalTpl = base.model3dDecal;
  const m3SkyTpl = base.model3dSkyBox;
  const descPdfTpl = base.descriptionPdf;
  frontPageConfig = {
    root,
    logo:
      typeof logoTpl === 'string' && logoTpl.trim()
        ? logoTpl.trim().replace(/^\/+|\/+$/g, '')
        : DEFAULT_FRONT_PAGE_CONFIG.logo,
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

export function getFrontPageConfig() {
  return { ...frontPageConfig };
}

export function homepageCarouselUrl(id, lang) {
  const k = String(id == null ? '' : id).trim();
  const language = String(lang || '').trim();
  if (!k || (language !== 'zh' && language !== 'en')) return '';
  const { root, homepageCarouselTemplate } = frontPageConfig || DEFAULT_FRONT_PAGE_CONFIG;
  const rel = renderCosKeyTemplate(homepageCarouselTemplate, { id: k, lang: language });
  if (!rel) return '';
  const key = `${root}/${rel}`.replace(/^\/+/, '');
  if (!cosHostPrefix) return '';
  return `${cosHostPrefix}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * 首页 YAML Logo（frontPageConfig.Logo，占位符 {lang}），同源代理 URL。
 * @param {'zh'|'en'} lang
 * @returns {string}
 */
export function frontPageLogoUrl(lang) {
  const language = String(lang || '').trim();
  if (language !== 'zh' && language !== 'en') return '';
  const fp = frontPageConfig || DEFAULT_FRONT_PAGE_CONFIG;
  const { root, logo: logoTpl } = fp;
  const rel = renderCosKeyTemplate(logoTpl || DEFAULT_FRONT_PAGE_CONFIG.logo, { lang: language });
  if (!rel) return '';
  const key = `${root || DEFAULT_FRONT_PAGE_CONFIG.root}/${rel}`.replace(/^\/+/, '');
  if (!cosHostPrefix) return '';
  return `${cosHostPrefix}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function renderCosKeyTemplate(tpl, vars) {
  const t = String(tpl || '').trim().replace(/^\/+|\/+$/g, '');
  if (!t) return '';
  let out = t;
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.split(`{${k}}`).join(String(v));
  }
  if (!out || out.includes('{') || out.includes('}') || out.includes('..') || out.includes('\\')) return '';
  return out.replace(/^\/+/, '');
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
 * 从 GET /api/media/cos-config 拉取 ossPublicBaseDefault；失败时用 VITE_COS_PUBLIC_BASE。
 * @param {string|undefined} [optApiBase] 同 initMediaCatalogFromServer
 */
export async function initCosMediaFromServer(optApiBase) {
  const { media } = splitForWeb(optApiBase);
  let url;
  if (media.startsWith('http')) {
    url = media.replace(/\/$/, '') + '/media/cos-config';
  } else if (typeof location !== 'undefined') {
    const m = media.startsWith('/') ? media : '/' + media;
    url = location.origin + m + '/media/cos-config';
  } else {
    url = (media || '/api').replace(/\/$/, '') + '/media/cos-config';
  }
  try {
    const r = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      if (j && j.code === 0 && j.data) {
        const d = j.data;
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
            logo: d.frontPageConfig.logo,
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
    }
  } catch (_) {
    // ignore
  }
  if (!cosHostPrefix && bundledYamlMediaDefaults && bundledYamlMediaDefaults.ossPublicBaseDefault) {
    const n = String(bundledYamlMediaDefaults.ossPublicBaseDefault).trim().replace(/\/$/, '');
    const ttl =
      bundledYamlMediaDefaults.imageDisplayCacheTtlMs ||
      bundledYamlMediaDefaults.mediaConfigTtlMs ||
      displayCacheTtlMs;
    setCosMediaConfig({
      cosHost: n,
      imageDisplayCacheTtlMs: typeof ttl === 'number' && ttl > 0 ? ttl : displayCacheTtlMs,
    });
  }
  if (!cosHostPrefix) {
    const b = envCosBase();
    if (b) {
      setCosMediaConfig({ cosHost: b, imageDisplayCacheTtlMs: displayCacheTtlMs });
    }
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
 * 商品 DeviceGuide 媒体：按 catalog 约定拼媒体 URL。
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
  const { site, media: _m } = splitForWeb(opt.apiBase);

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
    return `${cosHostPrefix}/${('vino' + t).split('/').map(encodeURIComponent).join('/')}`;
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

/**
 * 用于 &lt;img>：仅 COS 代理用 blob:；非代理保持绝对 http(s) 直链
 * @param {string} u
 * @param {{apiBase?: string}} [opt]
 * @returns {Promise<string>}
 */
export async function getBlobUrlForDisplay(u, opt) {
  const abs = toAbsoluteMediaUrl(u, opt);
  if (!abs) return '';
  if (abs.startsWith('http')) return abs;
  if (typeof location !== 'undefined' && abs.startsWith('/')) return location.origin + abs;
  return abs;
}

/**
 * 带内存 TTL 的 fetch，仅对同源 COS 代理路径的 GET 走缓存（基建见 @cos_base/cosMediaProxyFetchCache）
 * @param {string|Request} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export function fetchCosMediaCached(input, init) {
  return fetch(input, init);
}

export function fetchCosMediaBodyAbs(absUrl) {
  return fetch(absUrl, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.blob();
  });
}

/**
 * @param {string} [maybeObjectUrl]
 */
export function revokeIfCachedBlob(maybeObjectUrl) {
  if (typeof maybeObjectUrl !== 'string') return;
  if (!maybeObjectUrl.startsWith('blob:')) return;
  try {
    URL.revokeObjectURL(maybeObjectUrl);
  } catch {
    /* ignore */
  }
}

