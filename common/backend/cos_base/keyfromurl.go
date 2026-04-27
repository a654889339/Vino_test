package cosbase

import (
	"net/url"
	"strings"
)

// KeyFromMediaURLWithPrefixes 从公网域、同源媒体代理 ?key=、或裸路径解析出 object key。
// publicDomainBase 无尾斜杠；apiMediaProxyPath 为路径段，如 "/api/media/oss" 或 "/api/media/cos"（无 query）。
func KeyFromMediaURLWithPrefixes(publicDomainBase, apiMediaProxyPath string, prefixes []string, rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}
	d := strings.TrimRight(strings.TrimSpace(publicDomainBase), "/")
	proxy := strings.TrimSpace(apiMediaProxyPath)
	if !strings.HasPrefix(proxy, "/") {
		proxy = "/" + proxy
	}
	queryPrefix := proxy + "?key="

	if d != "" && strings.HasPrefix(rawURL, d+"/") {
		return ExtractKeyFromAllowedPrefixes(prefixes, strings.TrimPrefix(rawURL, d+"/"))
	}
	if len(rawURL) >= len(queryPrefix) && strings.EqualFold(rawURL[:len(queryPrefix)], queryPrefix) {
		k := rawURL[len(queryPrefix):]
		if dec, err := url.QueryUnescape(k); err == nil {
			return ExtractKeyFromAllowedPrefixes(prefixes, dec)
		}
		return ExtractKeyFromAllowedPrefixes(prefixes, k)
	}
	if strings.Contains(strings.ToLower(rawURL), strings.ToLower(proxy)) {
		if u, err := url.Parse(rawURL); err == nil {
			if k := u.Query().Get("key"); k != "" {
				return ExtractKeyFromAllowedPrefixes(prefixes, k)
			}
		}
	}
	if strings.HasPrefix(rawURL, "http://") || strings.HasPrefix(rawURL, "https://") {
		if u, err := url.Parse(rawURL); err == nil {
			return ExtractKeyFromAllowedPrefixes(prefixes, u.Path)
		}
	}
	if strings.Contains(rawURL, "?") {
		if u, err := url.Parse(rawURL); err == nil {
			return ExtractKeyFromAllowedPrefixes(prefixes, u.Path)
		}
	}
	return ExtractKeyFromAllowedPrefixes(prefixes, rawURL)
}
