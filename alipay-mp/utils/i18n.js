/**
 * 支付宝小程序 i18n 工具：与 wechat-mp/utils/i18n.js 功能对齐。
 * 主要差异：
 *  - 存储 API 是 my.getStorageSync/setStorageSync，接收对象参数。
 *  - 网络 API 是 my.request，success 回包字段名与 wx 略不同。
 *  - 原生 tabBar 文案通过 my.setTabBarItem({ index, name }) 动态更新。
 */
const { BASE_URL: DEFAULT_BASE_URL } = require('../config.js');
const STORAGE_KEY = 'vino_lang';

let _lang = '';
try {
  const r = my.getStorageSync({ key: STORAGE_KEY });
  _lang = (r && r.data) ? r.data : '';
} catch (e) {}

const _texts = {};
let _loaded = false;
let _loading = false;
const _pendingCallbacks = [];

/** 原生 tabBar 文案：中英文对照，必须与 app.json 里 tabBar.items 顺序一致 */
const TABBAR_ITEMS = [
  { zh: '首页', en: 'Home' },
  { zh: '产品', en: 'Products' },
  { zh: '服务', en: 'Services' },
  { zh: '订单', en: 'Orders' },
  { zh: '我的', en: 'Mine' },
];

function getLang() { return _lang || 'zh'; }
function isEn() { return _lang === 'en'; }

function applyTabBarLabels() {
  try {
    TABBAR_ITEMS.forEach((it, index) => {
      if (typeof my.setTabBarItem !== 'function') return;
      my.setTabBarItem({ index, name: isEn() ? it.en : it.zh });
    });
  } catch (e) {}
}

function setLang(lang) {
  _lang = lang;
  try { my.setStorageSync({ key: STORAGE_KEY, data: lang }); } catch (e) {}
  applyTabBarLabels();
  // 部分基础库下 tabBar 完成挂载晚于 setLang，延迟再刷一次
  setTimeout(applyTabBarLabels, 0);
  setTimeout(applyTabBarLabels, 50);
}

function _getBaseUrl() {
  try {
    const app = getApp();
    if (app && app.globalData && app.globalData.baseUrl) return app.globalData.baseUrl;
  } catch (e) {}
  return DEFAULT_BASE_URL;
}

function detectLangByIp(cb) {
  if (_lang) { if (cb) cb(_lang); return; }
  my.request({
    url: 'https://ipapi.co/json/',
    timeout: 3000,
    success(res) {
      const d = res.data || {};
      const cn = d.country_code === 'CN' || d.country_code === 'HK' || d.country_code === 'MO' || d.country_code === 'TW';
      setLang(cn ? 'zh' : 'en');
      if (cb) cb(getLang());
    },
    fail() {
      setLang('zh');
      if (cb) cb('zh');
    },
  });
}

function loadI18nTexts(cb) {
  if (_loaded) { if (cb) cb(); return; }
  if (cb) _pendingCallbacks.push(cb);
  if (_loading) return;
  _loading = true;
  my.request({
    url: _getBaseUrl() + '/i18n',
    success(res) {
      const data = (res.data && res.data.data) || [];
      for (const item of data) {
        _texts[item.key] = { zh: item.zh, en: item.en };
      }
      _loaded = true;
    },
    complete() {
      _loading = false;
      const cbs = _pendingCallbacks.splice(0);
      cbs.forEach(function (fn) { fn(); });
    },
  });
}

function isLoaded() { return _loaded; }

function t(keyOrZh, enFallback) {
  if (_texts[keyOrZh]) {
    const entry = _texts[keyOrZh];
    return isEn() ? (entry.en || entry.zh || '') : (entry.zh || '');
  }
  return isEn() ? (enFallback || keyOrZh || '') : (keyOrZh || '');
}

/** 从 DB 对象里按当前语言取字段：英文下优先 fieldEn，其次 field；中文下只取 field。 */
function pick(obj, field) {
  if (!obj) return '';
  if (isEn()) {
    const enVal = obj[field + 'En'] || obj[field + '_en'];
    if (enVal && String(enVal).trim()) return enVal;
  }
  return obj[field] || '';
}

/** 支付宝导航栏标题：传入 i18n_texts 的 key 即按语言取值，否则当裸文案。 */
function setNavTitle(keyOrText, zhFallback, enFallback) {
  try {
    let title = '';
    if (_texts[keyOrText]) {
      const entry = _texts[keyOrText];
      title = isEn() ? (entry.en || entry.zh || '') : (entry.zh || '');
    } else if (zhFallback || enFallback) {
      title = isEn() ? (enFallback || zhFallback || '') : (zhFallback || '');
    } else {
      title = t(keyOrText);
    }
    if (title && typeof my.setNavigationBar === 'function') {
      my.setNavigationBar({ title });
    }
  } catch (e) {}
}

module.exports = {
  getLang,
  isEn,
  setLang,
  detectLangByIp,
  loadI18nTexts,
  isLoaded,
  t,
  pick,
  applyTabBarLabels,
  setNavTitle,
};
