const DEFAULT_CURRENCY = '¥';

function formatNumberPart(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Number.parseFloat(Number(n).toFixed(2)));
}

/**
 * @param {string|number} amount
 * @param {string} [symbol]
 */
function formatPriceDisplay(amount, symbol) {
  const sym = (symbol != null && String(symbol).trim() !== '') ? String(symbol).trim() : DEFAULT_CURRENCY;
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
  formatPriceDisplay,
};
