-- Drop all existing foreign key constraints that cause Error 3780 during AutoMigrate.
-- The application uses GORM Preload (application-level joins), not DB-level FK enforcement.

ALTER TABLE orders DROP FOREIGN KEY orders_ibfk_13;
ALTER TABLE orders DROP FOREIGN KEY orders_ibfk_14;
ALTER TABLE addresses DROP FOREIGN KEY addresses_ibfk_1;
ALTER TABLE messages DROP FOREIGN KEY messages_ibfk_1;
ALTER TABLE inventory_products DROP FOREIGN KEY inventory_products_ibfk_1;
ALTER TABLE order_logs DROP FOREIGN KEY order_logs_ibfk_1;
ALTER TABLE outlet_addresses DROP FOREIGN KEY outlet_addresses_ibfk_1;
ALTER TABLE outlet_messages DROP FOREIGN KEY outlet_messages_ibfk_1;
ALTER TABLE outlet_order_logs DROP FOREIGN KEY outlet_order_logs_ibfk_1;
ALTER TABLE outlet_orders DROP FOREIGN KEY outlet_orders_ibfk_1;
ALTER TABLE outlet_services DROP FOREIGN KEY outlet_services_ibfk_1;
ALTER TABLE services DROP FOREIGN KEY services_ibfk_1;
ALTER TABLE user_products DROP FOREIGN KEY user_products_ibfk_1;
