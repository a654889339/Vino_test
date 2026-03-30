const cosUpload = require('../utils/cosUpload');

/** 私有 COS 读：通过后端密钥拉流，供小程序/H5 <img> 使用（避免直链签名 403） */
exports.streamCosObject = (req, res) => {
  let key = req.query.key;
  if (key == null || String(key).trim() === '') {
    return res.status(400).json({ code: 400, message: '缺少 key' });
  }
  try {
    key = decodeURIComponent(String(key).trim());
  } catch {
    return res.status(400).end();
  }
  if (!cosUpload.isKeyAllowedForProxy(key)) {
    return res.status(400).json({ code: 400, message: '非法 key' });
  }
  cosUpload.streamObjectToResponse(key, res);
};
