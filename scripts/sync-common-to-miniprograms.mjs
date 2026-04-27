/**
 * 将 common/config 与 common/frontend 复制到各小程序根目录下的 common/，
 * 满足「打包进包」后 require(cos_base) 与 readFile(vino.media.yaml) 路径一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcCommon = path.join(root, 'common');

const targets = ['wechat-mp', 'alipay-mp'];

function cpDir(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

const srcCatalog = path.join(root, 'backend', 'internal', 'configdata', 'media_asset_catalog.json');
for (const dir of targets) {
  const destRoot = path.join(root, dir, 'common');
  if (!fs.existsSync(path.join(root, dir))) {
    console.warn('[sync-common] skip missing:', dir);
    continue;
  }
  fs.rmSync(destRoot, { recursive: true, force: true });
  fs.mkdirSync(destRoot, { recursive: true });
  cpDir(path.join(srcCommon, 'config'), path.join(destRoot, 'config'));
  cpDir(path.join(srcCommon, 'frontend'), path.join(destRoot, 'frontend'));
  if (fs.existsSync(srcCatalog)) {
    const destCat = path.join(destRoot, 'config', 'cos', 'media_asset_catalog.json');
    fs.mkdirSync(path.dirname(destCat), { recursive: true });
    fs.copyFileSync(srcCatalog, destCat);
  }
  console.log('[sync-common] ->', path.relative(root, destRoot));
}
