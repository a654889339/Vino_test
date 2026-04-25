package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"vino/backend/internal/audit"
	"vino/backend/internal/bootstrap"
	"vino/backend/internal/config"
	"vino/backend/internal/db"
	"vino/backend/internal/handlers"
	"vino/backend/internal/middleware"
	"vino/backend/internal/stat"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	if err := db.Connect(cfg); err != nil {
		log.Fatalf("[Vino] DB connect: %v", err)
	}
	if err := db.AutoMigrate(); err != nil {
		// 与已有 MySQL 表结构不完全一致时仅告警，避免进程退出（可手工对齐外键/列类型）
		log.Printf("[Vino] AutoMigrate: %v", err)
	}
	// 扩展 users.role enum 并在缺省时自动提升首个管理员为超级管理员
	db.MigrateSuperAdmin()
	if err := audit.Init(cfg.Log.BackendDir); err != nil {
		log.Printf("[Vino] audit log dir: %v", err)
	}
	if !cfg.COSConfigured() {
		log.Printf("[Vino] COS 密钥未就绪: 审计日志仅写本地目录 %s；配置 COS_SECRET_ID/COS_SECRET_KEY 并重启后可自动上云", cfg.Log.BackendDir)
	}
	audit.StartUploader(cfg)
	if err := stat.Init(cfg.Log.StatDir); err != nil {
		log.Printf("[Vino] stat log dir: %v", err)
	}
	stat.Record("system", map[string]interface{}{
		"source": "system",
		"action": "system.backend_start",
		"tables": []string{"schema_migrations", "users", "home_configs"},
		"status": "success",
	})
	stat.StartUploader(cfg)
	// 进程内整点 db 备份（60s tick，跨整点触发一次，键 db_save/{db}/YYYY-MM-DD/HH.sql.gz，TZ=Asia/Shanghai）
	handlers.StartHourlyDbBackup(cfg)
	if err := bootstrap.Run(); err != nil {
		stat.Record("system", map[string]interface{}{
			"source": "system",
			"action": "system.bootstrap",
			"status": "failed",
			"error":  err.Error(),
		})
		log.Fatalf("[Vino] bootstrap: %v", err)
	}
	stat.Record("system", map[string]interface{}{
		"source": "system",
		"action": "system.bootstrap",
		"status": "success",
		"tables": []string{"users", "i18n_texts", "product_categories", "service_categories", "home_configs", "services", "device_guides"},
	})

	if cfg.NodeEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	engine := gin.New()
	engine.Use(gin.Recovery())
	engine.Use(middleware.HTTPAuditLog())
	engine.Use(middleware.StatMutationLog())
	engine.Use(gin.Logger())
	engine.Use(cors.Default())
	engine.MaxMultipartMemory = 10 << 20

	// 微信支付回调：需在 JSON 解析之前保留原始 body（handler 内自行 ReadAll）
	engine.POST("/api/orders/wechat/notify", handlers.WechatPayNotify)

	handlers.RegisterRoutes(engine, cfg)

	uploadsDir := filepath.Join("public", "uploads")
	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		log.Printf("[Vino] mkdir uploads: %v", err)
	}
	engine.Static("/uploads", uploadsDir)
	engine.StaticFile("/", filepath.Join("static", "admin.html"))

	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Port)
	log.Printf("[Vino Backend] listening on http://%s", addr)
	if err := engine.Run(addr); err != nil {
		log.Fatal(err)
	}
}
