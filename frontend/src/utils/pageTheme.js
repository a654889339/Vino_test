/**
 * 后台「页面基础配置」板块 section=pageTheme，path 为前台路由，color 为背景色，desc 为透明度 0-100，imageUrl 可选整页背景图。
 */
function normalizePath(p) {
  if (p == null || p === '') return '/';
  const s = String(p).trim();
  if (s === '' || s === '/') return '/';
  return s.replace(/\/$/, '') || '/';
}

export function findPageTheme(items, routePath) {
  const list = (items || []).filter((i) => i.section === 'pageTheme' && i.status === 'active');
  if (!list.length) return null;
  const want = normalizePath(routePath);
  return (
    list.find((i) => normalizePath(i.path) === want) ||
    list.find((i) => String(i.path || '').trim() === String(routePath || '').trim()) ||
    null
  );
}

/**
 * 返回用于背景层的内联样式对象；无有效配置时返回 null。
 */
export function buildPageThemeLayerStyle(items, routePath) {
  const row = findPageTheme(items, routePath);
  if (!row) return null;
  const color = (row.color || '').trim();
  const img = (row.imageUrl || '').trim();
  let op = parseFloat(row.desc);
  if (!Number.isFinite(op)) op = 100;
  op = Math.min(100, Math.max(0, op)) / 100;
  if (!color && !img) return null;
  const style = {
    position: 'absolute',
    left: '0',
    right: '0',
    top: '0',
    bottom: '0',
    minHeight: '100%',
    zIndex: '0',
    pointerEvents: 'none',
    opacity: String(op),
  };
  if (img) {
    style.backgroundImage = `url(${img})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
    style.backgroundRepeat = 'no-repeat';
    if (color) style.backgroundColor = color;
  } else {
    style.background = color;
  }
  return style;
}
