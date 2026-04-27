package dbbase

import (
	"fmt"
	"os"
	"time"
	"strings"

	"gopkg.in/yaml.v3"
)

// FileConfig 与 common/config/db/*.yaml 结构一致。
type FileConfig struct {
	Scheduler struct {
		Enabled              bool   `yaml:"enabled"`
		TickSeconds          int    `yaml:"tick_seconds"`
		Timezone             string `yaml:"timezone"`
		CatchUpMissedHours   *bool  `yaml:"catch_up_missed_hours"`
	} `yaml:"scheduler"`
	Mysqldump struct {
		Mode          string `yaml:"mode"` // docker|local
		ContainerName string `yaml:"container_name"`
	} `yaml:"mysqldump"`
}

// ResolvedScheduler 调度用解析结果。
type ResolvedScheduler struct {
	Enabled            bool
	Tick               time.Duration
	Location           *time.Location
	CatchUpMissedHours bool
	DumpMode           string
	ContainerName      string
}

// LoadFileConfig 从 YAML 文件加载；path 为空时返回默认（启用、60s、上海、补跑）。
func LoadFileConfig(path string) (*FileConfig, error) {
	if path == "" {
		return defaultFileConfig(), nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read db backup config: %w", err)
	}
	var c FileConfig
	if err := yaml.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("yaml: %w", err)
	}
	return &c, nil
}

func defaultFileConfig() *FileConfig {
	c := &FileConfig{}
	c.Scheduler.Enabled = true
	c.Scheduler.TickSeconds = 60
	c.Scheduler.Timezone = "Asia/Shanghai"
	trueVal := true
	c.Scheduler.CatchUpMissedHours = &trueVal
	return c
}

// ResolveScheduler 将 FileConfig 转为 ResolvedScheduler（缺省补全）。
func ResolveScheduler(c *FileConfig) (*ResolvedScheduler, error) {
	if c == nil {
		c = defaultFileConfig()
	}
	tick := time.Duration(c.Scheduler.TickSeconds) * time.Second
	if tick <= 0 {
		tick = 60 * time.Second
	}
	tzName := c.Scheduler.Timezone
	if tzName == "" {
		tzName = "Asia/Shanghai"
	}
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		return nil, fmt.Errorf("timezone %q: %w", tzName, err)
	}
	catchUp := true
	if c.Scheduler.CatchUpMissedHours != nil {
		catchUp = *c.Scheduler.CatchUpMissedHours
	}
	mode := c.Mysqldump.Mode
	if mode == "" {
		mode = "docker"
	}
	mode = strings.TrimSpace(strings.ToLower(mode))
	if mode != "docker" && mode != "local" {
		return nil, fmt.Errorf("mysqldump.mode must be docker|local, got %q", c.Mysqldump.Mode)
	}
	return &ResolvedScheduler{
		Enabled:            c.Scheduler.Enabled,
		Tick:               tick,
		Location:           loc,
		CatchUpMissedHours: catchUp,
		DumpMode:           mode,
		ContainerName:      c.Mysqldump.ContainerName,
	}, nil
}
