package handlers

import (
	"strconv"
	"strings"

	"vino/backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func ctxUser(c *gin.Context) (middleware.CtxUser, bool) {
	return middleware.GetUser(c)
}

func queryInt(c *gin.Context, key string, def int) int {
	s := strings.TrimSpace(c.Query(key))
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

const adminListMaxPageSize = 50

// adminListPageParams 管理端列表统一分页：page 从 1 起，pageSize 默认 50、最大 50。
func adminListPageParams(c *gin.Context) (page, pageSize int) {
	page = queryInt(c, "page", 1)
	if page < 1 {
		page = 1
	}
	pageSize = queryInt(c, "pageSize", adminListMaxPageSize)
	if pageSize < 1 {
		pageSize = adminListMaxPageSize
	}
	if pageSize > adminListMaxPageSize {
		pageSize = adminListMaxPageSize
	}
	return page, pageSize
}

func parseID(c *gin.Context, param string) (int, bool) {
	s := c.Param(param)
	n, err := strconv.Atoi(s)
	if err != nil || n <= 0 {
		return 0, false
	}
	return n, true
}

// escapeLike 转义 SQL LIKE 中的 % 与 _
func escapeLike(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "%", "\\%")
	s = strings.ReplaceAll(s, "_", "\\_")
	return s
}

func firstNonEmptyStr(s, def string) string {
	if strings.TrimSpace(s) != "" {
		return s
	}
	return def
}

func firstNonEmpty(s, def string) string {
	return firstNonEmptyStr(s, def)
}
