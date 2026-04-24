-- 商品订单管理端补丁：adminRemark 列 + goods_order_logs 表
-- 老环境 GORM AutoMigrate 会自动补齐；此脚本用于手工兜底。

-- 1) goods_orders 增加管理员备注列（IF NOT EXISTS 仅 MySQL 8.0+ 可识别）
ALTER TABLE goods_orders
  ADD COLUMN IF NOT EXISTS adminRemark TEXT NULL;

-- 2) goods_order_logs 变更日志表
CREATE TABLE IF NOT EXISTS goods_order_logs (
  id INT NOT NULL AUTO_INCREMENT,
  orderId INT NOT NULL,
  changeType ENUM('status','price','admin_remark') NOT NULL,
  oldValue VARCHAR(500) DEFAULT NULL,
  newValue VARCHAR(500) DEFAULT NULL,
  operator VARCHAR(100) DEFAULT NULL,
  createdAt DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_goods_order_logs_orderId (orderId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
