/**
 * 与后端 /api/media/cosRuleConfigVersion 及桶内 cosRuleConfigPath 联动：按间隔查版本，不一致时拉 YAML 合入 createMediaRuntimeStore。
 */
const STORAGE_KEY_LAST = 'rm_cosrule_ingested_ver';

/**
 * 将 *project* 替换为项目名，与 OSS 对象 key 的相对段一致（可带前导 /）。
 * @param {string} pathTemplate
 * @param {string} project
 */
export function expandCosRuleConfigPathTemplate(pathTemplate, project) {
  return String(pathTemplate || '').replace(/\*project\*/g, String(project || '').trim());
}

/**
 * @param {string} ossPublicBase
 * @param {string} pathTemplate
 * @param {string} project
 * @returns {string} 桶 HTTPS 可 GET 的 URL
 */
export function buildCosRuleConfigObjectUrl(ossPublicBase, pathTemplate, project) {
  const base = String(ossPublicBase || '').replace(/\/+$/, '');
  const rel = expandCosRuleConfigPathTemplate(pathTemplate, project).replace(/^\//, '');
  if (!base || !rel) return '';
  return `${base}/${rel}`;
}

/**
 * @param {object} options
 * @param {() => string} options.getApiBase  如 `() => (import.meta.env.VITE_API_BASE || '/api')`
 * @param {() => string} options.getOssPublicBase
 * @param {() => string} options.getPathTemplate
 * @param {() => string} options.getProject
 * @param {() => number} options.getCheckTimeSec
 * @param {() => number} [options.getDefaultLocalVersion]
 * @param {(doc: object) => void} options.ingestOssRuleConfigData
 * @returns {() => void}  取消轮询
 */
export function startCosRuleConfigSync(options) {
  if (typeof window === 'undefined' || !options || typeof options.ingestOssRuleConfigData !== 'function') {
    return () => {};
  }
  const {
    getApiBase = () => '/api',
    getOssPublicBase = () => '',
    getPathTemplate = () => '',
    getProject = () => '',
    getCheckTimeSec = () => 60,
    getDefaultLocalVersion = () => 0,
    ingestOssRuleConfigData,
  } = options;

  let tickRunning = false;

  function resolveVersionUrl() {
    const a = getApiBase();
    if (typeof a === 'string' && /^https?:\/\//i.test(a.trim())) {
      return `${a.replace(/\/$/, '')}/media/cosRuleConfigVersion`;
    }
    if (typeof location !== 'undefined') {
      const p = (a == null || a === '' ? '/api' : a).toString().replace(/\/$/, '');
      return `${location.origin}${p}/media/cosRuleConfigVersion`;
    }
    return null;
  }

  async function tick() {
    if (tickRunning) return;
    tickRunning = true;
    try {
      const vUrl = resolveVersionUrl();
      if (!vUrl) return;

      const r = await fetch(vUrl, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) return;
      const body = await r.json();
      const d = body && body.data;
      const serverV = d != null && d.cosRuleConfigVersion != null ? Number(d.cosRuleConfigVersion) : 0;
      if (!Number.isFinite(serverV)) return;

      let lastStr = null;
      try {
        lastStr = sessionStorage.getItem(STORAGE_KEY_LAST);
      } catch {
        /* ignore */
      }
      const lastV = lastStr == null || lastStr === '' ? Number(getDefaultLocalVersion() || 0) : Number(lastStr);
      if (Number.isFinite(lastV) && lastV === serverV) {
        return;
      }

      const base = (getOssPublicBase() || '').replace(/\/+$/, '');
      const p = getPathTemplate();
      const pr = getProject();
      const objectUrl = buildCosRuleConfigObjectUrl(base, p, pr);
      if (!objectUrl) return;

      const y = await fetch(objectUrl, { credentials: 'omit', cache: 'no-store' });
      if (!y.ok) return;
      const text = await y.text();
      let load;
      try {
        const mod = await import('js-yaml');
        load = mod.default && mod.default.load ? mod.default.load : mod.load;
      } catch {
        return;
      }
      const doc = load(text);
      if (!doc || typeof doc !== 'object') return;
      ingestOssRuleConfigData(doc);
      try {
        const ingestedV =
          doc.cosRuleConfigVersion != null ? Number(doc.cosRuleConfigVersion) : serverV;
        sessionStorage.setItem(STORAGE_KEY_LAST, String(Number.isFinite(ingestedV) ? ingestedV : serverV));
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore 网络/解析，下次 interval 重试 */
    } finally {
      tickRunning = false;
    }
  }

  let timer = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    const sec = Math.max(5, Number(getCheckTimeSec()) || 60);
    timer = setTimeout(async () => {
      try {
        await tick();
      } catch {
        /* ignore */
      }
      schedule();
    }, sec * 1000);
  };
  try {
    tick();
  } catch {
    /* ignore */
  }
  schedule();
  return () => {
    if (timer) clearTimeout(timer);
  };
}
