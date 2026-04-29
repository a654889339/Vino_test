/**
 * 统一编排媒体缓存失效与周期清理，避免业务页面重复接入。
 */
const cacheRefs = {
  image: null,
  proxy: null,
  path: null,
};

let janitorTimer = null;

export function registerMediaCaches({ image, proxy, path } = {}) {
  if (image) cacheRefs.image = image;
  if (proxy) cacheRefs.proxy = proxy;
  if (path) cacheRefs.path = path;
}

export function startMediaCacheJanitor(options = {}) {
  if (janitorTimer != null) return;
  const ms = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : 30_000;
  janitorTimer = setInterval(() => {
    try {
      cacheRefs.image && typeof cacheRefs.image.sweepExpired === 'function' && cacheRefs.image.sweepExpired();
    } catch {
      /* ignore */
    }
    try {
      cacheRefs.proxy && typeof cacheRefs.proxy.prune === 'function' && cacheRefs.proxy.prune();
    } catch {
      /* ignore */
    }
    try {
      cacheRefs.path && typeof cacheRefs.path.sweepExpired === 'function' && cacheRefs.path.sweepExpired();
    } catch {
      /* ignore */
    }
  }, ms);
}

export function stopMediaCacheJanitor() {
  if (janitorTimer == null) return;
  clearInterval(janitorTimer);
  janitorTimer = null;
}

export function invalidateCachesForCosArtifact({ publicUrl, proxyUrl, objectKey, rawUrl } = {}) {
  const image = cacheRefs.image;
  const proxy = cacheRefs.proxy;
  const path = cacheRefs.path;

  if (image && typeof image.invalidateByUrl === 'function') {
    if (publicUrl) image.invalidateByUrl(publicUrl);
    if (proxyUrl) image.invalidateByUrl(proxyUrl);
    if (rawUrl) image.invalidateByUrl(rawUrl);
  }

  if (proxy) {
    if (proxyUrl && typeof proxy.invalidateByAbsProxyUrl === 'function') proxy.invalidateByAbsProxyUrl(proxyUrl);
    if (objectKey && typeof proxy.invalidateByObjectKey === 'function') proxy.invalidateByObjectKey(objectKey);
    if (publicUrl && typeof proxy.invalidateByPublicUrl === 'function') proxy.invalidateByPublicUrl(publicUrl);
  }

  if (path && typeof path.invalidateUrl === 'function') {
    if (publicUrl) path.invalidateUrl(publicUrl);
    if (proxyUrl) path.invalidateUrl(proxyUrl);
    if (rawUrl) path.invalidateUrl(rawUrl);
  }
}

