-- =========================================================================
-- 补齐小程序各页面导航栏标题相关的 i18n_texts，缺失 14 条。
-- 幂等：使用 ON DUPLICATE KEY UPDATE，只在 zh/en 都为空时才覆盖，避免误改已有翻译。
-- =========================================================================
USE vino_db;
SET NAMES utf8mb4;

-- 清理先前因字符集管道丢失中文的脏数据（如存在），再重新插入。
-- 匹配"全是问号"或"字符串中含 '?' 的" 的 zh（例如 'VINO ???'），避免 ON DUPLICATE 保留脏数据。
DELETE FROM i18n_texts WHERE `key` IN (
  'serviceDetail.stepsTitle','serviceDetail.step1','serviceDetail.step2','serviceDetail.step3','serviceDetail.step4','serviceDetail.step5',
  'mine.title','orders.title','products.title','index.title','service.title',
  'address.title','addressEdit.title','home.appTitle'
) AND zh LIKE '%?%';

INSERT INTO i18n_texts (`key`, zh, en, createdAt, updatedAt) VALUES
  ('serviceDetail.stepsTitle', '服务流程',      'Service Process',           NOW(), NOW()),
  ('serviceDetail.step1',      '提交预约',      'Submit booking',            NOW(), NOW()),
  ('serviceDetail.step2',      '客服确认',      'Contact confirmation',      NOW(), NOW()),
  ('serviceDetail.step3',      '上门服务',      'On-site service',           NOW(), NOW()),
  ('serviceDetail.step4',      '完成验收',      'Completion & acceptance',   NOW(), NOW()),
  ('serviceDetail.step5',      '反馈评价',      'Feedback & review',         NOW(), NOW()),
  ('mine.title',               '我的',          'Mine',                      NOW(), NOW()),
  ('orders.title',             '我的订单',      'My Orders',                 NOW(), NOW()),
  ('products.title',           'Vino 产品',     'Vino Products',             NOW(), NOW()),
  ('index.title',              'VINO 服务',     'VINO Services',             NOW(), NOW()),
  ('service.title',            '服务',          'Services',                  NOW(), NOW()),
  ('address.title',            '地址管理',      'Addresses',                 NOW(), NOW()),
  ('addressEdit.title',        '编辑地址',      'Edit Address',              NOW(), NOW()),
  ('home.appTitle',            'VINO 服务',     'VINO Services',             NOW(), NOW())
ON DUPLICATE KEY UPDATE
  zh = IF(TRIM(IFNULL(zh, '')) = '', VALUES(zh), zh),
  en = IF(TRIM(IFNULL(en, '')) = '', VALUES(en), en),
  updatedAt = NOW();

-- 核对：14 条 key 全部存在且 zh/en 非空
SELECT `key`, zh, en FROM i18n_texts
WHERE `key` IN (
  'serviceDetail.stepsTitle','serviceDetail.step1','serviceDetail.step2','serviceDetail.step3','serviceDetail.step4','serviceDetail.step5',
  'mine.title','orders.title','products.title','index.title','service.title',
  'address.title','addressEdit.title','home.appTitle'
)
ORDER BY `key`;
