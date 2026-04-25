package stat

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"vino/backend/internal/config"
	"vino/backend/internal/services"
)

var (
	mu        sync.Mutex
	rootDir   string
	writers   = map[string]*os.File{}
	writerRe  = regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)
	startedAt = time.Now()
)

// Init prepares the root directory for typed stat logs.
func Init(dir string) error {
	if dir == "" {
		dir = "data/logs/stat"
	}
	rootDir = dir
	return os.MkdirAll(rootDir, 0o755)
}

func RootDir() string {
	return rootDir
}

func UptimeSeconds() float64 {
	return time.Since(startedAt).Seconds()
}

func normalizeType(eventType string) string {
	eventType = strings.ToLower(strings.TrimSpace(eventType))
	eventType = strings.ReplaceAll(eventType, "-", "_")
	if !writerRe.MatchString(eventType) {
		return "misc"
	}
	return eventType
}

func hourFilePath(eventType string, h time.Time) string {
	eventType = normalizeType(eventType)
	h = h.In(time.Local).Truncate(time.Hour)
	base := fmt.Sprintf("stat_%s_%s.log", eventType, h.Format("2006-01-02-15"))
	return filepath.Join(rootDir, eventType, base)
}

func writerKey(eventType string, h time.Time) string {
	return normalizeType(eventType) + "|" + h.In(time.Local).Truncate(time.Hour).Format(time.RFC3339)
}

func ensureWriter(eventType string, ts time.Time) (*os.File, error) {
	eventType = normalizeType(eventType)
	h := ts.In(time.Local).Truncate(time.Hour)
	key := writerKey(eventType, h)
	if f := writers[key]; f != nil {
		return f, nil
	}
	p := hourFilePath(eventType, h)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(p, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	writers[key] = f
	return f, nil
}

// Record writes one typed stat event as a JSON line. The eventType controls
// both the local subdirectory and COS prefix: log/stat/{eventType}/...
func Record(eventType string, payload map[string]interface{}) {
	if rootDir == "" {
		return
	}
	eventType = normalizeType(eventType)
	if payload == nil {
		payload = map[string]interface{}{}
	}
	mu.Lock()
	defer mu.Unlock()
	ts := time.Now().In(time.Local)
	f, err := ensureWriter(eventType, ts)
	if err != nil {
		log.Printf("[Vino] stat writer %s: %v", eventType, err)
		return
	}
	payload["type"] = eventType
	payload["ts"] = ts.Format(time.RFC3339Nano)
	line, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[Vino] stat marshal %s: %v", eventType, err)
		return
	}
	if _, err := f.Write(append(line, '\n')); err != nil {
		log.Printf("[Vino] stat write %s: %v", eventType, err)
	}
}

func closeWriterForCompletedHour(eventType string, h time.Time) {
	eventType = normalizeType(eventType)
	h = h.In(time.Local).Truncate(time.Hour)
	key := writerKey(eventType, h)
	mu.Lock()
	defer mu.Unlock()
	if f := writers[key]; f != nil {
		_ = f.Close()
		delete(writers, key)
	}
}

func listEventTypes() []string {
	if rootDir == "" {
		return nil
	}
	entries, err := os.ReadDir(rootDir)
	if err != nil {
		return nil
	}
	out := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() && writerRe.MatchString(e.Name()) {
			out = append(out, e.Name())
		}
	}
	sort.Strings(out)
	return out
}

// StartUploader runs the same completed-hour upload policy as backend audit
// logs, but emits COS keys under log/stat/{type}/YYYY-MM-DD/.
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
			ok := true
			for _, eventType := range listEventTypes() {
				if !uploadHourIfAny(cfg, eventType, h) {
					ok = false
					break
				}
			}
			if !ok {
				break
			}
			h = h.Add(time.Hour)
		}
		lastTrunc = h
	}
}

func uploadHourIfAny(cfg *config.Config, eventType string, hour time.Time) bool {
	if rootDir == "" {
		return true
	}
	eventType = normalizeType(eventType)
	hour = hour.In(time.Local).Truncate(time.Hour)
	closeWriterForCompletedHour(eventType, hour)
	localPath := hourFilePath(eventType, hour)
	data, err := os.ReadFile(localPath)
	if err != nil {
		if os.IsNotExist(err) {
			return true
		}
		log.Printf("[Vino] stat log read %s: %v", localPath, err)
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
	cosKey := fmt.Sprintf("log/stat/%s/%s/%s", eventType, day, base)
	cosKey = strings.TrimPrefix(cosKey, "/")
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if err := services.PutBackupObject(ctx, cosKey, data, "text/plain; charset=utf-8"); err != nil {
		log.Printf("[Vino] stat COS upload failed key=%s: %v", cosKey, err)
		return false
	}
	if err := os.Remove(localPath); err != nil {
		log.Printf("[Vino] stat remove local %s: %v", localPath, err)
	}
	return true
}

// FlushCompletedStatLogs uploads all completed hourly stat files under every
// event type directory. Current-hour files are intentionally skipped.
func FlushCompletedStatLogs(cfg *config.Config) (uploaded int, skippedIncomplete int, failedNames []string) {
	if rootDir == "" {
		return 0, 0, nil
	}
	nowHour := time.Now().In(time.Local).Truncate(time.Hour)
	type hourFile struct {
		eventType string
		t         time.Time
		name      string
	}
	var list []hourFile
	for _, eventType := range listEventTypes() {
		dir := filepath.Join(rootDir, eventType)
		entries, err := os.ReadDir(dir)
		if err != nil {
			failedNames = append(failedNames, eventType+": "+err.Error())
			continue
		}
		prefix := "stat_" + eventType + "_"
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			name := e.Name()
			if !strings.HasPrefix(name, prefix) || !strings.HasSuffix(name, ".log") {
				continue
			}
			raw := strings.TrimSuffix(strings.TrimPrefix(name, prefix), ".log")
			tt, err := time.ParseInLocation("2006-01-02-15", raw, time.Local)
			if err != nil {
				continue
			}
			if !tt.Before(nowHour) {
				skippedIncomplete++
				continue
			}
			list = append(list, hourFile{eventType: eventType, t: tt, name: filepath.Join(eventType, name)})
		}
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].t.Equal(list[j].t) {
			return list[i].name < list[j].name
		}
		return list[i].t.Before(list[j].t)
	})
	for _, item := range list {
		if uploadHourIfAny(cfg, item.eventType, item.t) {
			uploaded++
		} else {
			failedNames = append(failedNames, item.name)
		}
	}
	return uploaded, skippedIncomplete, failedNames
}
