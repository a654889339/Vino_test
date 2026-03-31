import { ref, computed, reactive } from 'vue';
import request from '@/api/request';

const STORAGE_KEY = 'vino_lang';

const currentLang = ref(localStorage.getItem(STORAGE_KEY) || '');
const isEn = computed(() => currentLang.value === 'en');

const texts = reactive({});
let loaded = false;

function setLang(lang) {
  currentLang.value = lang;
  localStorage.setItem(STORAGE_KEY, lang);
}

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

async function loadI18nTexts() {
  if (loaded) return;
  try {
    const res = await request.get('/i18n');
    if (res.data) {
      for (const item of res.data) {
        texts[item.key] = { zh: item.zh, en: item.en };
      }
    }
    loaded = true;
  } catch {
    /* silent */
  }
}

/**
 * Translate by key from i18n_texts, or fallback to inline zh/en.
 * Usage: t('home.myProducts')  -> looks up key
 *        t('中文', 'English')  -> inline fallback
 */
function t(keyOrZh, enFallback) {
  if (texts[keyOrZh]) {
    const entry = texts[keyOrZh];
    return isEn.value ? (entry.en || entry.zh || '') : (entry.zh || '');
  }
  if (typeof keyOrZh === 'object' && keyOrZh !== null) {
    return isEn.value ? (keyOrZh.en || keyOrZh.zh || '') : (keyOrZh.zh || '');
  }
  return isEn.value ? (enFallback || keyOrZh || '') : (keyOrZh || '');
}

function pick(obj, field) {
  if (!obj) return '';
  if (isEn.value) {
    const enVal = obj[field + 'En'] || obj[field + '_en'];
    if (enVal && String(enVal).trim()) return enVal;
  }
  return obj[field] || '';
}

export { currentLang, isEn, setLang, detectLangByIp, loadI18nTexts, t, pick, texts };
