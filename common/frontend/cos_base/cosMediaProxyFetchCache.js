/**
 * 同源媒体代理 GET（/api/media/cos|oss?key=）的 ArrayBuffer + blob: 展示缓存（仅浏览器/Web 前端）。
 * COS 资源经代理拉取后的字节缓存在此 Map；卸载 img 时 revoke blob URL 后可降级保留 buffer，减少切页重复请求。
 * 不包含后端 Go 的 COS 逻辑；小程序直链 downloadFile 路径缓存见 cosMediaPathCache.js。
 *
 * @param {{ ttlMs?: number, isProxyUrl?: (s: string) => boolean }} [options]
 */
export function createCosMediaProxyFetchCache(options = {}) {
  let ttlMs = Number(options.ttlMs) > 0 ? Number(options.ttlMs) : 300000;
  const isProxyUrl =
    typeof options.isProxyUrl === 'function'
      ? options.isProxyUrl
      : (s) => {
          const t = (s == null ? '' : String(s)).trim();
          return (
            t.includes('/media/cos?key=') ||
            t.includes('/api/media/cos?key=') ||
            t.includes('/media/oss?key=') ||
            t.includes('/api/media/oss?key=')
          );
        };

  const entryByKey = new Map();
  let pruneTimer = null;

  function setTtlMs(ms) {
    const n = Number(ms);
    if (n > 0) ttlMs = n;
  }

  function prune() {
    const n = Date.now();
    for (const [k, e] of entryByKey) {
      if (e && e.exp < n) {
        if (e.type === 'obj' && e.objectUrl) {
          try {
            URL.revokeObjectURL(e.objectUrl);
          } catch {
            /* ignore */
          }
        }
        entryByKey.delete(k);
      }
    }
  }

  function startPeriodicPrune(intervalMs = 30_000) {
    if (pruneTimer != null) return;
    if (typeof window === 'undefined') return;
    const ms = Number(intervalMs) > 0 ? Number(intervalMs) : 30_000;
    pruneTimer = window.setInterval(() => {
      prune();
    }, ms);
  }

  function stopPeriodicPrune() {
    if (pruneTimer == null || typeof window === 'undefined') return;
    window.clearInterval(pruneTimer);
    pruneTimer = null;
  }

  function objectKeyFromProxyAbs(abs) {
    try {
      const u = new URL(String(abs), typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      const k = u.searchParams.get('key');
      return k ? decodeURIComponent(k) : '';
    } catch {
      return '';
    }
  }

  function normalizeObjectKey(key) {
    const t = (key == null ? '' : String(key)).trim();
    if (!t) return '';
    return t.replace(/^\/+/, '');
  }

  function objectKeyFromPublicUrl(publicUrl) {
    try {
      const u = new URL(String(publicUrl));
      return decodeURIComponent((u.pathname || '').replace(/^\/+/, ''));
    } catch {
      return '';
    }
  }

  function releaseEntry(e) {
    if (!e) return;
    if (e.type === 'obj' && e.objectUrl) {
      try {
        URL.revokeObjectURL(e.objectUrl);
      } catch {
        /* ignore */
      }
    }
  }

  function invalidateByAbsProxyUrl(abs) {
    const key = (abs == null ? '' : String(abs)).trim();
    if (!key) return;
    const e = entryByKey.get(key);
    releaseEntry(e);
    entryByKey.delete(key);
  }

  function invalidateByObjectKey(objectKey) {
    const target = normalizeObjectKey(objectKey);
    if (!target) return;
    for (const [k, e] of entryByKey.entries()) {
      const hitKey = normalizeObjectKey(objectKeyFromProxyAbs(k));
      if (hitKey && hitKey === target) {
        releaseEntry(e);
        entryByKey.delete(k);
      }
    }
  }

  function invalidateByPublicUrl(publicUrl) {
    const key = objectKeyFromPublicUrl(publicUrl);
    if (!key) return;
    invalidateByObjectKey(key);
  }

  /**
   * @param {string|Request} input
   * @param {RequestInit} [init]
   * @returns {Promise<Response>}
   */
  async function fetchCosMediaCached(input, init) {
    const u = typeof input === 'string' ? input : input && input.url;
    if (typeof u !== 'string' || !isProxyUrl(u)) {
      return fetch(input, init);
    }
    const abs = u.startsWith('http')
      ? u
      : typeof location !== 'undefined'
        ? location.origin + (u.startsWith('/') ? u : `/${u}`)
        : u;
    prune();
    const hit = entryByKey.get(abs);
    if (hit && hit.exp > Date.now() && hit.buffer) {
      const ct = hit.contentType || 'application/octet-stream';
      return new Response(hit.buffer, { status: 200, headers: { 'Content-Type': ct } });
    }
    const r = await fetch(abs, init);
    if (!r.ok) return r;
    const buf = await r.arrayBuffer();
    const ct = (r.headers && r.headers.get('content-type')) || 'application/octet-stream';
    entryByKey.set(abs, { type: 'ab', exp: Date.now() + ttlMs, buffer: buf, contentType: ct });
    return new Response(buf.slice(0), { status: 200, headers: { 'Content-Type': ct } });
  }

  async function fetchCosMediaBodyAbs(absUrl) {
    const r = await fetchCosMediaCached(absUrl, { credentials: 'include' });
    if (!r.ok) throw new Error(String(r.status));
    return r.blob();
  }

  /**
   * @param {string} abs 已为绝对 URL 且为代理路径
   */
  async function getBlobUrlForProxyAbs(abs) {
    const b = await fetchCosMediaBodyAbs(abs);
    const prev = entryByKey.get(abs);
    if (prev && prev.type === 'obj' && prev.objectUrl) {
      try {
        URL.revokeObjectURL(prev.objectUrl);
      } catch {
        /* ignore */
      }
    }
    const objectUrl = URL.createObjectURL(b);
    let keepBuffer;
    let keepCt;
    if (prev && prev.type === 'ab' && prev.buffer) {
      keepBuffer = prev.buffer;
      keepCt = prev.contentType;
    } else if (prev && prev.type === 'obj' && prev.buffer) {
      keepBuffer = prev.buffer;
      keepCt = prev.contentType;
    }
    entryByKey.set(abs, {
      type: 'obj',
      exp: Date.now() + ttlMs,
      objectUrl,
      blob: b,
      buffer: keepBuffer,
      contentType: keepCt || (b && b.type) || 'application/octet-stream',
    });
    return objectUrl;
  }

  function revokeIfCachedBlob(maybeObjectUrl) {
    if (typeof maybeObjectUrl !== 'string' || !maybeObjectUrl.startsWith('blob:')) return;
    for (const [k, e] of entryByKey) {
      if (e && e.type === 'obj' && e.objectUrl === maybeObjectUrl) {
        try {
          URL.revokeObjectURL(e.objectUrl);
        } catch {
          /* ignore */
        }
        if (e.buffer) {
          entryByKey.set(k, {
            type: 'ab',
            exp: Date.now() + ttlMs,
            buffer: e.buffer,
            contentType: e.contentType || 'application/octet-stream',
          });
        } else {
          entryByKey.delete(k);
        }
        return;
      }
    }
    try {
      URL.revokeObjectURL(maybeObjectUrl);
    } catch {
      /* ignore */
    }
  }

  function __resetProxyFetchCacheForTests() {
    for (const [, e] of entryByKey.entries()) {
      releaseEntry(e);
    }
    entryByKey.clear();
    stopPeriodicPrune();
  }

  return {
    setTtlMs,
    fetchCosMediaCached,
    fetchCosMediaBodyAbs,
    getBlobUrlForProxyAbs,
    revokeIfCachedBlob,
    prune,
    startPeriodicPrune,
    invalidateByAbsProxyUrl,
    invalidateByObjectKey,
    invalidateByPublicUrl,
    __resetProxyFetchCacheForTests,
  };
}
