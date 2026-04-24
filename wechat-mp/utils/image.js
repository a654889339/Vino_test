// 图片 URL 规范化：
// - 把指向后端 /uploads/xxx 的 http 地址自动改写到 COS https
// - 相对路径 /uploads/xxx 同样改写到 COS https
// - 其它 http 外链做 https 升级兜底
// - 未知的相对路径仍走 apiBase 拼接（保持旧行为）

const COS_BASE = 'https://itsyourturnmy-1256887166.cos.ap-singapore.myqcloud.com';

function normalizeImageUrl(u, apiBase) {
  if (!u || typeof u !== 'string') return '';
  const t = u.trim();
  if (!t) return '';

  if (t.startsWith('https://')) return t;

  if (t.startsWith('http://')) {
    const m = t.match(/\/uploads\/(.+)$/);
    if (m) return COS_BASE + '/vino/uploads/' + m[1];
    return t.replace(/^http:\/\//i, 'https://');
  }

  if (t.startsWith('/uploads/')) return COS_BASE + '/vino' + t;

  const base = (apiBase || '').replace(/\/api\/?$/, '');
  return base + (t.startsWith('/') ? t : '/' + t);
}

module.exports = { normalizeImageUrl };
