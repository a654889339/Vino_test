package cosbase

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var dbSaveNameSegment = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

// SafeDatabaseDirSegment 将库名用作对象存储路径单段；非法字符时退回占位，避免路径注入。
func SafeDatabaseDirSegment(name string) string {
	name = strings.TrimSpace(name)
	if dbSaveNameSegment.MatchString(name) {
		return name
	}
	return "_invalid"
}

// ValidateBackupObjectKey 校验审计/打点/DB 备份等私有上传对象键（与 COS PutBackupObject 白名单一致）。
func ValidateBackupObjectKey(key string) error {
	if err := ValidateKey(key); err != nil {
		return err
	}
	k := strings.TrimSpace(key)
	if strings.HasPrefix(k, "log/backend/") || strings.HasPrefix(k, "log/stat/") || strings.HasPrefix(k, "db_save/") {
		return nil
	}
	return fmt.Errorf("backup key must use log/backend/, log/stat/ or db_save/ prefix")
}

// FormatDbSaveHourlyKey 整点全库备份对象键：db_save/<库名>/YYYY-MM-DD/HH.sql.gz（HH 为 24 小时制，上海时区等由 loc 决定）。
// dbName 会经 SafeDatabaseDirSegment 规范化后再写入路径。
func FormatDbSaveHourlyKey(dbName string, hour time.Time, loc *time.Location) string {
	if loc == nil {
		loc = time.Local
	}
	hour = hour.In(loc).Truncate(time.Hour)
	dir := SafeDatabaseDirSegment(dbName)
	return fmt.Sprintf("db_save/%s/%s/%s.sql.gz", dir, hour.Format("2006-01-02"), hour.Format("15"))
}

var statTypeInvalidChars = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)

// SanitizeStatTypeSegment 将打点 type 规范为对象键与本地子目录名单段（与 R-Melamine statlog.cleanType 语义一致）。
func SanitizeStatTypeSegment(raw string) string {
	t := strings.TrimSpace(strings.ToLower(raw))
	t = strings.ReplaceAll(t, "/", "_")
	t = statTypeInvalidChars.ReplaceAllString(t, "_")
	t = strings.Trim(t, "_-.")
	if len(t) > 80 {
		t = t[:80]
	}
	if t == "" {
		return "misc"
	}
	return t
}

// FormatLogBackendObjectKey 审计整点日志对象键：log/backend/YYYY-MM-DD/<localBaseName>。
func FormatLogBackendObjectKey(hour time.Time, loc *time.Location, localBaseName string) string {
	if loc == nil {
		loc = time.Local
	}
	hour = hour.In(loc).Truncate(time.Hour)
	day := hour.Format("2006-01-02")
	base := filepath.Base(strings.TrimSpace(localBaseName))
	if base == "" || base == "." {
		base = "backend_unknown.log"
	}
	return fmt.Sprintf("log/backend/%s/%s", day, base)
}

// FormatLogStatObjectKey 打点整点日志对象键：log/stat/<type>/YYYY-MM-DD/<localBaseName>。
func FormatLogStatObjectKey(eventType string, hour time.Time, loc *time.Location, localBaseName string) string {
	if loc == nil {
		loc = time.Local
	}
	seg := SanitizeStatTypeSegment(eventType)
	hour = hour.In(loc).Truncate(time.Hour)
	day := hour.Format("2006-01-02")
	base := filepath.Base(strings.TrimSpace(localBaseName))
	if base == "" || base == "." {
		base = "stat_unknown.log"
	}
	return fmt.Sprintf("log/stat/%s/%s/%s", seg, day, base)
}
