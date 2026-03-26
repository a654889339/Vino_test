import { resolvePublicUrl } from '@/utils/mediaUrl';

/**
 * 首页各栏目外观：section=homeSectionSkin，path 为栏目键，imageUrl 背景图，color 可选底色，desc 透明度 0–100
 */
const SKIN_KEYS = ['homeScroll', 'tabbar', 'vinoProduct', 'myProducts', 'hotService'];

export function findSectionSkin(items, skinKey) {
  return (
    (items || []).find(
      (i) => i.section === 'homeSectionSkin' && String(i.path || '').trim() === skinKey && i.status === 'active'
    ) || null
  );
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
