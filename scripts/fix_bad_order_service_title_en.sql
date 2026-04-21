-- =========================================================================
-- 修 services / orders 中残缺或错填的 serviceTitleEn。
-- 仅在目标字段为空或被填成明显错值（例如字面量 "English"）时覆写，
-- 保持幂等，不会影响真实已翻译的数据。
-- =========================================================================
USE vino_db;
SET NAMES utf8mb4;

-- 1) services.id=2 的 titleEn 之前被误填为字面量 "English"，按中文标题修正。
UPDATE services
SET titleEn = 'On-site Repair'
WHERE id = 2 AND (titleEn = 'English' OR titleEn IS NULL OR titleEn = '');

-- 2) orders 里对应 services 的 serviceTitleEn 也同步；先让 JOIN 回填刷一次。
UPDATE orders o
JOIN services s ON o.serviceId = s.id
SET o.serviceTitleEn = s.titleEn
WHERE (o.serviceTitleEn IS NULL OR o.serviceTitleEn = '' OR o.serviceTitleEn = 'English')
  AND s.titleEn IS NOT NULL AND s.titleEn <> '';

-- 3) 孤儿订单（serviceId 指向已删除的 service）按 serviceTitle(zh) 做固定映射。
UPDATE orders
SET serviceTitleEn = 'Device Repair'
WHERE (serviceTitleEn IS NULL OR serviceTitleEn = '')
  AND serviceTitle = '设备维修';

UPDATE orders
SET serviceTitleEn = 'Product List'
WHERE (serviceTitleEn IS NULL OR serviceTitleEn = '')
  AND serviceTitle = '产品列表';

UPDATE orders
SET serviceTitleEn = 'On-site Repair'
WHERE (serviceTitleEn IS NULL OR serviceTitleEn = '')
  AND serviceTitle = '上门维修';

-- 4) 校验：把最近几条订单打出来对比。
SELECT id, serviceId, serviceTitle AS zh, serviceTitleEn AS en
FROM orders
ORDER BY id DESC
LIMIT 20;

SELECT id, title AS zh, titleEn AS en FROM services ORDER BY id;
