/** 默认币种符号（未配置时） */
export const DEFAULT_CURRENCY = '¥';

let cachedSymbol = DEFAULT_CURRENCY;

/** 币种代码 -> 符号（用于商品订单/购物车） */
export function currencyCodeToSymbol(code, fallbackSymbol) {
  const c = (code == null ? '' : String(code)).trim().toUpperCase();
  if (c === 'CNY') return '¥';
  if (c === 'USD') return '$';
  if (c === 'HKD') return 'HK$';
  if (c === 'EUR') return '€';
  if (c === 'GBP') return '£';
  if (c === 'JPY') return '¥';
  const fb = (fallbackSymbol == null ? '' : String(fallbackSymbol)).trim();
  return fb || DEFAULT_CURRENCY;
}

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
 * @param {string|null|undefined} currencyOverride 支持币种符号或币种代码（CNY/USD...）；有值时优先于全局币种
 */
export function formatPriceDisplay(amount, currencyOverride) {
  const override =
    currencyOverride != null && String(currencyOverride).trim() !== ''
      ? String(currencyOverride).trim()
      : null;
  const base = getCurrencySymbol();
  const sym =
    override == null
      ? base
      : // 若为常见币种代码则映射符号，否则保持原样（允许直接传符号）
        currencyCodeToSymbol(override, override);
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
