/** 默认币种符号（未配置时） */
export const DEFAULT_CURRENCY = '¥';

let cachedSymbol = DEFAULT_CURRENCY;

export function setCurrencySymbol(sym) {
  const t = (sym == null ? '' : String(sym)).trim();
  cachedSymbol = t || DEFAULT_CURRENCY;
}

export function getCurrencySymbol() {
  return cachedSymbol;
}

export function initFromHomeConfigList(list) {
  const row = (list || []).find((i) => i.section === 'currency' && i.status === 'active');
  setCurrencySymbol(row?.title);
}

function formatNumberPart(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Number.parseFloat(Number(n).toFixed(2)));
}

export function formatPriceDisplay(amount) {
  const sym = getCurrencySymbol();
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    if (amount == null || amount === '') return '';
    return String(amount);
  }
  if (n === 0) return '0';
  return sym + formatNumberPart(n);
}
