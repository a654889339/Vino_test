package audit

import (
	"context"

	"vino/backend/internal/config"
	"vino/backend/internal/services"
	"shared/logbase"
)

var logHourlyResolved *logbase.ResolvedHourly

// SetLogHourlyResolved 由 main 注入 YAML 解析结果。
func SetLogHourlyResolved(r *logbase.ResolvedHourly) {
	logHourlyResolved = r
}

func StartUploader(cfg *config.Config) {
	put := func(ctx context.Context, key string, body []byte, contentType string) error {
		return services.PutBackupObject(ctx, key, body, "text/plain; charset=utf-8")
	}
	logbase.StartUploader(logbase.UploaderOptions{
		Resolved:   logHourlyResolved,
		CloudReady: func() bool { return cfg.COSConfigured() },
		Put:        put,
		LogTag:     "[Vino]",
	})
}
