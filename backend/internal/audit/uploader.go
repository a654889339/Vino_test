package audit

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"vino/backend/internal/config"
	"vino/backend/internal/services"
)

// StartUploader runs a goroutine that every minute checks whether the local hour
// has advanced; when it has, uploads completed hour log files to COS and deletes them locally.
func StartUploader(cfg *config.Config) {
	go runUploaderLoop(cfg)
}

func runUploaderLoop(cfg *config.Config) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	var lastTrunc time.Time
	for range ticker.C {
		now := time.Now().In(time.Local)
		cur := now.Truncate(time.Hour)
		if lastTrunc.IsZero() {
			lastTrunc = cur
			continue
		}
		if !cur.After(lastTrunc) {
			continue
		}
		h := lastTrunc
		for h.Before(cur) {
			if !uploadHourIfAny(cfg, h) {
				break
			}
			h = h.Add(time.Hour)
		}
		lastTrunc = h
	}
}

// uploadHourIfAny uploads one completed hour's log file if it exists.
// Returns true when the hour slot is done (no file, empty removed, COS disabled, or uploaded and removed).
// Returns false on read error or COS Put failure so the same hour is retried on the next tick.
func uploadHourIfAny(cfg *config.Config, hour time.Time) bool {
	if logDir == "" {
		return true
	}
	CloseWriterForCompletedHour(hour)
	localPath := HourFilePath(hour)
	data, err := os.ReadFile(localPath)
	if err != nil {
		if os.IsNotExist(err) {
			return true
		}
		log.Printf("[Vino] audit log read %s: %v", localPath, err)
		return false
	}
	if len(data) == 0 {
		_ = os.Remove(localPath)
		return true
	}
	if !cfg.COSConfigured() {
		return true
	}
	day := hour.Format("2006-01-02")
	base := filepath.Base(localPath)
	cosKey := fmt.Sprintf("log/backend/%s/%s", day, base)
	cosKey = strings.TrimPrefix(cosKey, "/")
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if err := services.PutBackupObject(ctx, cosKey, data, "text/plain; charset=utf-8"); err != nil {
		log.Printf("[Vino] audit COS upload failed key=%s: %v", cosKey, err)
		return false
	}
	if err := os.Remove(localPath); err != nil {
		log.Printf("[Vino] audit remove local %s: %v", localPath, err)
	}
	return true
}
