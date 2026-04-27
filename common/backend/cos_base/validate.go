package cosbase

import (
	"fmt"
	"strings"
)

const maxObjectKeyLength = 1024

// ValidateKey 拒绝空 key、路径穿越、反斜杠与过长 key（供上传与媒体代理共用）。
func ValidateKey(key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return fmt.Errorf("key 不能为空")
	}
	if strings.Contains(key, "..") {
		return fmt.Errorf("key 非法")
	}
	if strings.Contains(key, "\\") {
		return fmt.Errorf("key 非法")
	}
	if len(key) > maxObjectKeyLength {
		return fmt.Errorf("key 过长")
	}
	return nil
}
