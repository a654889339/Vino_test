package handlers

import (
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"vino/backend/internal/audit"
	"vino/backend/internal/config"
	"vino/backend/internal/resp"
	"vino/backend/internal/services"

	"github.com/gin-gonic/gin"
	// _ "github.com/go-sql-driver/mysql" 已在同 package 的 admin_db_ops.go 匿名导入
)

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

// POST /api/admin/ops/db-backup — 优先在 MySQL 官方容器内 mysqldump（兼容 caching_sha2_password），
// 回退到 backend 容器内本机 mysqldump（Alpine mysql-client 实为 MariaDB，仅作兜底）。gzip 后上传至 COS db_save/。
func adminPostDbBackup(c *gin.Context, cfg *config.Config) {
	if !cfg.COSConfigured() {
		resp.Err(c, 503, 503, "COS 未配置，无法上传数据库备份")
		return
	}
	start := time.Now()
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Minute)
	defer cancel()

	dumpArgs := []string{
		"-u" + cfg.DB.User,
		"--single-transaction",
		"--routines",
		"--events",
		"--set-gtid-purged=OFF",
		"--databases",
		cfg.DB.Name,
	}

	useDocker := false
	if _, statErr := os.Stat("/var/run/docker.sock"); statErr == nil {
		if _, lookErr := exec.LookPath("docker"); lookErr == nil {
			useDocker = true
		}
	}

	var cmd *exec.Cmd
	if useDocker {
		container := strings.TrimSpace(os.Getenv("MYSQL_DUMP_CONTAINER"))
		if container == "" {
			container = "vino-mysql"
		}
		args := append([]string{
			"exec",
			"-e", "MYSQL_PWD=" + cfg.DB.Password,
			container,
			"mysqldump",
		}, dumpArgs...)
		cmd = exec.CommandContext(ctx, "docker", args...)
	} else {
		if _, err := exec.LookPath("mysqldump"); err != nil {
			resp.Err(c, 503, 503, "未挂载 /var/run/docker.sock 且容器内未找到 mysqldump；请挂载 docker.sock（推荐，走 mysql:8.0 容器）或在镜像中安装兼容 caching_sha2 的 mysql-client")
			return
		}
		args := append([]string{
			"-h" + cfg.DB.Host,
			"-P" + fmt.Sprintf("%d", cfg.DB.Port),
		}, dumpArgs...)
		cmd = exec.CommandContext(ctx, "mysqldump", args...)
		var env []string
		for _, e := range os.Environ() {
			if strings.HasPrefix(e, "MYSQL_PWD=") {
				continue
			}
			env = append(env, e)
		}
		cmd.Env = append(env, "MYSQL_PWD="+cfg.DB.Password)
	}

	var sqlOut, sqlErr bytes.Buffer
	cmd.Stdout = &sqlOut
	cmd.Stderr = &sqlErr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(sqlErr.String())
		if len(msg) > 500 {
			msg = msg[:500] + "…"
		}
		if msg == "" {
			msg = err.Error()
		}
		if useDocker {
			resp.Err(c, 500, 500, "mysqldump(docker exec) 失败: "+msg)
		} else {
			resp.Err(c, 500, 500, "mysqldump 失败: "+msg)
		}
		return
	}
	if sqlOut.Len() == 0 {
		resp.Err(c, 500, 500, "mysqldump 输出为空")
		return
	}
	var gzBuf bytes.Buffer
	gw := gzip.NewWriter(&gzBuf)
	if _, err := gw.Write(sqlOut.Bytes()); err != nil {
		resp.Err(c, 500, 500, "gzip 压缩失败: "+err.Error())
		return
	}
	if err := gw.Close(); err != nil {
		resp.Err(c, 500, 500, "gzip 结束失败: "+err.Error())
		return
	}
	now := time.Now().In(time.Local)
	cosKey := fmt.Sprintf("db_save/%s/%s.sql.gz", now.Format("2006-01"), now.Format("02"))
	if err := services.PutBackupObject(ctx, cosKey, gzBuf.Bytes(), "application/gzip"); err != nil {
		resp.Err(c, 500, 500, "上传 COS 失败: "+err.Error())
		return
	}
	// 统计各表精确行数（在 mysqldump + 上传 COS 成功后进行，失败不影响主流程）。
	// 与 dump 略有「时间差」：备份瞬时用 --single-transaction 冻结一致性快照，
	// 此处 COUNT(*) 是当前在线库，二者极端场景可能相差极少量写入，作参考即可。
	tables, totalRows, tablesNote := collectTableRowCounts(ctx, cfg)
	elapsed := time.Since(start)
	resp.OK(c, gin.H{
		"cosKey":       cosKey,
		"bytes":        gzBuf.Len(),
		"sqlBytes":     sqlOut.Len(),
		"bucket":       services.CosBucket(),
		"database":     cfg.DB.Name,
		"elapsedMs":    elapsed.Milliseconds(),
		"elapsedHuman": elapsed.Truncate(time.Millisecond).String(),
		"tables":       tables,
		"tableCount":   len(tables),
		"totalRows":    totalRows,
		"tablesNote":   tablesNote,
		"message":      "ok",
	})
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
