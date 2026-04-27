// Package vinomediacfg 读取仓内 common/config/cos/vino.media.yaml（与 R-Melamine rmelamine.media 字段对齐）。
package vinomediacfg

import (
	"os"
	"strings"
	"sync"

	"gopkg.in/yaml.v3"
)

// File 为 vino.media.yaml 的解析子集，仅含 cos-config 所需字段。
type File struct {
	Project                 string   `yaml:"project"`
	CloudProvider           string   `yaml:"cloudProvider"`
	OssPublicBaseDefault    string   `yaml:"ossPublicBaseDefault"`
	MediaConfigTtlMs        int      `yaml:"mediaConfigTtlMs"`
	ImageDisplayCacheTtlMs  int      `yaml:"imageDisplayCacheTtlMs"`
	CosProxyAllowedPrefixes []string `yaml:"cosProxyAllowedPrefixes"`
	FrontPageConfig         *struct {
		Root                     string `yaml:"Root"`
		HomepageCarouselTemplate  string `yaml:"HomepageCarouselTemplate"`
		ProductIconTemplate       string `yaml:"ProductIconTemplate"`
		ProductCoverTemplate      string `yaml:"ProductCoverTemplate"`
		ProductCoverThumbTemplate string `yaml:"ProductCoverThumbTemplate"`
	} `yaml:"frontPageConfig"`
}

var (
	mu  sync.RWMutex
	loc *File
)

// Load 读取 path；文件不存在时视为未配置（返回 nil Get），由接口回退到 services.CosBase()。
func Load(path string) error {
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			mu.Lock()
			loc = nil
			mu.Unlock()
			return nil
		}
		return err
	}
	var f File
	if err := yaml.Unmarshal(b, &f); err != nil {
		return err
	}
	f.OssPublicBaseDefault = strings.TrimSpace(f.OssPublicBaseDefault)
	mu.Lock()
	loc = &f
	mu.Unlock()
	return nil
}

// Get 返回已加载配置；可能为 nil。
func Get() *File {
	mu.RLock()
	defer mu.RUnlock()
	if loc == nil {
		return nil
	}
	cp := *loc
	if len(loc.CosProxyAllowedPrefixes) > 0 {
		cp.CosProxyAllowedPrefixes = append([]string(nil), loc.CosProxyAllowedPrefixes...)
	}
	return &cp
}
