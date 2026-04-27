package dbbase

import (
	"context"
	"log"
	"time"
)

// SchedulerOptions 进程内整点备份调度。
type SchedulerOptions struct {
	Resolved *ResolvedScheduler

	// CloudReady 为 true 时才执行 mysqldump+上传；为 false 时跳过上传但仍推进游标（与 RM OSS 未配置行为一致）。
	CloudReady func() bool

	BackupHour func(ctx context.Context, hour time.Time) (key string, gzN, sqlN int, err error)

	// Logf 可选；默认 log.Printf。
	Logf func(format string, args ...interface{})

	OnBackupSuccess func(hour time.Time, key string, gzN, sqlN int)
	OnBackupFailure func(hour time.Time, key string, err error)
}

func (o *SchedulerOptions) logf(format string, args ...interface{}) {
	if o.Logf != nil {
		o.Logf(format, args...)
		return
	}
	log.Printf(format, args...)
}

// StartScheduler 启动独立 goroutine；Resolved.Enabled 为 false 时不启动。
func StartScheduler(opts SchedulerOptions) {
	if opts.Resolved == nil || !opts.Resolved.Enabled {
		return
	}
	go runSchedulerLoop(opts)
}

func runSchedulerLoop(opts SchedulerOptions) {
	ticker := time.NewTicker(opts.Resolved.Tick)
	defer ticker.Stop()
	loc := opts.Resolved.Location
	if loc == nil {
		loc = time.Local
	}

	if opts.Resolved.CatchUpMissedHours {
		runCatchUpLoop(ticker, loc, opts)
		return
	}
	runHourEdgeLoop(ticker, loc, opts)
}

func runCatchUpLoop(ticker *time.Ticker, loc *time.Location, opts SchedulerOptions) {
	var lastTrunc time.Time
	for range ticker.C {
		now := time.Now().In(loc)
		cur := now.Truncate(time.Hour)
		if lastTrunc.IsZero() {
			lastTrunc = cur
			continue
		}
		if !cur.After(lastTrunc) {
			continue
		}
		completed := lastTrunc
		for t := lastTrunc.Add(time.Hour); !t.After(cur); t = t.Add(time.Hour) {
			if !backupOneHourIfAny(opts, t) {
				break
			}
			completed = t
		}
		lastTrunc = completed
	}
}

func runHourEdgeLoop(ticker *time.Ticker, loc *time.Location, opts SchedulerOptions) {
	lastHour := time.Now().In(loc).Hour()
	for tick := range ticker.C {
		n := tick.In(loc)
		if n.Hour() == lastHour {
			continue
		}
		_ = backupOneHourIfAny(opts, n.Truncate(time.Hour))
		lastHour = n.Hour()
	}
}

// backupOneHourIfAny CloudReady 为 false 时视为成功并返回 true；否则执行 BackupHour，失败返回 false。
func backupOneHourIfAny(opts SchedulerOptions, hour time.Time) bool {
	if opts.CloudReady != nil && !opts.CloudReady() {
		return true
	}
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Minute)
	defer cancel()
	key, gzN, sqlN, err := opts.BackupHour(ctx, hour)
	if err != nil {
		opts.logf("[dbbase] backup failed hour=%s key=%s: %v", hour.Format("2006-01-02 15:04"), key, err)
		if opts.OnBackupFailure != nil {
			opts.OnBackupFailure(hour, key, err)
		}
		return false
	}
	opts.logf("[dbbase] backup ok hour=%s key=%s sqlBytes=%d gzBytes=%d", hour.Format("2006-01-02 15:04"), key, sqlN, gzN)
	if opts.OnBackupSuccess != nil {
		opts.OnBackupSuccess(hour, key, gzN, sqlN)
	}
	return true
}
