package dbgate

import (
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

// mu 保护普通 API（读锁）与 DB 运维的独占段（写锁）之间的互斥。
var mu sync.RWMutex

// GinMiddleware 对除健康检查与「需独占锁」的 DB 运维接口外的请求持读锁，
// 与主库切换/恢复写锁互斥：恢复/切换期间新请求会阻塞，确保切换瞬间无并发 DB 调用。
func GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if path == "/api/health" {
			c.Next()
			return
		}
		if strings.HasPrefix(path, "/api/admin/ops/db/restore") || strings.HasPrefix(path, "/api/admin/ops/db/switch") {
			c.Next()
			return
		}
		mu.RLock()
		defer mu.RUnlock()
		c.Next()
	}
}

// WithWrite 主库切换、全库恢复等独占段：阻塞所有普通 API 读锁。
func WithWrite(fn func() error) error {
	mu.Lock()
	defer mu.Unlock()
	return fn()
}

// RLock / RUnlock 供后台任务在访问 db.DB 前短时加读锁。
func RLock()   { mu.RLock() }
func RUnlock() { mu.RUnlock() }
