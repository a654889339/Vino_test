package cosbase

import (
	"net/url"
	"strings"
)

const maxOverEncodeDecodeIterations = 8

// NormalizeOverEncodedObjectPath 对可能被多次 percent-encode 的路径段循环 PathUnescape，直到稳定。
// 典型场景：user_diy_3d%252F... 需还原为 user_diy_3d/... 再交给存储 SDK 或同源代理 Get。
func NormalizeOverEncodedObjectPath(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	for i := 0; i < maxOverEncodeDecodeIterations; i++ {
		dec, err := url.PathUnescape(s)
		if err != nil || dec == s {
			break
		}
		s = dec
	}
	return s
}
