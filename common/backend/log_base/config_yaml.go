package logbase

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// FileConfig 与 common/config/log/*.yaml 结构一致。
type FileConfig struct {
	LocalDir string `yaml:"local_dir"`
	Timezone string `yaml:"timezone"`
	Uploader struct {
		Enabled     *bool `yaml:"enabled"`
		TickSeconds int   `yaml:"tick_seconds"`
	} `yaml:"uploader"`
}

// ResolvedHourly 解析后的目录、时区与上传器参数。
type ResolvedHourly struct {
	LocalDir string
	Location *time.Location
	Enabled  bool
	Tick     time.Duration
}

// LoadFileConfig 读取 YAML；path 为空返回零值结构（由 Resolve 补默认）。
func LoadFileConfig(path string) (*FileConfig, error) {
	if path == "" {
		return &FileConfig{}, nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read log config: %w", err)
	}
	var c FileConfig
	if err := yaml.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("yaml: %w", err)
	}
	return &c, nil
}

// Resolve 合并 YAML 与进程内默认目录 defaultLocalDir（通常来自 env 加载的 cfg.Log.BackendDir）。
func Resolve(fc *FileConfig, defaultLocalDir string) (*ResolvedHourly, error) {
	if fc == nil {
		fc = &FileConfig{}
	}
	dir := fc.LocalDir
	if dir == "" {
		dir = defaultLocalDir
	}
	tzName := fc.Timezone
	if tzName == "" {
		tzName = "Asia/Shanghai"
	}
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		return nil, fmt.Errorf("timezone %q: %w", tzName, err)
	}
	tick := time.Duration(fc.Uploader.TickSeconds) * time.Second
	if tick <= 0 {
		tick = time.Minute
	}
	enabled := true
	if fc.Uploader.Enabled != nil {
		enabled = *fc.Uploader.Enabled
	}
	return &ResolvedHourly{
		LocalDir: dir,
		Location: loc,
		Enabled:  enabled,
		Tick:     tick,
	}, nil
}
