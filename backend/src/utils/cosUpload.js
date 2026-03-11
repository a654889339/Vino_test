const COS = require('cos-nodejs-sdk-v5');
const path = require('path');

const Bucket = 'itsyourturnmy-1256887166';
const Region = 'ap-singapore';
const CosBaseUrl = `https://${Bucket}.cos.${Region}.myqcloud.com`;

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

function upload(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const client = getClient();
    if (!client) return reject(new Error('COS not configured'));
    const key = `vino/uploads/${filename}`;
    client.putObject({
      Bucket,
      Region,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }, (err) => {
      if (err) return reject(err);
      resolve(`${CosBaseUrl}/${key}`);
    });
  });
}

module.exports = { upload, CosBaseUrl };
