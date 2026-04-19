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

// POST /api/admin/ops/db-backup — 优先在 MySQL 官方容器内 mysqldump（兼容 caching_sha2_password），
// 回退到 backend 容器内本机 mysqldump（Alpine mysql-client 实为 MariaDB，仅作兜底）。gzip 后上传至 COS db_save/。
func adminPostDbBackup(c *gin.Context, cfg *config.Config) {
	if !cfg.COSConfigured() {
		resp.Err(c, 503, 503, "COS 未配置，无法上传数据库备份")
		return
	}
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
	resp.OK(c, gin.H{
		"cosKey":   cosKey,
		"bytes":    gzBuf.Len(),
		"sqlBytes": sqlOut.Len(),
		"bucket":   services.CosBucket(),
		"message":  "ok",
	})
}
