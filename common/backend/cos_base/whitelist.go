package cosbase

import "strings"

// KeyMatchesAllowedPrefix 判断 key（可先 TrimLeft('/')）是否以任一白名单前缀开头。
func KeyMatchesAllowedPrefix(prefixes []string, key string) bool {
	key = strings.TrimLeft(key, "/")
	for _, p := range prefixes {
		if strings.HasPrefix(key, p) {
			return true
		}
	}
	return false
}

// ExtractKeyFromAllowedPrefixes 从 pathname 或裸路径截取以白名单为起点的 object key，支持 path-style「/bucket/prefix/…」。
func ExtractKeyFromAllowedPrefixes(prefixes []string, p string) string {
	p = strings.TrimLeft(p, "/")
	p = NormalizeOverEncodedObjectPath(p)
	for _, pr := range prefixes {
		if i := strings.Index(p, pr); i >= 0 {
			return p[i:]
		}
	}
	return p
}
