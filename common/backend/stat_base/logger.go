package statbase

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"shared/cosbase"
)

var (
	logMu     sync.Mutex
	logDir    string
	startedAt = time.Now()

	writerOnce sync.Once
	recCh      chan recItem
	closeOneCh chan closeOneReq
	closeAllCh chan time.Time
)

// UptimeSeconds 进程启动时长（秒）。
func UptimeSeconds() float64 {
	return time.Since(startedAt).Seconds()
}

type writerState struct {
	hour time.Time
	file *os.File
}

type recItem struct {
	eventType string
	ts        time.Time
	line      []byte
}

type closeOneReq struct {
	eventType string
	h         time.Time
}

// Init 准备打点根目录与时区。
func Init(dir string, loc *time.Location) error {
	if dir == "" {
		dir = "data/logs/stat"
	}
	logMu.Lock()
	logDir = dir
	if loc != nil {
		statLogLoc = loc
	} else {
		statLogLoc = nil
	}
	err := os.MkdirAll(logDir, 0o755)
	logMu.Unlock()
	if err != nil {
		return err
	}
	writerOnce.Do(func() {
		recCh = make(chan recItem, 4096)
		closeOneCh = make(chan closeOneReq, 256)
		closeAllCh = make(chan time.Time, 64)
		go writerLoop()
	})
	return nil
}

// CloseWriters 关闭所有打开的小时文件（测试 Windows 下 TempDir 清理前调用）。
func CloseWriters() {
	if closeAllCh == nil {
		return
	}
	closeAllCh <- time.Now().In(effectiveStatLoc()).Truncate(time.Hour)
}

// LogDir 返回配置的本地根目录。
func LogDir() string {
	logMu.Lock()
	defer logMu.Unlock()
	return logDir
}

// StatLocation 与整点分桶一致，供外部对齐。
func StatLocation() *time.Location {
	return effectiveStatLoc()
}

// HourFilePath 本地路径（按类型子目录）。
func HourFilePath(eventType string, h time.Time) string {
	t := cosbase.SanitizeStatTypeSegment(eventType)
	h = h.In(effectiveStatLoc()).Truncate(time.Hour)
	base := fmt.Sprintf("stat_%s_%s.log", t, h.Format("2006-01-02-15"))
	return filepath.Join(logDir, t, base)
}

// OSSKey 对象存储键。
func OSSKey(eventType string, h time.Time) string {
	t := cosbase.SanitizeStatTypeSegment(eventType)
	h = h.In(effectiveStatLoc()).Truncate(time.Hour)
	loc := effectiveStatLoc()
	base := filepath.Base(HourFilePath(t, h))
	return cosbase.FormatLogStatObjectKey(t, h, loc, base)
}

func ensureWriter(writers map[string]*writerState, eventType string, ts time.Time) (*os.File, error) {
	t := cosbase.SanitizeStatTypeSegment(eventType)
	hour := ts.In(effectiveStatLoc()).Truncate(time.Hour)
	st := writers[t]
	if st != nil && st.file != nil && st.hour.Equal(hour) {
		return st.file, nil
	}
	if st != nil && st.file != nil {
		_ = st.file.Close()
	}
	p := HourFilePath(t, hour)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(p, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	writers[t] = &writerState{hour: hour, file: f}
	return f, nil
}

// Log 写入一条结构化打点。
func Log(e *Event) error {
	if e == nil {
		return nil
	}
	ts := time.Now().In(effectiveStatLoc())
	e.normalize(ts)
	line, err := json.Marshal(e)
	if err != nil {
		return err
	}
	if recCh == nil {
		return fmt.Errorf("stat writer not initialized; call Init() first")
	}
	recCh <- recItem{eventType: e.Type, ts: ts, line: append(line, '\n')}
	return nil
}

// RecordMap 写入 map 载荷（Vino 风格），自动注入 type 与 ts。
func RecordMap(eventType string, payload map[string]interface{}) {
	if logDir == "" {
		return
	}
	t := cosbase.SanitizeStatTypeSegment(eventType)
	if payload == nil {
		payload = map[string]interface{}{}
	}
	ts := time.Now().In(effectiveStatLoc())
	out := make(map[string]interface{}, len(payload)+2)
	for k, v := range payload {
		out[k] = v
	}
	out["type"] = t
	out["ts"] = ts.Format(time.RFC3339Nano)
	line, err := json.Marshal(out)
	if err != nil {
		return
	}
	if recCh == nil {
		return
	}
	recCh <- recItem{eventType: t, ts: ts, line: append(line, '\n')}
}

func closeWriterForCompletedHour(eventType string, h time.Time) {
	t := cosbase.SanitizeStatTypeSegment(eventType)
	h = h.In(effectiveStatLoc()).Truncate(time.Hour)
	if closeOneCh == nil {
		return
	}
	closeOneCh <- closeOneReq{eventType: t, h: h}
}

func closeAllWritersForCompletedHour(h time.Time) {
	h = h.In(effectiveStatLoc()).Truncate(time.Hour)
	if closeAllCh == nil {
		return
	}
	closeAllCh <- h
}

func writerLoop() {
	writers := map[string]*writerState{}
	defer func() {
		for _, st := range writers {
			if st != nil && st.file != nil {
				_ = st.file.Close()
			}
		}
	}()
	for {
		select {
		case it := <-recCh:
			if strings.TrimSpace(logDir) == "" {
				continue
			}
			f, err := ensureWriter(writers, it.eventType, it.ts)
			if err != nil || f == nil {
				continue
			}
			_, _ = f.Write(it.line)
		case req := <-closeOneCh:
			st := writers[req.eventType]
			if st == nil || st.file == nil || !st.hour.Equal(req.h) {
				continue
			}
			_ = st.file.Close()
			delete(writers, req.eventType)
		case h := <-closeAllCh:
			for t, st := range writers {
				if st != nil && st.file != nil && st.hour.Equal(h) {
					_ = st.file.Close()
					delete(writers, t)
				}
			}
		}
	}
}
