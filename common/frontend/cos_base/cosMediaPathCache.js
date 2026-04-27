/**
 * 小程序侧：COS 桶直链等 URL → downloadFile 临时路径的内存 TTL 缓存。
 * 仅客户端；后端 COS 代理/拉对象不做此类缓存。
 *
 * @param {{ ttlMs?: number }} [options]
 * @returns {{
 *   setTtlMs: (ms: number) => void,
 *   getCachedPath: (url: string) => string | null,
 *   setCachedPath: (url: string, path: string) => void,
 * }}
 */
function createCosMediaPathCache(options) {
  const o = options || {};
  let ttlMs = Number(o.ttlMs) > 0 ? Number(o.ttlMs) : 300000;
  const map = new Map();

  function setTtlMs(ms) {
    const n = Number(ms);
    if (n > 0) ttlMs = n;
  }

  function getCachedPath(url) {
    if (typeof url !== 'string' || !url) return null;
    const c = map.get(url);
    const now = Date.now();
    if (!c || c.exp <= now) {
      if (c) map.delete(url);
      return null;
    }
    return c.path || null;
  }

  function setCachedPath(url, path) {
    if (typeof url !== 'string' || !url || typeof path !== 'string' || !path) return;
    map.set(url, { exp: Date.now() + ttlMs, path });
  }

  return { setTtlMs, getCachedPath, setCachedPath };
}

module.exports = { createCosMediaPathCache };
