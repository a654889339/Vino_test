package db

import (
	"fmt"

	"vino/backend/internal/config"
	"vino/backend/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(cfg *config.Config) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DB.User, cfg.DB.Password, cfg.DB.Host, cfg.DB.Port, cfg.DB.Name)
	var err error
	logLevel := logger.Silent
	if cfg.NodeEnv == "development" {
		logLevel = logger.Info
	}
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return err
	}
	return nil
}

// Reopen 关闭当前连接并基于 cfg 重新打开（用于主库切换）。调用方须确保在 dbgate 写锁内。
func Reopen(cfg *config.Config) error {
	if DB != nil {
		if sqlDB, err := DB.DB(); err == nil && sqlDB != nil {
			_ = sqlDB.Close()
		}
		DB = nil
	}
	return Connect(cfg)
}

func AutoMigrate() error {
	return DB.AutoMigrate(
		&models.User{},
		&models.OutletUser{},
		&models.Order{},
		&models.OrderLog{},
		&models.OutletOrder{},
		&models.OutletOrderLog{},
		&models.ServiceCategory{},
		&models.Service{},
		&models.ProductCategory{},
		&models.HomeConfig{},
		&models.DeviceGuide{},
		&models.Address{},
		&models.OutletAddress{},
		&models.Message{},
		&models.OutletMessage{},
		&models.InventoryCategory{},
		&models.InventoryProduct{},
		&models.UserProduct{},
		&models.OutletServiceCategory{},
		&models.OutletService{},
		&models.OutletHomeConfig{},
		&models.PageVisitDaily{},
		&models.I18nText{},
	)
}
