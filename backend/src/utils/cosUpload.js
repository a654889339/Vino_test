const COS = require('cos-nodejs-sdk-v5');

const Bucket = 'itsyourturnmy-1256887166';
const Region = 'ap-singapore';
const CosBaseUrl = `https://${Bucket}.cos.${Region}.myqcloud.com`;

const THUMB_MAX_WIDTH = 400;
const THUMB_JPEG_QUALITY = 82;
const SIGN_EXPIRES_SEC = parseInt(process.env.COS_SIGN_EXPIRES_SEC || '3600', 10);

let cosClient = null;

function getClient() {
  if (cosClient) return cosClient;
  const secretId = process.env.COS_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY;
  if (!secretId || !secretKey) {
    console.warn('[COS] Missing COS_SECRET_ID or COS_SECRET_KEY');
    return null;
  }
  cosClient = new COS({ SecretId: secretId, SecretKey: secretKey });
  return cosClient;
}

function isSigningEnabled() {
  return !!getClient();
}

/** 从完整 URL（可带签名参数）解析 object key */
function urlToKey(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u.startsWith(CosBaseUrl + '/')) return null;
  const q = u.indexOf('?');
  const base = q >= 0 ? u.slice(0, q) : u;
  const key = base.slice(CosBaseUrl.length).replace(/^\//, '');
  return key || null;
}

function isAlreadySignedCosUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.startsWith(CosBaseUrl + '/') &&
    url.includes('?') &&
    (url.includes('q-sign-algorithm=') || url.includes('signature=') || url.includes('q-ak='))
  );
}

/** 根据原图 URL 推导缩略图 URL（仅对本站 COS 地址有效，不含签名） */
function getThumbUrl(originalUrl) {
  if (!originalUrl || typeof originalUrl !== 'string') return null;
  const base = `${CosBaseUrl}/vino/uploads/`;
  if (!originalUrl.startsWith(base)) return null;
  const suffix = originalUrl.slice(base.length);
  if (!suffix || suffix.includes('thumb/')) return null;
  return `${CosBaseUrl}/vino/uploads/thumb/${suffix}`;
}

/** 判断 URL 是否为本 COS 桶的上传地址（可用于决定是否生成缩略图） */
function isCosUploadUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (isAlreadySignedCosUrl(url)) {
    const k = urlToKey(url);
    return !!(k && k.startsWith('vino/uploads/') && !k.includes('/vino/uploads/thumb/'));
  }
  return url.startsWith(CosBaseUrl + '/vino/uploads/') && !url.includes('/vino/uploads/thumb/');
}

/** 使用 sharp 生成缩略图 buffer（最大宽 maxWidth，保持比例） */
async function generateThumbBuffer(inputBuffer, contentType, maxWidth = THUMB_MAX_WIDTH) {
  try {
    const sharp = require('sharp');
    let pipeline = sharp(inputBuffer).resize(maxWidth, null, { withoutEnlargement: true });
    const lower = (contentType || '').toLowerCase();
    if (lower.includes('png')) {
      pipeline = pipeline.png({ compressionLevel: 6 });
      return { buffer: await pipeline.toBuffer(), contentType: 'image/png' };
    }
    if (lower.includes('webp')) {
      pipeline = pipeline.webp({ quality: 80 });
      return { buffer: await pipeline.toBuffer(), contentType: 'image/webp' };
    }
    pipeline = pipeline.jpeg({ quality: THUMB_JPEG_QUALITY });
    return { buffer: await pipeline.toBuffer(), contentType: 'image/jpeg' };
  } catch (e) {
    console.warn('[COS] generateThumbBuffer error:', e.message);
    return null;
  }
}

function getSignedUrlPromise(key) {
  return new Promise((resolve, reject) => {
    const client = getClient();
    if (!client) return resolve(null);
    client.getObjectUrl(
      {
        Bucket,
        Region,
        Key: key,
        Sign: true,
        Expires: SIGN_EXPIRES_SEC,
      },
      (err, data) => {
        if (err) return reject(err);
        resolve(data && data.Url ? data.Url : null);
      }
    );
  });
}

async function signUrlIfCosAsync(url) {
  if (!url || typeof url !== 'string') return url;
  if (isAlreadySignedCosUrl(url)) return url;
  const key = urlToKey(url);
  if (!key) return url;
  try {
    const signed = await getSignedUrlPromise(key);
    return signed || url;
  } catch (e) {
    console.warn('[COS] signUrlIfCosAsync:', e.message);
    return url;
  }
}

async function signCosUrlsDeepAsync(val, seen = new WeakSet()) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') return signUrlIfCosAsync(val);
  if (typeof val !== 'object') return val;
  if (seen.has(val)) return val;
  if (Array.isArray(val)) {
    seen.add(val);
    const out = await Promise.all(val.map((v) => signCosUrlsDeepAsync(v, seen)));
    for (let i = 0; i < val.length; i++) val[i] = out[i];
    return val;
  }
  seen.add(val);
  const keys = Object.keys(val);
  await Promise.all(
    keys.map(async (k) => {
      val[k] = await signCosUrlsDeepAsync(val[k], seen);
    })
  );
  return val;
}

function isKeyAllowedForProxy(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.includes('..') || key.includes('\\')) return false;
  return key.startsWith('vino/uploads/');
}

/** 已是本服务 COS 代理地址（避免重复替换） */
function isCosProxyApiUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /\/api\/media\/cos\?key=/.test(url);
}

/** 将本桶 COS 直链改为走服务端代理（小程序等对签名直链易 403，代理用密钥拉流） */
function toProxyUrlIfCos(req, url) {
  if (!url || typeof url !== 'string') return url;
  if (isCosProxyApiUrl(url)) return url;
  const key = urlToKey(url);
  if (!key || !isKeyAllowedForProxy(key)) return url;
  if (!getClient()) return url;
  // 必须用相对路径：经 Nginx 反代时 Host 常为「无端口」域名，拼成绝对 URL 会变成 :80，导致 404/拒连
  return `/api/media/cos?key=${encodeURIComponent(key)}`;
}

async function proxyCosUrlsDeepAsync(req, val, seen = new WeakSet()) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') return toProxyUrlIfCos(req, val);
  if (typeof val !== 'object') return val;
  if (seen.has(val)) return val;
  if (Array.isArray(val)) {
    seen.add(val);
    const out = await Promise.all(val.map((v) => proxyCosUrlsDeepAsync(req, v, seen)));
    for (let i = 0; i < val.length; i++) val[i] = out[i];
    return val;
  }
  seen.add(val);
  const keys = Object.keys(val);
  await Promise.all(
    keys.map(async (k) => {
      val[k] = await proxyCosUrlsDeepAsync(req, val[k], seen);
    })
  );
  return val;
}

/** 将 COS 对象输出给 HTTP 响应（私有桶读） */
function streamObjectToResponse(key, res) {
  const client = getClient();
  if (!client) {
    res.status(503).json({ code: 503, message: 'COS 未配置' });
    return;
  }
  client.getObject({ Bucket, Region, Key: key }, (err, data) => {
    if (err) {
      const code = err.statusCode === 403 || err.statusCode === 404 ? 404 : err.statusCode || 500;
      if (!res.headersSent) res.status(code).end();
      return;
    }
    const ct = data.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=300');
    const body = data.Body;
    if (Buffer.isBuffer(body)) {
      res.setHeader('Content-Length', body.length);
      res.end(body);
    } else if (body && typeof body.pipe === 'function') {
      body.pipe(res);
    } else {
      res.end(body);
    }
  });
}

/** 服务端下载 COS 对象（私有桶） */
function getObjectBuffer(key) {
  return new Promise((resolve, reject) => {
    const client = getClient();
    if (!client) return reject(new Error('COS not configured'));
    client.getObject({ Bucket, Region, Key: key }, (err, data) => {
      if (err) return reject(err);
      const body = data.Body;
      if (Buffer.isBuffer(body)) return resolve(body);
      if (body && typeof body.on === 'function') {
        const chunks = [];
        body.on('data', (c) => chunks.push(c));
        body.on('end', () => resolve(Buffer.concat(chunks)));
        body.on('error', reject);
        return;
      }
      resolve(Buffer.from(body));
    });
  });
}

function upload(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const client = getClient();
    if (!client) return reject(new Error('COS not configured'));
    const key = `vino/uploads/${filename}`;
    client.putObject(
      {
        Bucket,
        Region,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      },
      (err) => {
        if (err) return reject(err);
        resolve(`${CosBaseUrl}/${key}`);
      }
    );
  });
}

/** 上传到缩略图目录 vino/uploads/thumb/ */
function uploadThumb(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const client = getClient();
    if (!client) return reject(new Error('COS not configured'));
    const key = `vino/uploads/thumb/${filename}`;
    client.putObject(
      {
        Bucket,
        Region,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      },
      (err) => {
        if (err) return reject(err);
        resolve(`${CosBaseUrl}/${key}`);
      }
    );
  });
}

/** 上传原图并生成并上传缩略图，返回 { url, thumbUrl }；缩略图失败时 thumbUrl 为 null。opts.maxWidth 可指定缩略图最大宽（默认 400） */
async function uploadWithThumb(buffer, filename, contentType, opts = {}) {
  const url = await upload(buffer, filename, contentType);
  const thumbResult = await generateThumbBuffer(buffer, contentType, opts.maxWidth);
  let thumbUrl = null;
  if (thumbResult && thumbResult.buffer) {
    try {
      thumbUrl = await uploadThumb(thumbResult.buffer, filename, thumbResult.contentType);
    } catch (e) {
      console.warn('[COS] uploadThumb error:', e.message);
    }
  }
  return { url, thumbUrl };
}

module.exports = {
  upload,
  uploadThumb,
  uploadWithThumb,
  getThumbUrl,
  isCosUploadUrl,
  generateThumbBuffer,
  CosBaseUrl,
  urlToKey,
  getObjectBuffer,
  signCosUrlsDeepAsync,
  proxyCosUrlsDeepAsync,
  streamObjectToResponse,
  isKeyAllowedForProxy,
  isSigningEnabled,
};
