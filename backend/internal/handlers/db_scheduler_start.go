package handlers

import (
	"context"
	"fmt"
	"time"

	"shared/cosbase"
	"shared/dbbase"
	"vino/backend/internal/audit"
	"vino/backend/internal/config"
	"vino/backend/internal/dbbackup"
	"vino/backend/internal/stat"
)

// StartDbBackupScheduler 由 cmd/server 调用：加载 YAML 后注入容器名并启动整点备份协程。
func StartDbBackupScheduler(cfg *config.Config, sched *dbbase.ResolvedScheduler, fc *dbbase.FileConfig) {
	if sched == nil || !sched.Enabled {
		return
	}
	if fc != nil {
		dbbackup.SetMysqlDumpContainerFromYAML(fc.Mysqldump.ContainerName)
	}
	dbbase.StartScheduler(dbbase.SchedulerOptions{
		Resolved:   sched,
		CloudReady: func() bool { return cfg.COSConfigured() },
		BackupHour: func(ctx context.Context, hour time.Time) (string, int, int, error) {
			if !dbNameIdent.MatchString(cfg.DB.Name) {
				stat.Record("system", map[string]interface{}{
					"source": "system", "action": "system.hourly_db_backup", "status": "failed",
					"error": "invalid DB name", "database": cfg.DB.Name,
				})
				return "", 0, 0, fmt.Errorf("invalid DB name")
			}
			loc := audit.LogLocation()
			h := hour.In(loc).Truncate(time.Hour)
			key := cosbase.FormatDbSaveHourlyKey(cfg.DB.Name, h, loc)
			res, err := runDbBackupCore(ctx, cfg, key, sched.DumpMode)
			if err != nil {
				stat.Record("system", map[string]interface{}{
					"source": "system", "action": "system.hourly_db_backup", "status": "failed",
					"error": err.Error(), "cosKey": key, "database": cfg.DB.Name,
				})
				return key, 0, 0, err
			}
			stat.Record("system", map[string]interface{}{
				"source": "system", "action": "system.hourly_db_backup", "status": "success",
				"cosKey": res.CosKey, "database": res.Database, "bytes": res.Bytes, "sqlBytes": res.SqlBytes,
				"tableCount": res.TableCount, "totalRows": res.TotalRows, "elapsedMs": res.ElapsedMs,
			})
			return res.CosKey, res.Bytes, res.SqlBytes, nil
		},
	})
}
