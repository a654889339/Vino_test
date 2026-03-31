const STORAGE_KEY = 'vino_lang';

let _lang = '';
try { _lang = wx.getStorageSync(STORAGE_KEY) || ''; } catch {}

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

function t(zh, en) { return isEn() ? (en || zh || '') : (zh || ''); }

function pick(obj, field) {
  if (!obj) return '';
  if (isEn()) {
    const enVal = obj[field + 'En'] || obj[field + '_en'];
    if (enVal && String(enVal).trim()) return enVal;
  }
  return obj[field] || '';
}

module.exports = { getLang, isEn, setLang, detectLangByIp, t, pick };
