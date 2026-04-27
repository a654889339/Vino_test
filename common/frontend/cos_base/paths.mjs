/** @typedef {{ proxyPath: string, getPrefixes?: () => string[], prefixes?: string[] }} ToProxyUrlOpts */

const MAX_OVER_ENCODE_DECODE = 8;

/** 循环 decodeURIComponent 直至稳定，修复路径中对 / 的多次 encode（%252F…） */
export function normalizeOverEncodedPath(seg) {
  let s = (seg == null ? '' : String(seg)).trim();
  for (let i = 0; i < MAX_OVER_ENCODE_DECODE; i++) {
    try {
      const dec = decodeURIComponent(s);
      if (dec === s) break;
      s = dec;
    } catch {
      break;
    }
  }
  return s;
}

/**
 * @param {string} pathOrUrl
 * @param {string[]} prefixes
 */
export function extractObjectKey(pathOrUrl, prefixes) {
  let p = normalizeOverEncodedPath(
    (pathOrUrl == null ? '' : String(pathOrUrl)).trim().replace(/^\/+/, ''),
  );
  for (const prefix of prefixes) {
    const i = p.indexOf(prefix);
    if (i >= 0) return p.slice(i);
  }
  return p;
}

function resolvePrefixes(opts) {
  if (opts.getPrefixes && typeof opts.getPrefixes === 'function') return opts.getPrefixes() || [];
  return Array.isArray(opts.prefixes) ? opts.prefixes : [];
}

/**
 * 把桶公网 URL / 路径转成同源媒体代理 ?key=（proxyPath 如 /api/media/oss 或 /api/media/cos）。
 * @param {string|null|undefined} u
 * @param {ToProxyUrlOpts} opts
 */
export function toProxyUrl(u, opts) {
  const proxyPath = (opts && opts.proxyPath) || '/api/media/oss';
  const prefixes = resolvePrefixes(opts);
  const s = (u == null ? '' : String(u)).trim();
  if (!s) return '';

  const mediaTail = proxyPath.replace(/^\/api\/media\//i, '');
  const headRe = new RegExp(`^/?api/media/${mediaTail}`, 'i');
  if (headRe.test(s)) return s;

  if (s.includes(`/api/media/${mediaTail}`)) {
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'http://x';
      const url = new URL(s, base);
      const k = url.searchParams.get('key');
      if (k) {
        const key = extractObjectKey(k, prefixes);
        if (key && prefixes.some((p) => key.startsWith(p)))
          return `${proxyPath}?key=${encodeURIComponent(key)}`;
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://x';
    const url = new URL(s, base);
    const key = extractObjectKey(url.pathname, prefixes);
    if (!key) return s;
    const allowed = prefixes.some((p) => key.startsWith(p));
    if (!allowed) return s;
    return `${proxyPath}?key=${encodeURIComponent(key)}`;
  } catch {
    return s;
  }
}

/**
 * 将允许前缀的 OSS 公网/路径 URL 转为桶直链（不经由 /api/media/* 代理）。
 * @param {string|null|undefined} u
 * @param {{ getPublicBase: () => string, getPrefixes?: () => string[], prefixes?: string[] }} opts
 * @returns {string}
 */
export function toDirectStorageUrl(u, opts) {
  const publicBase = (opts && opts.getPublicBase && opts.getPublicBase()) || '';
  const base = String(publicBase).trim().replace(/\/+$/, '');
  if (!base) return '';
  const prefixes = resolvePrefixes(opts || {});
  const s = (u == null ? '' : String(u)).trim();
  if (!s) return '';

  const mediaTails = ['oss', 'cos'];
  for (const tail of mediaTails) {
    if (s.includes(`/api/media/${tail}`)) {
      try {
        const url = new URL(s, typeof window !== 'undefined' ? window.location.origin : 'http://x');
        const k = url.searchParams.get('key');
        if (k) {
          const key = extractObjectKey(k, prefixes);
          if (key && prefixes.some((p) => key.startsWith(p)))
            return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
        }
      } catch {
        /* ignore */
      }
    }
  }
  try {
    const url = new URL(s, typeof window !== 'undefined' ? window.location.origin : 'http://x');
    const key = extractObjectKey(url.pathname, prefixes);
    if (!key) return s;
    if (!prefixes.some((p) => key.startsWith(p))) return s;
    return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  } catch {
    return s;
  }
}

/** 支持 http(s)、//、相对路径 */
export function resolveMediaUrl(u) {
  const s = (u == null ? '' : String(u)).trim();
  if (!s) return '';
  if (/^(https?:)?\/\//i.test(s)) return s;
  if (s.startsWith('/')) return s;
  return '/' + s;
}

/**
 * @param {string} resolvedUrl
 * @param {{ pathnames?: string[] }} [opts]
 */
export function resolvedUrlUsesMediaProxyPath(resolvedUrl, opts) {
  const pathnames = (opts && opts.pathnames) || ['/api/media/oss'];
  try {
    const absPath = new URL(
      resolvedUrl,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
    ).pathname;
    return pathnames.some((p) => absPath === p || absPath.endsWith(p));
  } catch {
    return false;
  }
}

