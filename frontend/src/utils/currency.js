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

/** 从首页配置列表解析币种（section=currency） */
export function initFromHomeConfigList(list) {
  const row = (list || []).find((i) => i.section === 'currency' && i.status === 'active');
  setCurrencySymbol(row?.title);
}

function formatNumberPart(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Number.parseFloat(Number(n).toFixed(2)));
}

/**
 * 展示价格：非 0 时带币种符号；金额为 0 时不显示数字（返回空字符串）。
 * @param {string|number|null|undefined} amount
 * @param {string|null|undefined} currencySymbolOverride 有值时优先于全局币种（如服务页的 currencyEn）
 */
export function formatPriceDisplay(amount, currencySymbolOverride) {
  const override =
    currencySymbolOverride != null && String(currencySymbolOverride).trim() !== ''
      ? String(currencySymbolOverride).trim()
      : null;
  const sym = override ?? getCurrencySymbol();
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    if (amount == null || amount === '') return '';
    return String(amount);
  }
  if (n === 0) return '';
  return sym + formatNumberPart(n);
}

/** 是否展示价格数字（金额为 0 时不展示） */
export function shouldShowPrice(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && n !== 0;
}
