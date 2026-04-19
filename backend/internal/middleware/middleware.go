package middleware

import (
	"strings"

	"vino/backend/internal/config"
	"vino/backend/internal/db"
	"vino/backend/internal/models"
	"vino/backend/internal/services"

	"github.com/gin-gonic/gin"
)

type CtxUser struct {
	ID       int
	Username string
	Role     string
	Realm    string // "" main app, "outlet" for outlet
}

func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		token := strings.TrimPrefix(h, "Bearer ")
		if token == "" {
			c.JSON(401, gin.H{"code": 401, "message": "未登录"})
			c.Abort()
			return
		}
		claims, err := services.ParseJWT(cfg, token)
		if err != nil {
			c.JSON(401, gin.H{"code": 401, "message": "Token已过期"})
			c.Abort()
			return
		}
		c.Set("user", CtxUser{ID: claims.ID, Username: claims.Username, Role: claims.Role, Realm: claims.Realm})
		c.Next()
	}
}

func Admin() gin.HandlerFunc {
	return func(c *gin.Context) {
		u, ok := c.Get("user")
		if !ok {
			c.JSON(401, gin.H{"code": 401, "message": "未登录"})
			c.Abort()
			return
		}
		if cu, ok := u.(CtxUser); ok && (cu.Role == "admin" || cu.Role == "super_admin") {
			c.Next()
			return
		}
		c.JSON(403, gin.H{"code": 403, "message": "无管理员权限"})
		c.Abort()
	}
}

// SuperAdmin 仅放行数据库中 role == super_admin 的账号；用于调试窗口与角色管理等高风险操作。
// 说明：JWT 内 role 在登录时写入，若之后在库中升降级角色，旧 token 不会自动更新。
// 此处以 DB 为准，避免界面（profile 读库）已是超级管理员而 /api/admin/ops/* 仍 403。
func SuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		u, ok := GetUser(c)
		if !ok {
			c.JSON(401, gin.H{"code": 401, "message": "未登录"})
			c.Abort()
			return
		}
		if u.Realm != "" {
			c.JSON(403, gin.H{"code": 403, "message": "需要超级管理员权限"})
			c.Abort()
			return
		}
		if db.DB == nil {
			c.JSON(503, gin.H{"code": 503, "message": "数据库未就绪"})
			c.Abort()
			return
		}
		var row models.User
		if err := db.DB.Select("id", "role", "status").Where("id = ?", u.ID).First(&row).Error; err != nil {
			c.JSON(403, gin.H{"code": 403, "message": "需要超级管理员权限"})
			c.Abort()
			return
		}
		if row.Status != "active" {
			c.JSON(403, gin.H{"code": 403, "message": "账号已禁用"})
			c.Abort()
			return
		}
		if row.Role != "super_admin" {
			c.JSON(403, gin.H{"code": 403, "message": "需要超级管理员权限"})
			c.Abort()
			return
		}
		c.Set("user", CtxUser{ID: u.ID, Username: u.Username, Role: row.Role, Realm: u.Realm})
		c.Next()
	}
}

func OutletAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		token := strings.TrimPrefix(h, "Bearer ")
		if token == "" {
			c.JSON(401, gin.H{"code": 401, "message": "未登录"})
			c.Abort()
			return
		}
		claims, err := services.ParseJWT(cfg, token)
		if err != nil {
			c.JSON(401, gin.H{"code": 401, "message": "Token已过期"})
			c.Abort()
			return
		}
		if claims.Realm != "outlet" {
			c.JSON(403, gin.H{"code": 403, "message": "非服务商账号"})
			c.Abort()
			return
		}
		c.Set("user", CtxUser{ID: claims.ID, Username: claims.Username, Role: claims.Role, Realm: claims.Realm})
		c.Next()
	}
}

func GetUser(c *gin.Context) (CtxUser, bool) {
	v, ok := c.Get("user")
	if !ok {
		return CtxUser{}, false
	}
	u, ok := v.(CtxUser)
	return u, ok
}
