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
  let sweepTimer = null;

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

  function invalidateUrl(url) {
    if (typeof url !== 'string' || !url) return;
    map.delete(url);
  }

  function sweepExpired() {
    const now = Date.now();
    for (const [k, c] of map.entries()) {
      if (!c || c.exp <= now) map.delete(k);
    }
  }

  function startPeriodicSweep(intervalMs) {
    if (sweepTimer != null) return;
    const ms = Number(intervalMs) > 0 ? Number(intervalMs) : 30000;
    sweepTimer = setInterval(function () {
      sweepExpired();
    }, ms);
  }

  function stopPeriodicSweep() {
    if (sweepTimer == null) return;
    clearInterval(sweepTimer);
    sweepTimer = null;
  }

  return {
    setTtlMs,
    getCachedPath,
    setCachedPath,
    invalidateUrl,
    sweepExpired,
    startPeriodicSweep,
    stopPeriodicSweep,
  };
}

module.exports = { createCosMediaPathCache };
