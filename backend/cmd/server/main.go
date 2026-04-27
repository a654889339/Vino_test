package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"vino/backend/internal/audit"
	"vino/backend/internal/bootstrap"
	"vino/backend/internal/config"
	"vino/backend/internal/db"
	"vino/backend/internal/handlers"
	"vino/backend/internal/middleware"
	"vino/backend/internal/models"
	"vino/backend/internal/services"
	"vino/backend/internal/stat"
	"vino/backend/internal/vinomediacfg"

	"shared/dbbase"
	"shared/logbase"
	"shared/statbase"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func resolveDbBackupConfigPath() string {
	if p := strings.TrimSpace(os.Getenv("DB_BACKUP_CONFIG")); p != "" {
		return p
	}
	def := filepath.Join("..", "common", "config", "db", "vino.db.yaml")
	if _, err := os.Stat(def); err == nil {
		return def
	}
	return ""
}

func resolveLogHourlyConfigPath() string {
	if p := strings.TrimSpace(os.Getenv("LOG_HOURLY_CONFIG")); p != "" {
		return p
	}
	def := filepath.Join("..", "common", "config", "log", "vino.log.yaml")
	if _, err := os.Stat(def); err == nil {
		return def
	}
	return ""
}

func resolveStatHourlyConfigPath() string {
	if p := strings.TrimSpace(os.Getenv("STAT_HOURLY_CONFIG")); p != "" {
		return p
	}
	def := filepath.Join("..", "common", "config", "stat", "vino.stat.yaml")
	if _, err := os.Stat(def); err == nil {
		return def
	}
	return ""
}

func resolveVinoMediaConfigPath() string {
	if p := strings.TrimSpace(os.Getenv("VINO_MEDIA_CONFIG")); p != "" {
		return p
	}
	return filepath.Join("..", "common", "config", "cos", "vino.media.yaml")
}

func resolveSchemaColumnsConfigPath(project string) string {
	if p := strings.TrimSpace(os.Getenv("DB_SCHEMA_COLUMNS_CONFIG")); p != "" {
		return p
	}
	return filepath.Join("..", "common", "config", "db", project+".schema.columns.yaml")
}

func main() {
	cfg := config.Load()
	if err := vinomediacfg.Load(resolveVinoMediaConfigPath()); err != nil {
		log.Fatalf("[Vino] vino media config: %v", err)
	}
	services.InitPhoneVerifyService(cfg)
	logFC, err := logbase.LoadFileConfig(resolveLogHourlyConfigPath())
	if err != nil {
		log.Fatalf("[Vino] log hourly config: %v", err)
	}
	logR, err := logbase.Resolve(logFC, cfg.Log.BackendDir)
	if err != nil {
		log.Fatalf("[Vino] log hourly resolve: %v", err)
	}
	audit.SetLogHourlyResolved(logR)
	if err := audit.Init(logR.LocalDir, logR.Location); err != nil {
		log.Printf("[Vino] audit log dir: %v", err)
	}
	statFC, err := statbase.LoadFileConfig(resolveStatHourlyConfigPath())
	if err != nil {
		log.Fatalf("[Vino] stat hourly config: %v", err)
	}
	statR, err := statbase.Resolve(statFC, cfg.Log.StatDir)
	if err != nil {
		log.Fatalf("[Vino] stat hourly resolve: %v", err)
	}
	stat.SetStatHourlyResolved(statR)
	if err := stat.Init(statR.LocalDir, statR.Location); err != nil {
		log.Printf("[Vino] stat log dir: %v", err)
	}

	if err := dbbase.RunSteps("vino", []dbbase.Step{
		{Name: "db.connect", Fatal: true, Run: func() error { return db.Connect(cfg) }},
		{Name: "db.schema.validate_columns", Fatal: true, Run: func() error {
			sqlDB, err := db.DB.DB()
			if err != nil || sqlDB == nil {
				if err != nil {
					return err
				}
				return fmt.Errorf("db.DB.DB() nil")
			}
			expPath := resolveSchemaColumnsConfigPath("vino")
			if _, err := os.Stat(expPath); err != nil {
				return fmt.Errorf("schema columns yaml missing: %s", expPath)
			}
			exp, err := dbbase.LoadSchemaColumnsYAML(expPath)
			if err != nil {
				return err
			}
			act, err := dbbase.ExportInformationSchemaColumns("vino", sqlDB)
			if err != nil {
				return err
			}
			return dbbase.CompareSchemaColumns(exp, act)
		}},
		{Name: "db.ensure_schema", Fatal: true, Run: func() error {
			schemaDiff, err := db.EnsureAppSchema()
			if err != nil {
				return err
			}
			if schemaDiff != nil {
				dn := schemaDiff.Database
				for _, t := range schemaDiff.NewTables {
					stat.Record("db_add", map[string]interface{}{
						"source": "db", "action": "db_add", "database": dn, "table": t,
					})
				}
				for _, c := range schemaDiff.ColumnsOnExisting {
					stat.Record("db_modify", map[string]interface{}{
						"source": "db", "action": "db_modify", "database": dn, "table": c.Table, "column": c.Column, "reason": "column_added",
					})
				}
			}
			return nil
		}},
		{Name: "db.backfill_cart_items", Fatal: false, Run: func() error {
			var cartItemRows int64
			if err := db.DB.Model(&models.CartItem{}).Count(&cartItemRows).Error; err == nil && cartItemRows == 0 {
				log.Printf("[Vino] cart_items 为空，从 users.cartJson 回填…")
				handlers.BackfillCartItemsForAllUsers()
			}
			return nil
		}},
		{Name: "db.migrate_super_admin", Fatal: false, Run: func() error { db.MigrateSuperAdmin(); return nil }},
		{Name: "db.version_columns", Fatal: false, Run: func() error {
			versionMigration := db.MigrateVersionColumns()
			if len(versionMigration.AddedTables) > 0 {
				var dname string
				_ = db.DB.Raw("SELECT DATABASE()").Scan(&dname)
				for _, t := range versionMigration.AddedTables {
					stat.Record("db_modify", map[string]interface{}{
						"source": "db", "action": "db_modify", "database": dname, "table": t, "column": "version", "reason": "version_column_backfill",
					})
				}
			}
			versionMigrationStatus := "success"
			if len(versionMigration.FailedTables) > 0 {
				versionMigrationStatus = "failed"
			}
			stat.Record("system", map[string]interface{}{
				"source":        "system",
				"action":        "system.schema.version_columns",
				"tables":        versionMigration.CheckedTables,
				"addedTables":   versionMigration.AddedTables,
				"failedTables":  versionMigration.FailedTables,
				"checkedCount":  len(versionMigration.CheckedTables),
				"addedCount":    len(versionMigration.AddedTables),
				"failedCount":   len(versionMigration.FailedTables),
				"schemaVersion": db.CurrentSchemaVersion,
				"status":        versionMigrationStatus,
			})
			return nil
		}},
	}, nil); err != nil {
		log.Fatalf("[Vino] %v", err)
	}
	if !cfg.COSConfigured() {
		log.Printf("[Vino] COS 密钥未就绪: 审计日志仅写本地目录 %s；配置 COS_SECRET_ID/COS_SECRET_KEY 并重启后可自动上云", audit.LogDir())
	}
	audit.StartUploader(cfg)
	stat.Record("system", map[string]interface{}{
		"source": "system",
		"action": "system.backend_start",
		"tables": []string{"schema_migrations", "users", "home_configs"},
		"status": "success",
	})
	stat.StartUploader(cfg)
	fc, err := dbbase.LoadFileConfig(resolveDbBackupConfigPath())
	if err != nil {
		log.Fatalf("[Vino] db backup config: %v", err)
	}
	sched, errSched := dbbase.ResolveScheduler(fc)
	if errSched != nil {
		log.Fatalf("[Vino] db backup scheduler: %v", errSched)
	}
	if err := dbbase.SelfCheckMysqldump(sched.DumpMode, sched.ContainerName); err != nil {
		log.Fatalf("[Vino] db backup mysqldump selfcheck: %v", err)
	}
	handlers.StartDbBackupScheduler(cfg, sched, fc)
	if err := dbbase.RunSteps("vino", []dbbase.Step{
		{Name: "bootstrap.run", Fatal: true, Run: func() error {
			if err := bootstrap.Run(); err != nil {
				stat.Record("system", map[string]interface{}{
					"source": "system",
					"action": "system.bootstrap",
					"status": "failed",
					"error":  err.Error(),
				})
				return err
			}
			stat.Record("system", map[string]interface{}{
				"source": "system",
				"action": "system.bootstrap",
				"status": "success",
				"tables": []string{"users", "i18n_texts", "product_categories", "service_categories", "home_configs", "services", "device_guides"},
			})
			return nil
		}},
	}, nil); err != nil {
		log.Fatalf("[Vino] bootstrap: %v", err)
	}

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
	engine.POST("/api/orders/wechat/notify", func(c *gin.Context) { handlers.WechatPayNotify(c, cfg) })

	handlers.RegisterRoutes(engine, cfg)

	uploadsDir := filepath.Join("public", "uploads")
	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		log.Printf("[Vino] mkdir uploads: %v", err)
	}
	engine.Static("/uploads", uploadsDir)
	serveAdminHTML := func(c *gin.Context) {
		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.File(filepath.Join("static", "admin.html"))
	}
	engine.GET("/", serveAdminHTML)
	engine.GET("/datamgr", serveAdminHTML)

	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Port)
	log.Printf("[Vino Backend] listening on http://%s", addr)
	if err := engine.Run(addr); err != nil {
		log.Fatal(err)
	}
}
