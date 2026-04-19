const { Op } = require('sequelize');
const HomeConfig = require('../models/HomeConfig');
const { DeviceGuide } = require('../models');
const cosUpload = require('../utils/cosUpload');

/** 从 URL 下载图片 buffer（本桶 COS 走 SDK getObject，其它走 HTTP） */
async function fetchImageBuffer(url) {
  const key = cosUpload.urlToKey ? cosUpload.urlToKey(url) : null;
  if (key) {
    try {
      return await cosUpload.getObjectBuffer(key);
    } catch (e) {
      console.warn('[Admin] fetchImageBuffer COS getObject:', e.message);
      return null;
    }
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'Vino-Backend/1.0' } });
  if (!res.ok) return null;
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

/** 从 COS 原图 URL 提取文件名（任意 vino/* 内容目录） */
function filenameFromCosUrl(url) {
  const key = cosUpload.urlToKey(url);
  if (!key || key.includes('/thumb/')) return null;
  const last = key.lastIndexOf('/');
  return last >= 0 ? key.slice(last + 1) : key;
}

function contentPrefixFromCosUrl(url) {
  const key = cosUpload.urlToKey(url);
  if (!key || key.includes('/thumb/')) return null;
  const last = key.lastIndexOf('/');
  if (last < 0) return null;
  return key.slice(0, last);
}

/** 为已有图片批量生成缩略图并上传到 COS（仅处理本 COS 桶内的图片） */
exports.generateThumbs = async (req, res) => {
  try {
    const results = { processed: 0, failed: 0, skipped: 0 };
    const urlsToProcess = new Set();

    const guides = await DeviceGuide.findAll({
      attributes: ['id', 'iconUrl', 'coverImage', 'qrcodeUrl'],
    });
    for (const g of guides) {
      if (cosUpload.isCosUploadUrl(g.iconUrl)) urlsToProcess.add(g.iconUrl);
      if (cosUpload.isCosUploadUrl(g.coverImage)) urlsToProcess.add(g.coverImage);
      if (cosUpload.isCosUploadUrl(g.qrcodeUrl)) urlsToProcess.add(g.qrcodeUrl);
    }

    const homeConfigs = await HomeConfig.findAll({
      attributes: ['id', 'imageUrl'],
      where: { imageUrl: { [Op.ne]: '' } },
    });
    for (const h of homeConfigs) {
      if (h.imageUrl && cosUpload.isCosUploadUrl(h.imageUrl)) urlsToProcess.add(h.imageUrl);
    }

    for (const url of urlsToProcess) {
      const filename = filenameFromCosUrl(url);
      const prefix = contentPrefixFromCosUrl(url);
      if (!filename || !prefix) {
        results.skipped++;
        continue;
      }
      try {
        const buffer = await fetchImageBuffer(url);
        if (!buffer || buffer.length === 0) {
          results.skipped++;
          continue;
        }
        let contentType = 'image/jpeg';
        try {
          const sharp = require('sharp');
          const meta = await sharp(buffer).metadata();
          if (meta.format) contentType = 'image/' + meta.format;
        } catch (_) {}
        const thumbResult = await cosUpload.generateThumbBuffer(buffer, contentType);
        if (!thumbResult || !thumbResult.buffer) {
          results.skipped++;
          continue;
        }
        await cosUpload.uploadThumb(thumbResult.buffer, filename, thumbResult.contentType, prefix);
        results.processed++;
      } catch (e) {
        console.warn('[Admin] generateThumb failed for', url, e.message);
        results.failed++;
      }
    }

    res.json({
      code: 0,
      data: {
        message: `已处理 ${results.processed} 张缩略图，失败 ${results.failed}，跳过 ${results.skipped}`,
        ...results,
      },
    });
  } catch (e) {
    console.error('[Admin] generateThumbs error:', e.message);
    res.status(500).json({ code: 1, message: e.message || '生成缩略图失败' });
  }
};
