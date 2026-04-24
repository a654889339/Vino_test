-- 商品订单（购物车下单）

CREATE TABLE IF NOT EXISTS goods_orders (
  id INT NOT NULL AUTO_INCREMENT,
  orderNo VARCHAR(32) NOT NULL,
  userId INT NOT NULL,
  status ENUM('pending','paid','processing','completed','cancelled') DEFAULT 'pending',
  totalPrice DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT NULL,
  contactName VARCHAR(50) DEFAULT NULL,
  contactPhone VARCHAR(20) DEFAULT NULL,
  address VARCHAR(500) DEFAULT NULL,
  remark TEXT,
  createdAt DATETIME(3) DEFAULT NULL,
  updatedAt DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_goods_orders_orderNo (orderNo),
  KEY idx_goods_orders_userId_createdAt (userId, createdAt),
  KEY idx_goods_orders_status_createdAt (status, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goods_order_items (
  id INT NOT NULL AUTO_INCREMENT,
  orderId INT NOT NULL,
  guideId INT NOT NULL,
  nameSnapshot VARCHAR(200) DEFAULT NULL,
  imageUrl VARCHAR(500) DEFAULT NULL,
  unitPrice DECIMAL(10,2) DEFAULT 0,
  originPrice DECIMAL(10,2) DEFAULT NULL,
  currency VARCHAR(10) DEFAULT NULL,
  qty INT NOT NULL DEFAULT 1,
  lineTotal DECIMAL(10,2) DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_goods_order_items_orderId (orderId),
  KEY idx_goods_order_items_guideId (guideId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

