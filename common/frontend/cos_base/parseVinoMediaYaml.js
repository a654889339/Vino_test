/**
 * 轻量解析 Vino `vino.media.yaml` 子集（无完整 YAML 依赖），供 Web 打包 ?raw 与小程序 readFile 后使用。
 * 与 `common/config/cos/vino.media.yaml` 字段对齐。
 *
 * @param {string} yamlText
 * @returns {{
 *   project?: string,
 *   ossPublicBaseDefault: string,
 *   cosProxyAllowedPrefixes: string[],
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
    cosProxyAllowedPrefixes: [],
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

  const blockStart = text.match(/^\s*cosProxyAllowedPrefixes:\s*$/m);
  if (blockStart && blockStart.index != null) {
    const from = blockStart.index + blockStart[0].length;
    const rest = text.slice(from);
    const lines = rest.split(/\r?\n/);
    for (const line of lines) {
      if (/^\s*-\s+/.test(line)) {
        let item = line.replace(/^\s*-\s+/, '').trim();
        item = item.replace(/\s+#.*$/, '');
        if ((item.startsWith('"') && item.endsWith('"')) || (item.startsWith("'") && item.endsWith("'"))) {
          item = item.slice(1, -1);
        }
        if (item) out.cosProxyAllowedPrefixes.push(item);
        continue;
      }
      if (/^\s*\S+:\s*/.test(line) && !/^\s*-\s+/.test(line)) break;
    }
  }

  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseVinoMediaYamlDefaults,
  };
}
