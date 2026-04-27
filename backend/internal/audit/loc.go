package audit

import (
	"time"

	"shared/logbase"
)

// LogLocation 与整点分桶一致（默认由 log YAML 设为 Asia/Shanghai）。
func LogLocation() *time.Location {
	return logbase.LogLocation()
}
