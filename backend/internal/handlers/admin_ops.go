package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"shared/dbbase"
	"vino/backend/internal/audit"
	"vino/backend/internal/config"
	"vino/backend/internal/db"
	"vino/backend/internal/dbbackup"
	"vino/backend/internal/models"
	"vino/backend/internal/resp"
	"vino/backend/internal/services"
	"vino/backend/internal/stat"

	"github.com/gin-gonic/gin"
	// _ "github.com/go-sql-driver/mysql" 已在同 package 的 admin_db_ops.go 匿名导入
)

func loadDbBackupConfigForOps(project string) *dbbase.FileConfig {
	path := strings.TrimSpace(os.Getenv("DB_BACKUP_CONFIG"))
	if path == "" {
		path = filepath.Join("..", "common", "config", "db", project+".db.yaml")
	}
	fc, err := dbbase.LoadFileConfig(path)
	if err != nil {
		return nil
	}
	return fc
}

// dbTableCount 反映某张表精确行数；统计失败时 Rows=-1 并在 Note 说明。
type dbTableCount struct {
	Table string `json:"table"`
	Rows  int64  `json:"rows"`
	Note  string `json:"note,omitempty"`
}

// POST /api/admin/ops/audit-log-backup — 将已结束的整点审计日志批量上传 COS（与后台 uploader 规则一致）
func adminPostAuditLogBackup(c *gin.Context, cfg *config.Config) {
	if !cfg.COSConfigured() {
		resp.Err(c, 503, 503, "COS 未配置，无法上传审计日志")
		return
	}
	up, skip, failed := audit.FlushCompletedAuditLogs(cfg)
	msg := "ok"
	if len(failed) > 0 {
		msg = "部分文件上传失败: " + strings.Join(failed, ", ")
	}
	resp.OK(c, gin.H{
		"uploadedHours":      up,
		"skippedCurrentHour": skip,
		"failedFiles":        failed,
		"logDir":             audit.LogDir(),
		"message":            msg,
	})
}

// POST /api/admin/ops/stat-log-backup — 将已结束的整点打点日志按类型批量上传 COS。
func adminPostStatLogBackup(c *gin.Context, cfg *config.Config) {
	if !cfg.COSConfigured() {
		resp.Err(c, 503, 503, "COS 未配置，无法上传打点日志")
		return
	}
	up, skip, failed := stat.FlushCompletedStatLogs(cfg)
	msg := "ok"
	if len(failed) > 0 {
		msg = "部分文件上传失败: " + strings.Join(failed, ", ")
	}
	resp.OK(c, gin.H{
		"uploadedHours":      up,
		"skippedCurrentHour": skip,
		"failedFiles":        failed,
		"logDir":             stat.RootDir(),
		"message":            msg,
	})
}

// dbBackupResult 一次 db 备份的产物与计量信息；既用于 HTTP 响应，也用于后台调度器日志。
type dbBackupResult struct {
	CosKey       string
	Bytes        int
	SqlBytes     int
	Database     string
	Bucket       string
	ElapsedMs    int64
	ElapsedHuman string
	Tables       []dbTableCount
	TableCount   int
	TotalRows    int64
	TablesNote   string
}

// runDbBackupCore 执行一次「mysqldump → gzip → PutBackupObject → COUNT(*)」。
// cosKey 为空时使用默认「日路径」db_save/{dbname}/YYYY-MM/DD.sql.gz（手动触发）；
// 传入时原样使用（例如调度器的 db_save/{dbname}/YYYY-MM-DD/HH.sql.gz）。
func runDbBackupCore(ctx context.Context, cfg *config.Config, cosKey string, dumpMode string) (*dbBackupResult, error) {
	if !cfg.COSConfigured() {
		return nil, fmt.Errorf("COS 未配置，无法上传数据库备份")
	}
	start := time.Now()
	dbSeg := cfg.DB.Name
	if !dbNameIdent.MatchString(dbSeg) {
		return nil, fmt.Errorf("当前主库名不合法，拒绝写入 COS：%s", dbSeg)
	}

	override := strings.TrimSpace(cosKey)
	loc := audit.LogLocation()
	hour := time.Now().In(loc).Truncate(time.Hour)
	if override == "" {
		now := time.Now().In(loc)
		override = fmt.Sprintf("db_save/%s/%s/%s.sql.gz", dbSeg, now.Format("2006-01"), now.Format("02"))
	}

	put := func(ctx context.Context, key string, body []byte, contentType string) error {
		return services.PutBackupObject(ctx, key, body, contentType)
	}
	gzKey, gzLen, sqlLen, err := dbbase.RunHourlyBackup(ctx, dbbase.RunHourlyParams{
		DBHost: cfg.DB.Host, DBPort: cfg.DB.Port, DBUser: cfg.DB.User, DBPassword: cfg.DB.Password,
		DBName:            dbSeg,
		Location:          loc,
		Hour:              hour,
		ObjectKeyOverride: override,
		DumpMode:          dumpMode,
		ContainerName:     dbbackup.MysqlExecContainer(),
		Put:               put,
	})
	if err != nil {
		return nil, err
	}

	tables, totalRows, tablesNote := collectTableRowCounts(ctx, cfg)
	elapsed := time.Since(start)
	return &dbBackupResult{
		CosKey:       gzKey,
		Bytes:        gzLen,
		SqlBytes:     sqlLen,
		Database:     dbSeg,
		Bucket:       services.CosBucket(),
		ElapsedMs:    elapsed.Milliseconds(),
		ElapsedHuman: elapsed.Truncate(time.Millisecond).String(),
		Tables:       tables,
		TableCount:   len(tables),
		TotalRows:    totalRows,
		TablesNote:   tablesNote,
	}, nil
}

// POST /api/admin/ops/db-backup — 优先在 MySQL 官方容器内 mysqldump（支持 caching_sha2_password），
// 失败时改用 backend 容器内本机 mysqldump。gzip 后上传至 COS db_save/。
func adminPostDbBackup(c *gin.Context, cfg *config.Config) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Minute)
	defer cancel()
	fc := loadDbBackupConfigForOps("vino")
	dumpMode := ""
	if fc != nil {
		dumpMode = fc.Mysqldump.Mode
		dbbackup.SetMysqlDumpContainerFromYAML(fc.Mysqldump.ContainerName)
	}
	res, err := runDbBackupCore(ctx, cfg, "", dumpMode)
	if err != nil {
		// 503 vs 500 由错误内容里的关键字区分，保持与重构前对外行为一致
		msg := err.Error()
		if strings.Contains(msg, "COS 未配置") ||
			strings.Contains(msg, "未找到 mysqldump") ||
			strings.Contains(msg, "docker.sock") {
			resp.Err(c, 503, 503, msg)
			return
		}
		resp.Err(c, 500, 500, msg)
		return
	}
	resp.OK(c, gin.H{
		"cosKey":       res.CosKey,
		"bytes":        res.Bytes,
		"sqlBytes":     res.SqlBytes,
		"bucket":       res.Bucket,
		"database":     res.Database,
		"elapsedMs":    res.ElapsedMs,
		"elapsedHuman": res.ElapsedHuman,
		"tables":       res.Tables,
		"tableCount":   res.TableCount,
		"totalRows":    res.TotalRows,
		"tablesNote":   res.TablesNote,
		"message":      "ok",
	})
}

func AdminGetFeatureFlags(c *gin.Context) {
	// Return current flags (default if not set in DB).
	flags := services.GetFeatureFlags()
	resp.OK(c, gin.H{
		"maintenanceMode":        flags.MaintenanceMode,
		"enableRegister":         flags.EnableRegister,
		"enableCreateOrder":      flags.EnableCreateOrder,
		"enableCreateGoodsOrder": flags.EnableGoodsOrder,
		"enableCreateAddress":    flags.EnableCreateAddr,
		"updatedAtUnixMs":        flags.UpdatedAtUnixMs,
	})
}

func AdminPutFeatureFlags(c *gin.Context) {
	var body struct {
		MaintenanceMode     *bool `json:"maintenanceMode"`
		EnableRegister      *bool `json:"enableRegister"`
		EnableCreateOrder   *bool `json:"enableCreateOrder"`
		EnableGoodsOrder    *bool `json:"enableCreateGoodsOrder"`
		EnableCreateAddress *bool `json:"enableCreateAddress"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if db.DB == nil {
		resp.Err(c, 503, 503, "数据库未就绪")
		return
	}

	type kv struct {
		key   string
		value *bool
	}
	items := []kv{
		{services.FlagMaintenanceMode, body.MaintenanceMode},
		{services.FlagEnableRegister, body.EnableRegister},
		{services.FlagEnableCreateOrder, body.EnableCreateOrder},
		{services.FlagEnableGoodsOrder, body.EnableGoodsOrder},
		{services.FlagEnableCreateAddr, body.EnableCreateAddress},
	}

	for _, it := range items {
		if it.value == nil {
			continue
		}
		st := "inactive"
		if *it.value {
			st = "active"
		}
		// Upsert by (section, path) if unique index exists; otherwise do find+update/create.
		var row models.HomeConfig
		err := db.DB.Where("section = ? AND path = ?", services.FeatureFlagSection, it.key).First(&row).Error
		if err == nil {
			row.Status = st
			_ = db.DB.Save(&row).Error
			continue
		}
		// Create minimal row
		_ = db.DB.Create(&models.HomeConfig{
			Section:   services.FeatureFlagSection,
			Path:      it.key,
			Status:    st,
			SortOrder: 0,
			Title:     it.key,
			Desc:      "",
			Color:     "",
		}).Error
	}

	services.InvalidateFeatureFlags()
	resp.OKMsg(c, "ok")
}

// collectTableRowCounts 对 cfg.DB.Name 下所有 BASE TABLE 执行精确 COUNT(*)。
// 任何子步骤失败都**不**向上抛错：整张表 COUNT 失败记 -1 + Note；
// 连库/列表失败则返回空切片 + 顶层 tablesNote，确保备份主流程的响应 200 不被污染。
func collectTableRowCounts(ctx context.Context, cfg *config.Config) ([]dbTableCount, int64, string) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DB.User, cfg.DB.Password, cfg.DB.Host, cfg.DB.Port, cfg.DB.Name)
	d, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, 0, "open db: " + err.Error()
	}
	defer d.Close()

	cctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	rowsT, err := d.QueryContext(cctx,
		"SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
		cfg.DB.Name)
	if err != nil {
		return nil, 0, "list tables: " + err.Error()
	}
	var names []string
	for rowsT.Next() {
		var n string
		if err := rowsT.Scan(&n); err == nil {
			names = append(names, n)
		}
	}
	rowsT.Close()

	out := make([]dbTableCount, 0, len(names))
	var total int64
	for _, n := range names {
		// MySQL 标识符允许反引号本身，做转义以防注入（TABLE_SCHEMA 过滤已限制在本库，相对安全）
		esc := strings.ReplaceAll(n, "`", "``")
		var cnt int64
		if err := d.QueryRowContext(cctx, fmt.Sprintf("SELECT COUNT(*) FROM `%s`", esc)).Scan(&cnt); err != nil {
			out = append(out, dbTableCount{Table: n, Rows: -1, Note: err.Error()})
			continue
		}
		out = append(out, dbTableCount{Table: n, Rows: cnt})
		total += cnt
	}
	return out, total, ""
}
