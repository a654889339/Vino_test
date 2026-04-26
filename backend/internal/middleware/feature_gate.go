package middleware

import (
	"net/http"
	"strings"

	"vino/backend/internal/resp"
	"vino/backend/internal/services"

	"github.com/gin-gonic/gin"
)

// FeatureGate enforces maintenance mode (global) and provides a central allowlist.
// Per-feature gates (register/create-order/create-address) are enforced in handlers
// so that the response message can be specific.
func FeatureGate() gin.HandlerFunc {
	return func(c *gin.Context) {
		p := c.Request.URL.Path
		m := c.Request.Method

		flags := services.GetFeatureFlags()
		if !flags.MaintenanceMode {
			c.Next()
			return
		}

		// Allowlist during maintenance.
		if p == "/api/health" && m == http.MethodGet {
			c.Next()
			return
		}
		if p == "/api/app/status" && m == http.MethodGet {
			c.Next()
			return
		}
		if p == "/api/i18n" && m == http.MethodGet {
			c.Next()
			return
		}
		if p == "/api/media/cos-config" && m == http.MethodGet {
			c.Next()
			return
		}
		if p == "/api/media/catalog" && m == http.MethodGet {
			c.Next()
			return
		}
		if p == "/api/media/cos" && m == http.MethodGet {
			c.Next()
			return
		}
		if p == "/api/auth/login" && m == http.MethodPost {
			c.Next()
			return
		}
		if strings.HasPrefix(p, "/api/auth/send-") && m == http.MethodPost {
			c.Next()
			return
		}
		if p == "/api/outlet/auth/login" && m == http.MethodPost {
			c.Next()
			return
		}
		if strings.HasPrefix(p, "/api/outlet/auth/send-") && m == http.MethodPost {
			c.Next()
			return
		}

		resp.Err(c, 503, 503, "系统维护中")
		c.Abort()
	}
}

