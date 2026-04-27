package cosbase

import "sync/atomic"

var cosRuleConfigVersion int64

// SetCosRuleConfigVersion 在服务端由 cosrule 在启动/定时同步 OSS 时写入；仅内存。
func SetCosRuleConfigVersion(v int64) {
	atomic.StoreInt64(&cosRuleConfigVersion, v)
}

// CosRuleConfigVersion 与 OSS 中 rmelamine.media 类的 cosRuleConfigVersion 对齐（若拉取失败则为本地缺省值）。
func CosRuleConfigVersion() int64 {
	return atomic.LoadInt64(&cosRuleConfigVersion)
}
