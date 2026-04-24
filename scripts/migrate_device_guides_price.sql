-- DeviceGuide 商品价格字段（购物车/商品订单）
-- 说明：本项目 DB 字段采用驼峰（如 coverImage / model3dUrl），因此这里也用 listPrice/originPrice/currency

ALTER TABLE device_guides
  ADD COLUMN listPrice DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER sortOrder,
  ADD COLUMN originPrice DECIMAL(10,2) NULL AFTER listPrice,
  ADD COLUMN currency VARCHAR(10) NULL AFTER originPrice;

