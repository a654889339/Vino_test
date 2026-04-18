package middleware

import (
	"strings"
	"time"

	"vino/backend/internal/audit"

	"github.com/gin-gonic/gin"
)

// HTTPAuditLog logs each completed /api request with authenticated user (if any).
func HTTPAuditLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if !strings.HasPrefix(path, "/api") {
			c.Next()
			return
		}
		t0 := time.Now()
		c.Next()
		uid, role := 0, ""
		if u, ok := GetUser(c); ok {
			uid, role = u.ID, u.Role
		}
		audit.LogHTTP(audit.HTTPPayload{
			Method:   c.Request.Method,
			Path:     path,
			Query:    c.Request.URL.RawQuery,
			Status:   c.Writer.Status(),
			Latency:  time.Since(t0).String(),
			UserID:   uid,
			UserRole: role,
			ClientIP: c.ClientIP(),
		})
	}
}
