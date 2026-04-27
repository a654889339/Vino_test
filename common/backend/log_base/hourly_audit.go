package logbase

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
	logLoc    *time.Location
	startedAt = time.Now()

	writerOnce sync.Once
	writeCh    chan writeItem
	closeCh    chan time.Time
)

type writeItem struct {
	ts   time.Time
	line []byte
}

func effectiveLoc() *time.Location {
	if logLoc != nil {
		return logLoc
	}
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}

// Init 准备按小时写入的本地目录与时区（整点桶与 OSS 路径一致）。
func Init(dir string, loc *time.Location) error {
	if dir == "" {
		dir = "data/logs/backend"
	}
	logMu.Lock()
	logDir = dir
	if loc != nil {
		logLoc = loc
	} else {
		logLoc = nil
	}
	err := os.MkdirAll(logDir, 0o755)
	logMu.Unlock()
	if err != nil {
		return err
	}
	writerOnce.Do(func() {
		writeCh = make(chan writeItem, 2048)
		closeCh = make(chan time.Time, 128)
		go writerLoop()
	})
	return nil
}

// LogDir 返回当前配置的本地日志根目录。
func LogDir() string {
	logMu.Lock()
	defer logMu.Unlock()
	return logDir
}

// LogLocation 返回当前整点分桶所用时区（供其他模块如 DB 备份对齐）。
func LogLocation() *time.Location {
	return effectiveLoc()
}

// HourFilePath 给定截断小时返回本地文件路径。
func HourFilePath(h time.Time) string {
	h = h.In(effectiveLoc()).Truncate(time.Hour)
	base := fmt.Sprintf("backend_%s.log", h.Format("2006-01-02-15"))
	return filepath.Join(logDir, base)
}

func ensureWriter(ts time.Time, curHour *time.Time, curFile **os.File) error {
	hour := ts.In(effectiveLoc()).Truncate(time.Hour)
	if *curFile != nil && hour.Equal(*curHour) {
		return nil
	}
	if *curFile != nil {
		_ = (*curFile).Close()
		*curFile = nil
	}
	*curHour = hour
	p := HourFilePath(hour)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(p, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	*curFile = f
	return nil
}

// AppendJSON 写入一行 JSON（注入 ts 字段）。
func AppendJSON(v interface{}) error {
	ts := time.Now().In(effectiveLoc())
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}

	// Avoid Marshal->Unmarshal->Marshal: inject "ts" by composing raw JSON object.
	tss := ts.Format(time.RFC3339Nano)
	var line []byte
	if len(raw) >= 2 && raw[0] == '{' && raw[len(raw)-1] == '}' {
		prefix := []byte(`{"ts":"` + tss + `"`)
		if len(raw) == 2 {
			line = append(prefix, '}', '\n')
		} else {
			line = make([]byte, 0, len(prefix)+1+(len(raw)-2)+2)
			line = append(line, prefix...)
			line = append(line, ',')
			line = append(line, raw[1:len(raw)-1]...)
			line = append(line, '}', '\n')
		}
	} else {
		// Fallback: keep payload and ts, but preserve log line validity.
		fb, _ := json.Marshal(map[string]interface{}{
			"ts":      tss,
			"payload": json.RawMessage(raw),
		})
		line = append(fb, '\n')
	}

	if writeCh == nil {
		return fmt.Errorf("log writer not initialized; call Init() first")
	}
	writeCh <- writeItem{ts: ts, line: line}
	return nil
}

// UptimeSeconds 进程启动时长（秒）。
func UptimeSeconds() float64 {
	return time.Since(startedAt).Seconds()
}

// CloseWriterForCompletedHour 关闭仍指向该整点桶的写句柄，便于上传线程安全读删。
func CloseWriterForCompletedHour(h time.Time) {
	h = h.In(effectiveLoc()).Truncate(time.Hour)
	if closeCh == nil {
		return
	}
	closeCh <- h
}

func writerLoop() {
	var curHour time.Time
	var curFile *os.File
	defer func() {
		if curFile != nil {
			_ = curFile.Close()
		}
	}()
	for {
		select {
		case it := <-writeCh:
			if err := ensureWriter(it.ts, &curHour, &curFile); err != nil {
				continue
			}
			_, _ = curFile.Write(it.line)
		case h := <-closeCh:
			if curFile != nil && curHour.Equal(h) {
				_ = curFile.Close()
				curFile = nil
				curHour = time.Time{}
			}
		}
	}
}
