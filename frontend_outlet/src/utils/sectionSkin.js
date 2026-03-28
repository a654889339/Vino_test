import { resolvePublicUrl } from '@/utils/mediaUrl';

/**
 * 首页各栏目外观：section=homeSectionSkin，path 为栏目键，imageUrl 背景图，color 可选底色，desc 透明度 0–100（100 为不透明）
 */
const SKIN_KEYS = ['homeScroll', 'tabbar', 'vinoProduct', 'featuredRecommend', 'myProducts'];

export function findSectionSkin(items, skinKey) {
  return (
    (items || []).find(
      (i) => i.section === 'homeSectionSkin' && String(i.path || '').trim() === skinKey && i.status === 'active'
    ) || null
  );
}

/** 栏目外观「透明度」0–100，无配置时返回 null */
export function getSectionSkinOpacity01(items, skinKey) {
  const row = findSectionSkin(items, skinKey);
  if (!row) return null;
  let op = parseFloat(row.desc);
  if (!Number.isFinite(op)) op = 100;
  return Math.min(100, Math.max(0, op)) / 100;
}

/** 解析 #RGB / #RRGGBB，失败返回 null */
export function hexToRgb(hex) {
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

/**
 * 与栏目外观同一套透明度：作用于栏目容器背景（hex 底色 + desc，无 hex 时沿用白底半透明）。
 * 无 homeSectionSkin 配置时返回空对象，沿用样式表默认。
 */
export function buildSectionSkinContainerStyle(items, skinKey, variant = 'fr') {
  const row = findSectionSkin(items, skinKey);
  if (!row) return {};
  let op = parseFloat(row.desc);
  if (!Number.isFinite(op)) op = 100;
  op = Math.min(100, Math.max(0, op)) / 100;
  const color = (row.color || '').trim();
  const rgb = hexToRgb(color);
  // 仅填了 hex 底色而透明度为 0 时，前台会完全看不见，与「底色」语义冲突，按不透明处理
  if (rgb && op === 0) op = 1;

  const shadow =
    variant === 'vino'
      ? '0 4px 24px rgba(0, 0, 0, 0.08)'
      : variant === 'card'
        ? '0 2px 12px rgba(0, 0, 0, 0.06)'
        : '0 4px 20px rgba(0, 0, 0, 0.08)';

  let background;
  if (rgb) {
    background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${op})`;
  } else {
    background = op > 0 ? `rgba(255, 255, 255, ${op})` : 'transparent';
  }

  const glassBlur = 'saturate(180%) blur(20px)';
  const out = {
    background,
    boxShadow: op > 0 ? shadow : 'none',
    border: op > 0 ? '1px solid rgba(255, 255, 255, 0.42)' : 'none',
    backdropFilter: op > 0 ? glassBlur : 'none',
    WebkitBackdropFilter: op > 0 ? glassBlur : 'none',
  };
  return out;
}

/**
 * 用于绝对定位铺底的装饰层（不影响子元素透明度）
 */
export function buildSectionSkinLayerStyle(items, skinKey) {
  const row = findSectionSkin(items, skinKey);
  if (!row) return null;
  const img = (row.imageUrl || '').trim();
  const color = (row.color || '').trim();
  let op = parseFloat(row.desc);
  if (!Number.isFinite(op)) op = 100;
  op = Math.min(100, Math.max(0, op)) / 100;
  const rgb = hexToRgb(color);
  if (rgb && op === 0 && !img) op = 1;
  if (!img && !color) return null;

  const style = {
    position: 'absolute',
    inset: '0',
    borderRadius: 'inherit',
    zIndex: '0',
    pointerEvents: 'none',
  };

  if (img) {
    const u = resolvePublicUrl(img);
    style.backgroundImage = `url(${u})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
    style.backgroundRepeat = 'no-repeat';
    if (rgb) {
      style.backgroundColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    } else if (color) {
      style.backgroundColor = color;
    }
    style.opacity = String(op);
  } else if (rgb) {
    style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${op})`;
  } else {
    style.background = color;
    style.opacity = String(op);
  }
  return style;
}

export { SKIN_KEYS };
