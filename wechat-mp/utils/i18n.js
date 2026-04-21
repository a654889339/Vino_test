const { BASE_URL: DEFAULT_BASE_URL } = require('../config.js');
const STORAGE_KEY = 'vino_lang';

let _lang = '';
try { _lang = wx.getStorageSync(STORAGE_KEY) || ''; } catch (e) {}

const _texts = {};
let _loaded = false;
let _loading = false;
const _pendingCallbacks = [];

function getLang() { return _lang || 'zh'; }
function isEn() { return _lang === 'en'; }

/** 任意页面调用 setLang 后刷新自定义 tabBar，避免仍显示上一语言的 label */
function notifyTabBarLang() {
  try {
    const pages = getCurrentPages();
    for (let i = pages.length - 1; i >= 0; i--) {
      const page = pages[i];
      if (page && typeof page.getTabBar === 'function') {
        const tab = page.getTabBar();
        if (tab && typeof tab.refreshLabels === 'function') {
          tab.refreshLabels();
          return;
        }
      }
    }
  } catch (e) {}
}

/**
 * 在 tab 页 onShow 里调用：同步选中角标 + 按当前语言重算文案。
 * 仅 set selected 不重算 label 时，从首页切语言再进「产品」会仍显示英文底栏。
 */
function syncCustomTabBar(page, selectedIndex) {
  try {
    if (!page || typeof page.getTabBar !== 'function') return;
    const tab = page.getTabBar();
    if (!tab) return;
    if (typeof selectedIndex === 'number') {
      tab.setData({ selected: selectedIndex });
    }
    if (typeof tab.refreshLabels === 'function') {
      tab.refreshLabels();
    }
  } catch (e) {}
}

function setLang(lang) {
  _lang = lang;
  try { wx.setStorageSync(STORAGE_KEY, lang); } catch (e) {}
  notifyTabBarLang();
  // 部分基础库下 setLang 与 tabBar 完成挂载的时序不同步，延迟再刷一次
  setTimeout(notifyTabBarLang, 0);
  setTimeout(notifyTabBarLang, 50);
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
  wx.request({
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
  wx.request({
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
      cbs.forEach(function(fn) { fn(); });
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

function pick(obj, field) {
  if (!obj) return '';
  if (isEn()) {
    const enVal = obj[field + 'En'] || obj[field + '_en'];
    if (enVal && String(enVal).trim()) return enVal;
  }
  return obj[field] || '';
}

/**
 * 统一设置当前页顶部导航栏标题。
 * - 若传入的是 i18n_texts 的 key（形如 'mine.title'）就按语言取值；
 * - 否则当作裸文案回退。
 * 注意：tabBar 页切语言后需主动调，不会自动刷新。
 */
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
    if (title) wx.setNavigationBarTitle({ title });
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
  syncCustomTabBar,
  setNavTitle,
};
