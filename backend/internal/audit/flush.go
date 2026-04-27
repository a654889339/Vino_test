package audit

import (
	"context"

	"vino/backend/internal/config"
	"vino/backend/internal/services"
	"shared/logbase"
)

func FlushCompletedAuditLogs(cfg *config.Config) (uploaded int, skippedIncomplete int, failedNames []string) {
	put := func(ctx context.Context, key string, body []byte, contentType string) error {
		return services.PutBackupObject(ctx, key, body, "text/plain; charset=utf-8")
	}
	opt := logbase.UploaderOptions{
		Resolved:   logHourlyResolved,
		CloudReady: func() bool { return cfg.COSConfigured() },
		Put:        put,
		LogTag:     "[Vino]",
	}
	return logbase.FlushCompletedAuditLogs(context.Background(), opt)
}
