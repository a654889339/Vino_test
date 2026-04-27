/**
 * 轻量解析 Vino `vino.media.yaml` 子集（无完整 YAML 依赖），供 Web 打包 ?raw 与小程序 readFile 后使用。
 * 与 `common/config/cos/vino.media.yaml` 字段对齐。
 *
 * @param {string} yamlText
 * @returns {{
 *   project?: string,
 *   ossPublicBaseDefault: string,
 *   imageDisplayCacheTtlMs: number,
 *   mediaConfigTtlMs: number,
 *   cosRuleConfigPath?: string,
 *   cosRuleConfigVersion?: number,
 *   cosRuleConfigCheckTime?: number,
 * }}
 */
export function parseVinoMediaYamlDefaults(yamlText) {
  const text = String(yamlText || '');
  const out = {
    ossPublicBaseDefault: '',
    imageDisplayCacheTtlMs: 0,
    mediaConfigTtlMs: 0,
  };

  const scalar = (key) => {
    const re = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm');
    const m = text.match(re);
    if (!m) return '';
    let v = m[1].trim();
    v = v.replace(/\s+#.*$/, '');
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  };

  const numScalar = (key) => {
    const s = scalar(key);
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  out.project = scalar('project') || undefined;
  out.ossPublicBaseDefault = scalar('ossPublicBaseDefault').replace(/\/+$/, '');
  out.imageDisplayCacheTtlMs = numScalar('imageDisplayCacheTtlMs');
  out.mediaConfigTtlMs = numScalar('mediaConfigTtlMs');
  out.cosRuleConfigPath = scalar('cosRuleConfigPath') || undefined;
  const vVer = numScalar('cosRuleConfigVersion');
  if (vVer) out.cosRuleConfigVersion = vVer;
  const chk = numScalar('cosRuleConfigCheckTime');
  if (chk) out.cosRuleConfigCheckTime = chk;

  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseVinoMediaYamlDefaults,
  };
}
