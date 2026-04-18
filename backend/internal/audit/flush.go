package audit

import (
	"os"
	"sort"
	"strings"
	"time"

	"vino/backend/internal/config"
)

// FlushCompletedAuditLogs uploads every completed hourly audit log file that still exists
// under logDir (hours strictly before the current truncated local hour).
// It reuses the same COS path rules as the background uploader.
func FlushCompletedAuditLogs(cfg *config.Config) (uploaded int, skippedIncomplete int, failedNames []string) {
	if logDir == "" {
		return 0, 0, nil
	}
	nowHour := time.Now().In(time.Local).Truncate(time.Hour)
	entries, err := os.ReadDir(logDir)
	if err != nil {
		return 0, 0, []string{err.Error()}
	}
	type hourFile struct {
		t    time.Time
		name string
	}
	var list []hourFile
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasPrefix(name, "backend_") || !strings.HasSuffix(name, ".log") {
			continue
		}
		raw := strings.TrimSuffix(strings.TrimPrefix(name, "backend_"), ".log")
		tt, err := time.ParseInLocation("2006-01-02-15", raw, time.Local)
		if err != nil {
			continue
		}
		if !tt.Before(nowHour) {
			skippedIncomplete++
			continue
		}
		list = append(list, hourFile{t: tt, name: name})
	}
	sort.Slice(list, func(i, j int) bool { return list[i].t.Before(list[j].t) })
	for _, item := range list {
		if uploadHourIfAny(cfg, item.t) {
			uploaded++
		} else {
			failedNames = append(failedNames, item.name)
		}
	}
	return uploaded, skippedIncomplete, failedNames
}
