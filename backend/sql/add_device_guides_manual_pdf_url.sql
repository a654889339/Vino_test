-- 商品 PDF 版说明书 URL（在部署后于 MySQL 中执行一次；若列已存在会报错，可忽略）
ALTER TABLE device_guides
  ADD COLUMN manualPdfUrl VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'PDF版说明书地址';
