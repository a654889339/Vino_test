// 兼容旧引用，实际逻辑在 cosMedia（与 Web 统一 URL 与缓存策略）
const cos = require('./cosMedia.js');
module.exports = { normalizeImageUrl: cos.normalizeImageUrl, resolveMediaUrl: cos.resolveMediaUrl };
