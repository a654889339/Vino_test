const COS = require('cos-nodejs-sdk-v5');
const fs = require('fs');
const path = require('path');

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

const Bucket = 'itsyourturnmy-1256887166';
const Region = 'ap-singapore';

const files = [
  { local: 'frontend/public/logo.svg', remote: 'vino/logo.svg', type: 'image/svg+xml' },
  { local: 'frontend/public/favicon.svg', remote: 'vino/favicon.svg', type: 'image/svg+xml' },
];

async function upload(file) {
  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket,
      Region,
      Key: file.remote,
      Body: fs.createReadStream(path.resolve(__dirname, file.local)),
      ContentType: file.type,
    }, (err, data) => {
      if (err) {
        console.error(`[FAIL] ${file.remote}:`, err.message);
        reject(err);
      } else {
        const url = `https://${Bucket}.cos.${Region}.myqcloud.com/${file.remote}`;
        console.log(`[OK] ${file.remote} -> ${url}`);
        resolve(url);
      }
    });
  });
}

(async () => {
  console.log('Uploading to COS...');
  for (const f of files) {
    await upload(f);
  }
  console.log('Done!');
})();
