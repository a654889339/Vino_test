const STORAGE_KEY = 'vino_lang';

let _lang = '';
try { _lang = wx.getStorageSync(STORAGE_KEY) || ''; } catch {}

const _texts = {};
let _loaded = false;

function getLang() { return _lang || 'zh'; }
function isEn() { return _lang === 'en'; }

function setLang(lang) {
  _lang = lang;
  try { wx.setStorageSync(STORAGE_KEY, lang); } catch {}
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
  wx.request({
    url: (getApp().globalData.baseUrl || 'http://106.54.50.88:5202/api') + '/i18n',
    success(res) {
      const data = (res.data && res.data.data) || [];
      for (const item of data) {
        _texts[item.key] = { zh: item.zh, en: item.en };
      }
      _loaded = true;
      if (cb) cb();
    },
    fail() { if (cb) cb(); },
  });
}

/**
 * Translate by key or inline fallback.
 * t('home.myProducts') -> looks up key
 * t('中文', 'English') -> inline fallback
 */
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

module.exports = { getLang, isEn, setLang, detectLangByIp, loadI18nTexts, t, pick };
