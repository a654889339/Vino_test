package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"vino/backend/internal/bootstrap"
	"vino/backend/internal/config"
	"vino/backend/internal/db"
	"vino/backend/internal/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	if err := db.Connect(cfg); err != nil {
		log.Fatalf("[Vino] DB connect: %v", err)
	}
	if err := db.AutoMigrate(); err != nil {
		log.Fatalf("[Vino] AutoMigrate: %v", err)
	}
	if err := bootstrap.Run(); err != nil {
		log.Fatalf("[Vino] bootstrap: %v", err)
	}

	if cfg.NodeEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	engine := gin.New()
	engine.Use(gin.Recovery())
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
