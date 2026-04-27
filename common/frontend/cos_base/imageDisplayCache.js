import { resolvedUrlUsesMediaProxyPath } from './paths.js';

/**
 * @param {{ ttlMs: number, mediaProxyPathnames?: string[], onProxyDirectLog?: (keyParam: string) => void }} options
 */
export function createImageDisplayCache(options) {
  const ttlMs = Number(options.ttlMs) > 0 ? Number(options.ttlMs) : 300000;
  const mediaProxyPathnames = options.mediaProxyPathnames || ['/api/media/oss', '/api/media/cos'];
  const onProxyDirectLog = options.onProxyDirectLog;

  const store = new Map();
  const inflight = new Map();
  let sweepTimer = null;

  function shouldSkipTransform(s) {
    const t = (s == null ? '' : String(s)).trim();
    if (!t) return true;
    if (/^data:/i.test(t) || /^blob:/i.test(t)) return true;
    return false;
  }

  function normalizeKey(resolvedUrl) {
    if (shouldSkipTransform(resolvedUrl)) return (resolvedUrl || '').trim();
    if (typeof window === 'undefined') return String(resolvedUrl).trim();
    try {
      return new URL(String(resolvedUrl).trim(), window.location.origin).href;
    } catch {
      return String(resolvedUrl).trim();
    }
  }

  function isCacheableByFetch(absoluteHref) {
    if (shouldSkipTransform(absoluteHref)) return false;
    if (typeof window === 'undefined') return false;
    try {
      const u = new URL(absoluteHref, window.location.origin);
      return u.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function sweepExpired() {
    const now = Date.now();
    for (const [key, v] of store.entries()) {
      if (v.expires > now) continue;
      try {
        URL.revokeObjectURL(v.objectUrl);
      } catch {
        /* ignore */
      }
      store.delete(key);
    }
  }

  function scheduleSweep() {
    if (sweepTimer != null) return;
    if (typeof window === 'undefined') return;
    sweepTimer = window.setInterval(() => {
      sweepExpired();
    }, 60_000);
  }

  /**
   * @param {string} resolvedUrl
   * @returns {Promise<string>}
   */
  async function getCachedObjectUrl(resolvedUrl) {
    const s = (resolvedUrl == null ? '' : String(resolvedUrl)).trim();
    if (!s) return '';

    if (shouldSkipTransform(s)) return s;

    const key = normalizeKey(s);
    if (!key) return s;

    if (!isCacheableByFetch(key)) {
      return s;
    }

    try {
      if (resolvedUrlUsesMediaProxyPath(s, { pathnames: mediaProxyPathnames })) {
        try {
          const absUrl = new URL(s, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
          const k = absUrl.searchParams.get('key') || '';
          if (onProxyDirectLog && /trolley|user_diy_3d|order\/|decal/i.test(k)) {
            onProxyDirectLog(k.slice(0, 140));
          }
        } catch { /* ignore */ }
        return s;
      }
    } catch {
      /* ignore */
    }

    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.expires > now) {
      return hit.objectUrl;
    }
    if (hit) {
      try {
        URL.revokeObjectURL(hit.objectUrl);
      } catch {
        /* ignore */
      }
      store.delete(key);
    }

    if (inflight.has(key)) {
      return inflight.get(key);
    }

    const p = (async () => {
      try {
        const abs = new URL(s, window.location.origin).href;
        const r = await fetch(abs, { credentials: 'include', cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const blob = await r.blob();
        const objectUrl = URL.createObjectURL(blob);
        store.set(key, {
          objectUrl,
          expires: Date.now() + ttlMs,
        });
        scheduleSweep();
        return objectUrl;
      } catch {
        return s;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, p);
    return p;
  }

  function __resetImageDisplayCacheForTests() {
    for (const [, v] of store.entries()) {
      try {
        URL.revokeObjectURL(v.objectUrl);
      } catch {
        /* ignore */
      }
    }
    store.clear();
    inflight.clear();
    if (sweepTimer != null && typeof window !== 'undefined') {
      window.clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }

  return { getCachedObjectUrl, __resetImageDisplayCacheForTests };
}
