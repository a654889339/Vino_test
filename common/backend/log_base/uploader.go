package logbase

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"shared/cosbase"
)

// PutFunc 上传审计日志字节（由各项目注入 OSS PutBytes / COS PutBackupObject）。
type PutFunc func(ctx context.Context, key string, body []byte, contentType string) error

// UploaderOptions 后台整点上传协程。
type UploaderOptions struct {
	Resolved   *ResolvedHourly
	CloudReady func() bool
	Put        PutFunc
	LogTag     string
}

// StartUploader 每分钟检测整点推进，顺序补传已完成小时的本地文件。
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
		loc := effectiveLoc()
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
			if !UploadAuditHourIfAny(opt, h, true) {
				break
			}
			h = h.Add(time.Hour)
		}
		lastTrunc = h
	}
}

// UploadAuditHourIfAny deleteLocal=true 表示上传成功后删除本地（协程路径）；false 为手动 Flush，不删本地。
// UploadAuditHourIfAny 上传单整点审计文件；供 Flush 与测试使用。
func UploadAuditHourIfAny(opt UploaderOptions, hour time.Time, deleteLocal bool) bool {
	dir := LogDir()
	if dir == "" {
		return true
	}
	loc := effectiveLoc()
	hour = hour.In(loc).Truncate(time.Hour)
	CloseWriterForCompletedHour(hour)
	localPath := HourFilePath(hour)
	data, err := os.ReadFile(localPath)
	if err != nil {
		if os.IsNotExist(err) {
			return true
		}
		log.Printf("%s audit log read %s: %v", opt.LogTag, localPath, err)
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
	base := filepath.Base(localPath)
	ossKey := cosbase.FormatLogBackendObjectKey(hour, loc, base)
	if err := cosbase.ValidateBackupObjectKey(ossKey); err != nil {
		log.Printf("%s audit invalid oss key %q: %v", opt.LogTag, ossKey, err)
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if opt.Put == nil {
		return false
	}
	if err := opt.Put(ctx, ossKey, data, "text/plain; charset=utf-8"); err != nil {
		log.Printf("%s audit upload failed key=%s: %v", opt.LogTag, ossKey, err)
		return false
	}
	if deleteLocal {
		if err := os.Remove(localPath); err != nil {
			log.Printf("%s audit remove local %s: %v", opt.LogTag, localPath, err)
		}
	}
	return true
}

// FlushCompletedAuditLogs 上传当前整点之前的所有 backend_*.log，不删除本地。
func FlushCompletedAuditLogs(ctx context.Context, opt UploaderOptions) (uploaded int, skippedIncomplete int, failedNames []string) {
	dir := LogDir()
	if dir == "" {
		return 0, 0, nil
	}
	loc := effectiveLoc()
	nowHour := time.Now().In(loc).Truncate(time.Hour)
	entries, err := os.ReadDir(dir)
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
		tt, err := time.ParseInLocation("2006-01-02-15", raw, loc)
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
		if UploadAuditHourIfAny(opt, item.t, false) {
			uploaded++
		} else {
			failedNames = append(failedNames, item.name)
		}
	}
	_ = ctx
	return uploaded, skippedIncomplete, failedNames
}
