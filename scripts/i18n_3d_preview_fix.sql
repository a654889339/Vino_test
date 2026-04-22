-- 修复 3D 预览 i18n 被双重 UTF-8 编码的 zh 文本（强制覆盖）
-- 英文字段无 ASCII 以外字符，但 Loading/Unsupported 的 en 里的 "…" 也被双编码，一起修。

SET NAMES utf8mb4;

INSERT INTO i18n_texts (`key`, zh, en, createdAt, updatedAt) VALUES
  ('guideDetail.preview3D',            '3D 预览',                                 '3D Preview',                                                             NOW(), NOW()),
  ('guideDetail.preview3DTip',         '拖动旋转 / 双指缩放',                     'Drag to rotate / pinch to zoom',                                         NOW(), NOW()),
  ('guideDetail.preview3DLoading',     '3D 模型加载中…',                          'Loading 3D model…',                                                      NOW(), NOW()),
  ('guideDetail.preview3DUnsupported', '请在微信小程序或网页端查看商品 3D 预览',    'Please use the WeChat mini-program or the web to view the 3D preview.',  NOW(), NOW())
ON DUPLICATE KEY UPDATE
  zh = VALUES(zh),
  en = VALUES(en),
  updatedAt = NOW();
