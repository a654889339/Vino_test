package db

import (
	"fmt"
	"log"

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

// MigrateSuperAdmin 幂等地：
//  1. 将 users.role 列 enum 扩展为 ('user','admin','super_admin')，兼容旧表结构；
//  2. 若当前无任何 super_admin，则把最早的 admin 自动升为 super_admin，避免
//     新功能上线后无人拥有超级权限。其余情况不改动任何用户数据。
func MigrateSuperAdmin() {
	if DB == nil {
		return
	}
	if err := DB.Exec("ALTER TABLE users MODIFY COLUMN role ENUM('user','admin','super_admin') NOT NULL DEFAULT 'user'").Error; err != nil {
		log.Printf("[Vino] MigrateSuperAdmin alter users.role: %v", err)
	}
	var n int64
	if err := DB.Model(&models.User{}).Where("role = ?", "super_admin").Count(&n).Error; err != nil {
		log.Printf("[Vino] MigrateSuperAdmin count super_admin: %v", err)
		return
	}
	if n > 0 {
		return
	}
	var first models.User
	if err := DB.Where("role = ?", "admin").Order("id ASC").First(&first).Error; err != nil {
		return
	}
	if err := DB.Model(&models.User{}).Where("id = ?", first.ID).Update("role", "super_admin").Error; err != nil {
		log.Printf("[Vino] MigrateSuperAdmin promote admin#%d: %v", first.ID, err)
		return
	}
	log.Printf("[Vino] MigrateSuperAdmin: user#%d (%s) promoted to super_admin", first.ID, first.Username)
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
