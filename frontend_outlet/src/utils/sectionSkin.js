import { resolvePublicUrl } from '@/utils/mediaUrl';

/**
 * 首页各栏目外观：section=homeSectionSkin，path 为栏目键，imageUrl 背景图，color 可选底色，desc 透明度 0–100
 */
const SKIN_KEYS = ['homeScroll', 'tabbar', 'vinoProduct', 'featuredRecommend', 'myProducts', 'hotService'];

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

/**
 * 与栏目外观同一套透明度：同时作用于白色底板（rgba 白底，不占位影响子元素）与背景图装饰层。
 * 无 homeSectionSkin 配置时返回空对象，沿用样式表默认白底。
 */
export function buildSectionSkinContainerStyle(items, skinKey, variant = 'fr') {
  const op = getSectionSkinOpacity01(items, skinKey);
  if (op === null) return {};
  const shadow =
    variant === 'vino'
      ? '0 4px 24px rgba(0, 0, 0, 0.08)'
      : '0 4px 20px rgba(0, 0, 0, 0.08)';
  return {
    background: `rgba(255, 255, 255, ${op})`,
    boxShadow: op > 0 ? shadow : 'none',
  };
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
  if (!img && !color) return null;
  const style = {
    position: 'absolute',
    inset: '0',
    borderRadius: 'inherit',
    zIndex: '0',
    pointerEvents: 'none',
    opacity: String(op),
  };
  if (img) {
    const u = resolvePublicUrl(img);
    style.backgroundImage = `url(${u})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
    style.backgroundRepeat = 'no-repeat';
    if (color) style.backgroundColor = color;
  } else {
    style.background = color;
  }
  return style;
}

export { SKIN_KEYS };
