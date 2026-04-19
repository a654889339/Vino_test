package handlers

import (
	"bytes"
	"compress/gzip"
	"context"
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
)

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

// POST /api/admin/ops/db-backup — 容器内 mysqldump | gzip 后上传至 COS db_save/（与宿主机脚本对象键一致）
func adminPostDbBackup(c *gin.Context, cfg *config.Config) {
	if !cfg.COSConfigured() {
		resp.Err(c, 503, 503, "COS 未配置，无法上传数据库备份")
		return
	}
	if _, err := exec.LookPath("mysqldump"); err != nil {
		resp.Err(c, 503, 503, "容器内未找到 mysqldump，请在 backend 镜像中安装 mysql-client（与 MySQL 8 认证插件兼容）")
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Minute)
	defer cancel()
	args := []string{
		"-h" + cfg.DB.Host,
		"-P" + fmt.Sprintf("%d", cfg.DB.Port),
		"-u" + cfg.DB.User,
		"--single-transaction",
		"--routines",
		"--events",
		"--databases",
		cfg.DB.Name,
	}
	cmd := exec.CommandContext(ctx, "mysqldump", args...)
	var env []string
	for _, e := range os.Environ() {
		if strings.HasPrefix(e, "MYSQL_PWD=") {
			continue
		}
		env = append(env, e)
	}
	cmd.Env = append(env, "MYSQL_PWD="+cfg.DB.Password)

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
		resp.Err(c, 500, 500, "mysqldump 失败: "+msg)
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
	resp.OK(c, gin.H{
		"cosKey":   cosKey,
		"bytes":    gzBuf.Len(),
		"sqlBytes": sqlOut.Len(),
		"bucket":   services.CosBucket(),
		"message":  "ok",
	})
}
