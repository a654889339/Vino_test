/**
 * 运行时媒体配置：sessionStorage + 定时重拉（与 R-Melamine mediaRuntimeConfig 行为一致）。
 * @param {{
 *   storageKey: string,
 *   configUrlPath: string,
 *   getFallbackDefaults: () => object,
 *   mergeRemote: (remote: object, fallbackDefaults: object) => object,
 * }} options
 */
export function createMediaRuntimeStore(options) {
  const { storageKey, configUrlPath, getFallbackDefaults, mergeRemote } = options;

  /** @type {{ merged: object, fetchedAt: number } | null} */
  let memory = null;

  function readSession() {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || typeof o.fetchedAt !== 'number' || !o.merged) return null;
      return o;
    } catch {
      return null;
    }
  }

  function writeSession(merged, fetchedAt) {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ merged, fetchedAt }));
    } catch {
      /* ignore quota */
    }
  }

  function effectiveTtlMs(merged) {
    const n = Number(merged?.mediaConfigTtlMs ?? merged?.imageDisplayCacheTtlMs);
    if (n > 0) return n;
    const fb = getFallbackDefaults();
    return Number(fb.mediaConfigTtlMs) || 300000;
  }

  function hydrateFromStorage() {
    if (memory) return;
    const s = readSession();
    if (!s) return;
    const ttl = effectiveTtlMs(s.merged);
    if (Date.now() - s.fetchedAt < ttl) {
      memory = { merged: s.merged, fetchedAt: s.fetchedAt };
    }
  }

  function getCosProxyAllowedPrefixes() {
    hydrateFromStorage();
    const fb = getFallbackDefaults();
    if (memory?.merged?.cosProxyAllowedPrefixes?.length) {
      return memory.merged.cosProxyAllowedPrefixes;
    }
    return fb.cosProxyAllowedPrefixes || [];
  }

  function getOssPublicBase() {
    hydrateFromStorage();
    const fb = getFallbackDefaults();
    const b = memory?.merged?.ossPublicBase || fb.ossPublicBaseDefault || '';
    return String(b).replace(/\/+$/, '');
  }

  function getProductMediaRules() {
    hydrateFromStorage();
    const def = getFallbackDefaults().productMedia || {};
    const pm = memory?.merged?.productMedia;
    if (pm && typeof pm === 'object') {
      return {
        ...def,
        ...pm,
        mainPageStem: pm.mainPageStem || def.mainPageStem || 'main_page',
        mainPageExts: Array.isArray(pm.mainPageExts) && pm.mainPageExts.length ? pm.mainPageExts : (def.mainPageExts || []),
        dirPattern: pm.dirPattern || def.dirPattern || 'front_page_config/product/%d/',
      };
    }
    return {
      ...def,
      mainPageStem: def.mainPageStem || 'main_page',
      mainPageExts: Array.isArray(def.mainPageExts) && def.mainPageExts.length ? def.mainPageExts : ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      dirPattern: def.dirPattern || 'front_page_config/product/%d/',
    };
  }

  function getMediaConfigTtlMs() {
    hydrateFromStorage();
    return effectiveTtlMs(memory?.merged || {});
  }

  function getCosRuleConfigCheckTime() {
    hydrateFromStorage();
    const fb = getFallbackDefaults();
    const n = Number(memory?.merged?.cosRuleConfigCheckTime);
    if (n > 0) return n;
    return Number(fb.cosRuleConfigCheckTime) || 60;
  }

  function getProjectId() {
    hydrateFromStorage();
    const fb = getFallbackDefaults();
    const p = memory?.merged?.project;
    if (p != null && String(p).trim() !== '') return String(p).trim();
    return String(fb.project || '').trim();
  }

  function getCosRuleConfigPathTemplate() {
    hydrateFromStorage();
    const fb = getFallbackDefaults();
    const p = memory?.merged?.cosRuleConfigPath;
    if (p != null && String(p).trim() !== '') return String(p).trim();
    return String(fb.cosRuleConfigPath || '').trim();
  }

  async function refreshMediaConfig() {
    if (!configUrlPath) {
      const merged = mergeRemote({}, getFallbackDefaults());
      const fetchedAt = Date.now();
      memory = { merged, fetchedAt };
      writeSession(merged, fetchedAt);
      return merged;
    }
    const r = await fetch(configUrlPath, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const body = await r.json();
    const data = body && body.data != null ? body.data : body;
    const merged = mergeRemote(data == null ? {} : data, getFallbackDefaults());
    const fetchedAt = Date.now();
    memory = { merged, fetchedAt };
    writeSession(merged, fetchedAt);
    return merged;
  }

  async function ensureMediaRuntimeConfig() {
    hydrateFromStorage();
    const ttl = getMediaConfigTtlMs();
    if (memory && Date.now() - memory.fetchedAt < ttl) {
      return memory.merged;
    }
    try {
      return await refreshMediaConfig();
    } catch {
      const fallback = mergeRemote({}, getFallbackDefaults());
      memory = { merged: fallback, fetchedAt: Date.now() };
      return fallback;
    }
  }

  let intervalStarted = false;

  function startMediaConfigRefreshLoop() {
    if (intervalStarted || typeof window === 'undefined') return;
    intervalStarted = true;
    const tick = () => {
      ensureMediaRuntimeConfig().catch(() => {});
    };
    window.setInterval(tick, Math.max(30_000, getMediaConfigTtlMs()));
  }

  /**
   * 将 OSS 拉取并解析后的 plain object 经 mergeRemote 合入，并写 session；用于 cosRule 动态规则。
   * @param {object} remoteData
   */
  function ingestOssRuleConfigData(remoteData) {
    const merged = mergeRemote(remoteData == null ? {} : remoteData, getFallbackDefaults());
    const fetchedAt = Date.now();
    memory = { merged, fetchedAt };
    writeSession(merged, fetchedAt);
  }

  return {
    getCosProxyAllowedPrefixes,
    getOssPublicBase,
    getProductMediaRules,
    getMediaConfigTtlMs,
    getCosRuleConfigCheckTime,
    getProjectId,
    getCosRuleConfigPathTemplate,
    refreshMediaConfig,
    ensureMediaRuntimeConfig,
    startMediaConfigRefreshLoop,
    ingestOssRuleConfigData,
  };
}
