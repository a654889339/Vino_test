package statbase

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"shared/cosbase"
)

// PutFunc 上传打点日志字节。
type PutFunc func(ctx context.Context, key string, body []byte, contentType string) error

// UploaderOptions 后台整点上传协程。
type UploaderOptions struct {
	Resolved   *ResolvedHourly
	CloudReady func() bool
	Put        PutFunc
	LogTag     string
}

// StartUploader 启动与审计相同策略的整点补传。
func StartUploader(opt UploaderOptions) {
	if opt.Resolved == nil || !opt.Resolved.Enabled {
		return
	}
	go runUploaderLoop(opt)
}

func runUploaderLoop(opt UploaderOptions) {
	tick := opt.Resolved.Tick
	if tick <= 0 {
		tick = time.Minute
	}
	ticker := time.NewTicker(tick)
	defer ticker.Stop()
	var lastTrunc time.Time
	for range ticker.C {
		loc := effectiveStatLoc()
		now := time.Now().In(loc)
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
			if !uploadHourAllTypes(opt, h, true) {
				break
			}
			h = h.Add(time.Hour)
		}
		lastTrunc = h
	}
}

func uploadHourAllTypes(opt UploaderOptions, hour time.Time, deleteLocal bool) bool {
	dir := LogDir()
	if dir == "" {
		return true
	}
	hour = hour.In(effectiveStatLoc()).Truncate(time.Hour)
	closeAllWritersForCompletedHour(hour)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return true
		}
		log.Printf("%s stat log dir read %s: %v", opt.LogTag, dir, err)
		return false
	}
	for _, ent := range entries {
		if !ent.IsDir() {
			continue
		}
		t := cosbase.SanitizeStatTypeSegment(ent.Name())
		if t == "" {
			continue
		}
		if !UploadStatHourIfAny(opt, t, hour, deleteLocal) {
			return false
		}
	}
	return true
}

// UploadStatHourIfAny 上传单类型单整点文件；供管理端 Flush 与测试使用。
func UploadStatHourIfAny(opt UploaderOptions, eventType string, hour time.Time, deleteLocal bool) bool {
	dir := LogDir()
	if dir == "" {
		return true
	}
	t := cosbase.SanitizeStatTypeSegment(eventType)
	hour = hour.In(effectiveStatLoc()).Truncate(time.Hour)
	closeWriterForCompletedHour(t, hour)
	localPath := HourFilePath(t, hour)
	data, err := os.ReadFile(localPath)
	if err != nil {
		if os.IsNotExist(err) {
			return true
		}
		log.Printf("%s stat log read %s: %v", opt.LogTag, localPath, err)
		return false
	}
	if len(data) == 0 {
		if deleteLocal {
			_ = os.Remove(localPath)
		}
		return true
	}
	if opt.CloudReady == nil || !opt.CloudReady() {
		return true
	}
	loc := effectiveStatLoc()
	base := filepath.Base(localPath)
	ossKey := cosbase.FormatLogStatObjectKey(t, hour, loc, base)
	if err := cosbase.ValidateBackupObjectKey(ossKey); err != nil {
		log.Printf("%s stat invalid key %q: %v", opt.LogTag, ossKey, err)
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if opt.Put == nil {
		return false
	}
	if err := opt.Put(ctx, ossKey, data, "text/plain; charset=utf-8"); err != nil {
		log.Printf("%s stat upload failed key=%s: %v", opt.LogTag, ossKey, err)
		return false
	}
	if deleteLocal {
		if err := os.Remove(localPath); err != nil {
			log.Printf("%s stat remove local %s: %v", opt.LogTag, localPath, err)
		}
	}
	return true
}

// ParseHourFromStatLogFilename 从 stat_*.log 文件名解析整点（与本地写入规则一致）。
func ParseHourFromStatLogFilename(name string) (time.Time, bool) {
	if !strings.HasPrefix(name, "stat_") || !strings.HasSuffix(name, ".log") {
		return time.Time{}, false
	}
	base := strings.TrimSuffix(name, ".log")
	idx := strings.LastIndex(base, "_")
	if idx < 0 || idx+1 >= len(base) {
		return time.Time{}, false
	}
	h, err := time.ParseInLocation("2006-01-02-15", base[idx+1:], effectiveStatLoc())
	return h, err == nil
}

// CompletedFilesSnapshot 列出已结束整点的本地文件（按类型、小时索引）；供测试与只读诊断。
func CompletedFilesSnapshot() map[string]map[time.Time]string {
	return completedFiles()
}

func completedFiles() map[string]map[time.Time]string {
	out := map[string]map[time.Time]string{}
	dir := LogDir()
	if dir == "" {
		return out
	}
	nowHour := time.Now().In(effectiveStatLoc()).Truncate(time.Hour)
	_ = filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d == nil || d.IsDir() {
			return nil
		}
		h, ok := ParseHourFromStatLogFilename(d.Name())
		if !ok || !h.Before(nowHour) {
			return nil
		}
		t := cosbase.SanitizeStatTypeSegment(filepath.Base(filepath.Dir(path)))
		if t == "" {
			return nil
		}
		if out[t] == nil {
			out[t] = map[time.Time]string{}
		}
		out[t][h] = path
		return nil
	})
	return out
}

// FlushCompletedStatLogs 上传已结束整点文件，不删本地。
// 返回 uploaded 键列表、未完成整点被跳过的文件数、失败键列表。
func FlushCompletedStatLogs(ctx context.Context, opt UploaderOptions) (uploaded []string, skippedIncomplete int, failed []string) {
	nowHour := time.Now().In(effectiveStatLoc()).Truncate(time.Hour)
	files := completedFiles()
	type item struct {
		Type string
		Hour time.Time
	}
	var items []item
	for t, byHour := range files {
		for h := range byHour {
			items = append(items, item{Type: t, Hour: h})
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Hour.Equal(items[j].Hour) {
			return items[i].Type < items[j].Type
		}
		return items[i].Hour.Before(items[j].Hour)
	})
	for _, it := range items {
		if !it.Hour.Before(nowHour) {
			skippedIncomplete++
			continue
		}
		if UploadStatHourIfAny(opt, it.Type, it.Hour, false) {
			uploaded = append(uploaded, fmt.Sprintf("%s/%s", it.Type, it.Hour.Format("2006-01-02-15")))
		} else {
			failed = append(failed, fmt.Sprintf("%s/%s", it.Type, it.Hour.Format("2006-01-02-15")))
		}
	}
	_ = ctx
	return uploaded, skippedIncomplete, failed
}
