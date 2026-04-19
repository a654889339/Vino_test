package handlers

import (
	"context"
	"fmt"
	"log"
	"time"

	"vino/backend/internal/config"
)

// StartHourlyDbBackup 进程内整点 db 备份调度器。
//
// 行为：
//   - 启动后独立 goroutine 运行，每 60s 检查一次上海时区当前小时；
//   - 一旦 `time.Now().In(shanghaiLoc).Hour()` 与上次记录值不同（跨越整点或跨天），
//     就调用 runDbBackupCore 执行一次备份；
//   - 对象键固定为 `db_save/{cfg.DB.Name}/YYYY-MM-DD/HH.sql.gz`（日目录 + 小时文件，两位 HH）；
//   - 首次启动**不立即备份**：以启动时刻的小时为基准，等到下一个整点才触发；
//   - 失败仅 log.Printf，不影响进程；panic 由 recover 兜底，避免协程崩溃静默。
//
// 与其他两条路径的关系：
//   - 管理端「db备份」按钮（日路径 db_save/{db}/YYYY-MM/DD.sql.gz）—— 手动；
//   - 宿主机 cron `scripts/db_backup_to_cos.sh`（同上日路径）—— 需装 coscli；
//   - **本调度器**（小时路径 db_save/{db}/YYYY-MM-DD/HH.sql.gz）—— 进程内，最细粒度。
//
// 三者键路径互不覆盖。
func StartHourlyDbBackup(cfg *config.Config) {
	if cfg == nil {
		return
	}
	if !cfg.COSConfigured() {
		log.Printf("[hourly-db-backup] COS 未配置，跳过整点备份调度（配置 COS_SECRET_ID / COS_SECRET_KEY 后重启生效）")
		return
	}
	log.Printf("[hourly-db-backup] scheduled: 60s tick, key=db_save/{db}/YYYY-MM-DD/HH.sql.gz, tz=Asia/Shanghai")
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[hourly-db-backup] panic recovered: %v", r)
			}
		}()
		lastHour := time.Now().In(shanghaiLoc).Hour()
		t := time.NewTicker(60 * time.Second)
		defer t.Stop()
		for now := range t.C {
			n := now.In(shanghaiLoc)
			if n.Hour() == lastHour {
				continue
			}
			runOneHourlyBackup(cfg, n)
			lastHour = n.Hour()
		}
	}()
}

// runOneHourlyBackup 执行一次整点备份；独立函数便于 recover 不吞掉上层 ticker。
func runOneHourlyBackup(cfg *config.Config, now time.Time) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[hourly-db-backup] backup panic recovered: %v", r)
		}
	}()
	// 再次校验 DB 名合法（active_db 切库后 cfg.DB.Name 可能变化）
	if !dbNameIdent.MatchString(cfg.DB.Name) {
		log.Printf("[hourly-db-backup] skip: invalid DB name %q", cfg.DB.Name)
		return
	}
	key := fmt.Sprintf("db_save/%s/%s/%02d.sql.gz",
		cfg.DB.Name, now.Format("2006-01-02"), now.Hour())
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Minute)
	defer cancel()
	res, err := runDbBackupCore(ctx, cfg, key)
	if err != nil {
		log.Printf("[hourly-db-backup] %s FAIL: %v", key, err)
		return
	}
	log.Printf("[hourly-db-backup] %s OK bytes=%d sqlBytes=%d tableCount=%d totalRows=%d elapsed=%s",
		res.CosKey, res.Bytes, res.SqlBytes, res.TableCount, res.TotalRows, res.ElapsedHuman)
}
