package stat

import (
	"context"
	"time"

	"vino/backend/internal/config"
	"vino/backend/internal/services"
	"shared/statbase"
)

var statHourlyResolved *statbase.ResolvedHourly

// SetStatHourlyResolved 由 main 注入 YAML 解析结果。
func SetStatHourlyResolved(r *statbase.ResolvedHourly) {
	statHourlyResolved = r
}

// Init 准备打点根目录与时区。
func Init(dir string, loc *time.Location) error {
	return statbase.Init(dir, loc)
}

// RootDir 与 LogDir 相同。
func RootDir() string {
	return statbase.LogDir()
}

// UptimeSeconds 进程启动时长。
func UptimeSeconds() float64 {
	return statbase.UptimeSeconds()
}

// Record 写入一条打点（map 载荷）。
func Record(eventType string, payload map[string]interface{}) {
	statbase.RecordMap(eventType, payload)
}

// StartUploader 后台整点上传。
func StartUploader(cfg *config.Config) {
	put := func(ctx context.Context, key string, body []byte, contentType string) error {
		return services.PutBackupObject(ctx, key, body, "text/plain; charset=utf-8")
	}
	statbase.StartUploader(statbase.UploaderOptions{
		Resolved:   statHourlyResolved,
		CloudReady: func() bool { return cfg.COSConfigured() },
		Put:        put,
		LogTag:     "[Vino]",
	})
}

// FlushCompletedStatLogs 批量上传已结束整点文件；不删本地（与 statbase 一致）。
func FlushCompletedStatLogs(cfg *config.Config) (uploaded int, skippedIncomplete int, failedNames []string) {
	put := func(ctx context.Context, key string, body []byte, contentType string) error {
		return services.PutBackupObject(ctx, key, body, "text/plain; charset=utf-8")
	}
	opt := statbase.UploaderOptions{
		Resolved:   statHourlyResolved,
		CloudReady: func() bool { return cfg.COSConfigured() },
		Put:        put,
		LogTag:     "[Vino]",
	}
	labels, skipN, failed := statbase.FlushCompletedStatLogs(context.Background(), opt)
	return len(labels), skipN, failed
}
