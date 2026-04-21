-- =========================================================================
-- 历史订单回填 orders.serviceTitleEn：从 services.titleEn 取值。
-- 仅在 orders.serviceTitleEn 为空且 orders.serviceId 能匹配到 services 的情况下写入，
-- 保证幂等且不覆盖已有翻译。
-- =========================================================================
USE vino_db;
SET NAMES utf8mb4;

-- 查看将要被回填的订单数（便于部署前心里有数）
SELECT COUNT(*) AS to_backfill
FROM orders o
JOIN services s ON o.serviceId = s.id
WHERE (o.serviceTitleEn IS NULL OR o.serviceTitleEn = '')
  AND s.titleEn IS NOT NULL AND s.titleEn <> '';

-- 执行回填
UPDATE orders o
JOIN services s ON o.serviceId = s.id
SET o.serviceTitleEn = s.titleEn
WHERE (o.serviceTitleEn IS NULL OR o.serviceTitleEn = '')
  AND s.titleEn IS NOT NULL AND s.titleEn <> '';

-- 校验：随便看 20 条最近的订单
SELECT id, serviceId, LEFT(serviceTitle, 40) AS zh, LEFT(serviceTitleEn, 40) AS en
FROM orders
ORDER BY id DESC
LIMIT 20;
