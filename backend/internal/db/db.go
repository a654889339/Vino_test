package db

import (
	"fmt"
	"log"
	"strings"

	"vino/backend/internal/config"
	"vino/backend/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

const CurrentSchemaVersion = 1

func Connect(cfg *config.Config) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DB.User, cfg.DB.Password, cfg.DB.Host, cfg.DB.Port, cfg.DB.Name)
	var err error
	logLevel := logger.Silent
	if cfg.NodeEnv == "development" {
		logLevel = logger.Info
	}
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logLevel),
		DisableForeignKeyConstraintWhenMigrating: true,
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

type VersionColumnMigrationResult struct {
	CheckedTables []string
	AddedTables   []string
	FailedTables  map[string]string
}

// MigrateVersionColumns ensures every physical table in the current database
// has a row-level version column. The migration is intentionally additive and
// idempotent: existing rows receive version=0 via the column default.
func MigrateVersionColumns() VersionColumnMigrationResult {
	result := VersionColumnMigrationResult{FailedTables: map[string]string{}}
	if DB == nil {
		return result
	}
	var tables []string
	if err := DB.Raw(`SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME`).Scan(&tables).Error; err != nil {
		log.Printf("[Vino] MigrateVersionColumns list tables: %v", err)
		result.FailedTables["*"] = err.Error()
		return result
	}
	result.CheckedTables = tables
	for _, table := range tables {
		var count int64
		if err := DB.Raw(`SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'version'`, table).Scan(&count).Error; err != nil {
			log.Printf("[Vino] MigrateVersionColumns inspect %s: %v", table, err)
			result.FailedTables[table] = err.Error()
			continue
		}
		if count > 0 {
			continue
		}
		escapedTable := strings.ReplaceAll(table, "`", "``")
		if err := DB.Exec("ALTER TABLE `" + escapedTable + "` ADD COLUMN `version` INT NOT NULL DEFAULT 0").Error; err != nil {
			log.Printf("[Vino] MigrateVersionColumns add %s.version: %v", table, err)
			result.FailedTables[table] = err.Error()
			continue
		}
		result.AddedTables = append(result.AddedTables, table)
	}
	if len(result.AddedTables) > 0 {
		log.Printf("[Vino] MigrateVersionColumns added version to tables: %s", strings.Join(result.AddedTables, ","))
	}
	return result
}

func AutoMigrate() error {
	ents := ManagedModelEntities()
	if len(ents) == 0 {
		return nil
	}
	return DB.AutoMigrate(ents...)
}
