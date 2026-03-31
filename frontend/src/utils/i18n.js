import { ref, computed } from 'vue';

const STORAGE_KEY = 'vino_lang';

const currentLang = ref(localStorage.getItem(STORAGE_KEY) || '');

const isEn = computed(() => currentLang.value === 'en');

function setLang(lang) {
  currentLang.value = lang;
  localStorage.setItem(STORAGE_KEY, lang);
}

/** 根据 IP 推测语言（仅首次访问时使用） */
async function detectLangByIp() {
  if (currentLang.value) return;
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const cn = data.country_code === 'CN' || data.country_code === 'HK' || data.country_code === 'MO' || data.country_code === 'TW';
    setLang(cn ? 'zh' : 'en');
  } catch {
    setLang('zh');
  }
}

/**
 * 根据当前语言返回对应文本。
 * t({ zh: '中文', en: 'English' }) 或 t('中文', '英文')
 */
function t(zhOrObj, en) {
  if (typeof zhOrObj === 'object' && zhOrObj !== null) {
    return isEn.value ? (zhOrObj.en || zhOrObj.zh || '') : (zhOrObj.zh || '');
  }
  return isEn.value ? (en || zhOrObj || '') : (zhOrObj || '');
}

/** 从数据库字段选取对应语言值（字段名 + En 后缀约定） */
function pick(obj, field) {
  if (!obj) return '';
  if (isEn.value) {
    const enVal = obj[field + 'En'] || obj[field + '_en'];
    if (enVal && String(enVal).trim()) return enVal;
  }
  return obj[field] || '';
}

export { currentLang, isEn, setLang, detectLangByIp, t, pick };
