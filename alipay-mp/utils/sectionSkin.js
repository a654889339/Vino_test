function findSectionSkin(items, skinKey) {
  return (
    (items || []).find(
      (i) => i.section === 'homeSectionSkin' && String(i.path || '').trim() === skinKey && i.status === 'active'
    ) || null
  );
}

function hexToRgb(hex) {
  const s = String(hex || '').trim();
  let m = /^#?([0-9a-fA-F]{6})$/.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  m = /^#?([0-9a-fA-F]{3})$/.exec(s);
  if (m) {
    const n = m[1];
    return {
      r: parseInt(n[0] + n[0], 16),
      g: parseInt(n[1] + n[1], 16),
      b: parseInt(n[2] + n[2], 16),
    };
  }
  return null;
}

function buildSectionSkinContainerStyle(items, skinKey, variant) {
  const row = findSectionSkin(items, skinKey);
  if (!row) return '';
  let op = parseFloat(row.desc);
  if (!Number.isFinite(op)) op = 100;
  op = Math.min(100, Math.max(0, op)) / 100;
  const color = (row.color || '').trim();
  const rgb = hexToRgb(color);
  if (rgb && op === 0) op = 1;

  const shadow =
    variant === 'vino'
      ? '0 4rpx 24rpx rgba(0,0,0,0.08)'
      : variant === 'card'
        ? '0 2rpx 12rpx rgba(0,0,0,0.06)'
        : '0 4rpx 20rpx rgba(0,0,0,0.08)';

  let bg;
  if (rgb) {
    bg = `rgba(${rgb.r},${rgb.g},${rgb.b},${op})`;
  } else {
    bg = op > 0 ? `rgba(255,255,255,${op})` : 'transparent';
  }

  const parts = [`background:${bg}`, `box-shadow:${op > 0 ? shadow : 'none'}`];
  if (variant === 'card' && op > 0) {
    parts.push('backdrop-filter:none');
    parts.push('-webkit-backdrop-filter:none');
  }
  return parts.join(';') + ';';
}

module.exports = { buildSectionSkinContainerStyle, findSectionSkin, hexToRgb };
