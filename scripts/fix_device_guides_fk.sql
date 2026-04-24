-- Drop the incompatible foreign key so AutoMigrate can ALTER the table freely.
-- The application uses GORM Preload (not DB-level FK) for the Category join.
ALTER TABLE device_guides DROP FOREIGN KEY device_guides_ibfk_1;
