/** 将后台返回的相对路径、协议相对 URL 转为当前站点可加载的绝对地址 */
export function resolvePublicUrl(u) {
  if (u == null || u === '') return '';
  const s = String(u).trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return typeof window !== 'undefined' ? window.location.protocol + s : s;
  if (typeof window === 'undefined') return s;
  return window.location.origin + (s.startsWith('/') ? s : '/' + s);
}
