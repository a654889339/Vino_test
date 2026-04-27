package audit

import (
	"time"

	"shared/logbase"
)

func Init(dir string, loc *time.Location) error {
	return logbase.Init(dir, loc)
}

func LogDir() string {
	return logbase.LogDir()
}

func HourFilePath(h time.Time) string {
	return logbase.HourFilePath(h)
}

func AppendJSON(v interface{}) error {
	return logbase.AppendJSON(v)
}

func UptimeSeconds() float64 {
	return logbase.UptimeSeconds()
}

func CloseWriterForCompletedHour(h time.Time) {
	logbase.CloseWriterForCompletedHour(h)
}
