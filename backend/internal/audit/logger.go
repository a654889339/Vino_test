package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var (
	logMu     sync.Mutex
	logDir    string
	curHour   time.Time
	curFile   *os.File
	startedAt = time.Now()
)

// Init prepares the hourly log directory.
func Init(dir string) error {
	if dir == "" {
		dir = "data/logs/backend"
	}
	logDir = dir
	return os.MkdirAll(logDir, 0o755)
}

// LogDir returns the configured backend log directory.
func LogDir() string {
	return logDir
}

// HourFilePath returns the local path for logs of a given truncated hour.
func HourFilePath(h time.Time) string {
	h = h.In(time.Local)
	base := fmt.Sprintf("backend_%s.log", h.Format("2006-01-02-15"))
	return filepath.Join(logDir, base)
}

func ensureWriter(ts time.Time) error {
	hour := ts.In(time.Local).Truncate(time.Hour)
	if curFile != nil && hour.Equal(curHour) {
		return nil
	}
	if curFile != nil {
		_ = curFile.Close()
		curFile = nil
	}
	curHour = hour
	p := HourFilePath(hour)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(p, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	curFile = f
	return nil
}

// AppendJSON writes one JSON object per line with ts field.
func AppendJSON(v interface{}) error {
	logMu.Lock()
	defer logMu.Unlock()
	ts := time.Now().In(time.Local)
	if err := ensureWriter(ts); err != nil {
		return err
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return err
	}
	obj["ts"] = ts.Format(time.RFC3339Nano)
	line, err := json.Marshal(obj)
	if err != nil {
		return err
	}
	_, err = curFile.Write(append(line, '\n'))
	return err
}

// UptimeSeconds for debugging.
func UptimeSeconds() float64 {
	return time.Since(startedAt).Seconds()
}

// CloseWriterForCompletedHour closes the on-disk writer if it is still writing
// the given truncated hour (so the uploader can read/delete that hour's file safely).
func CloseWriterForCompletedHour(h time.Time) {
	h = h.In(time.Local).Truncate(time.Hour)
	logMu.Lock()
	defer logMu.Unlock()
	if curFile == nil {
		return
	}
	if curHour.Equal(h) {
		_ = curFile.Close()
		curFile = nil
		curHour = time.Time{}
	}
}
