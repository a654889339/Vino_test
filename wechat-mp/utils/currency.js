const DEFAULT_CURRENCY = '¥';

function currencyCodeToSymbol(code, fallbackSymbol) {
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

function formatNumberPart(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Number.parseFloat(Number(n).toFixed(2)));
}

/**
 * @param {string|number} amount
 * @param {string} [currencyOverride] 币种代码或符号
 */
function formatPriceDisplay(amount, currencyOverride) {
  const raw = (currencyOverride != null && String(currencyOverride).trim() !== '') ? String(currencyOverride).trim() : '';
  const sym = raw ? currencyCodeToSymbol(raw, raw) : DEFAULT_CURRENCY;
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    if (amount == null || amount === '') return '';
    return String(amount);
  }
  if (n === 0) return '';
  return sym + formatNumberPart(n);
}

module.exports = {
  DEFAULT_CURRENCY,
  currencyCodeToSymbol,
  formatPriceDisplay,
};
