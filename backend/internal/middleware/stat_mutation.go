package middleware

import (
	"strings"
	"time"

	"vino/backend/internal/stat"

	"github.com/gin-gonic/gin"
)

type statRouteMeta struct {
	EventType string
	Action    string
	Tables    []string
}

// StatMutationLog records typed stat events for mutating API requests. It is
// intentionally path based so new DB writes still get a coarse stat line even
// before a handler adds richer business-specific fields.
func StatMutationLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		if !isMutatingMethod(method) || !strings.HasPrefix(c.Request.URL.Path, "/api") {
			c.Next()
			return
		}
		t0 := time.Now()
		c.Next()
		meta := classifyStatRoute(method, c.Request.URL.Path)
		if meta.EventType == "" {
			return
		}
		uid, role := 0, ""
		if u, ok := GetUser(c); ok {
			uid, role = u.ID, u.Role
		}
		status := c.Writer.Status()
		result := "failed"
		if status >= 200 && status < 400 {
			result = "success"
		}
		payload := map[string]interface{}{
			"source":         requestSource(c, role),
			"action":         meta.Action,
			"method":         method,
			"requestPath":    c.Request.URL.Path,
			"status":         result,
			"httpStatus":     status,
			"latency":        time.Since(t0).String(),
			"operatorUserId": uid,
			"operatorRole":   role,
			"clientIp":       c.ClientIP(),
		}
		if len(meta.Tables) > 0 {
			payload["tables"] = meta.Tables
		}
		for _, key := range []string{"id", "userId", "table"} {
			if v := strings.TrimSpace(c.Param(key)); v != "" {
				payload[key] = v
			}
		}
		if status >= 400 && len(c.Errors) > 0 {
			payload["error"] = c.Errors.String()
		}
		stat.Record(meta.EventType, payload)
	}
}

func isMutatingMethod(method string) bool {
	switch method {
	case "POST", "PUT", "PATCH", "DELETE":
		return true
	default:
		return false
	}
}

func requestSource(c *gin.Context, role string) string {
	path := c.Request.URL.Path
	if strings.Contains(path, "/admin/ops/") || role == "super_admin" {
		return "super_admin"
	}
	if strings.Contains(path, "/admin/") || role == "admin" {
		return "admin"
	}
	if strings.HasPrefix(path, "/api/outlet/") {
		return "outlet"
	}
	if strings.HasPrefix(path, "/api/orders/wechat/notify") {
		return "wechat_notify"
	}
	ua := strings.ToLower(c.GetHeader("User-Agent"))
	switch {
	case strings.Contains(ua, "micromessenger"):
		return "wechat_mp"
	case strings.Contains(ua, "alipayclient"):
		return "alipay_mp"
	default:
		return "web"
	}
}

func classifyStatRoute(method, path string) statRouteMeta {
	switch {
	case strings.Contains(path, "/login"):
		if strings.HasPrefix(path, "/api/outlet/") {
			return statRouteMeta{"login", "outlet.login", []string{"outlet_users"}}
		}
		if strings.Contains(path, "wx-login") {
			return statRouteMeta{"login", "user.wx_login", []string{"users"}}
		}
		if strings.Contains(path, "alipay-login") {
			return statRouteMeta{"login", "user.alipay_login", []string{"users"}}
		}
		return statRouteMeta{"login", actionName(path, "login"), []string{"users"}}
	case strings.Contains(path, "/register"):
		if strings.HasPrefix(path, "/api/outlet/") {
			return statRouteMeta{"register", "outlet.register", []string{"outlet_users"}}
		}
		return statRouteMeta{"register", "user.register", []string{"users"}}
	case strings.HasPrefix(path, "/api/orders/wechat/notify"):
		return statRouteMeta{"order", "wechat.pay_notify", []string{"orders", "goods_orders"}}
	case strings.HasPrefix(path, "/api/orders/"):
		return statRouteMeta{"order", orderAction(method, path), []string{"orders", "order_logs"}}
	case strings.HasPrefix(path, "/api/goods-orders/"):
		return statRouteMeta{"goods_order", goodsOrderAction(method, path), []string{"goods_orders", "goods_order_items", "goods_order_logs"}}
	case strings.HasPrefix(path, "/api/cart"):
		return statRouteMeta{"cart", "cart.update", []string{"users"}}
	case strings.HasPrefix(path, "/api/addresses"):
		return statRouteMeta{"address", crudAction(method, path, "address"), []string{"addresses"}}
	case strings.HasPrefix(path, "/api/outlet/addresses"):
		return statRouteMeta{"address", crudAction(method, path, "outlet_address"), []string{"outlet_addresses"}}
	case strings.Contains(path, "/profile") || strings.Contains(path, "/bind-phone") || strings.Contains(path, "/upload-avatar") || strings.Contains(path, "/avatar") || strings.Contains(path, "/bind-product") || strings.Contains(path, "/bind-by-qr-image"):
		return statRouteMeta{"profile", profileAction(path), profileTables(path)}
	case strings.HasPrefix(path, "/api/admin/raw-row/"):
		return statRouteMeta{"raw_row", "admin.raw_row.update", nil}
	case strings.HasPrefix(path, "/api/admin/ops/"):
		return statRouteMeta{"ops", opsAction(path), []string{"home_configs"}}
	case strings.HasPrefix(path, "/api/admin/seed"):
		return statRouteMeta{"admin_db", "admin.seed", []string{"users", "services", "device_guides", "inventory_products"}}
	case strings.HasPrefix(path, "/api/i18n"):
		return statRouteMeta{"admin_db", crudAction(method, path, "i18n"), []string{"i18n_texts"}}
	case strings.HasPrefix(path, "/api/services"):
		return statRouteMeta{"admin_db", crudAction(method, path, "service"), []string{"services"}}
	case strings.HasPrefix(path, "/api/service-categories"):
		return statRouteMeta{"admin_db", crudAction(method, path, "service_category"), []string{"service_categories"}}
	case strings.HasPrefix(path, "/api/product-categories"):
		return statRouteMeta{"admin_db", crudAction(method, path, "product_category"), []string{"product_categories"}}
	case strings.HasPrefix(path, "/api/guides"):
		return statRouteMeta{"admin_db", crudAction(method, path, "device_guide"), []string{"device_guides"}}
	case strings.HasPrefix(path, "/api/home-config"):
		return statRouteMeta{"admin_db", crudAction(method, path, "home_config"), []string{"home_configs"}}
	case strings.HasPrefix(path, "/api/inventory"):
		return statRouteMeta{"admin_db", inventoryAction(method, path), []string{"inventory_categories", "inventory_products"}}
	case strings.HasPrefix(path, "/api/messages"):
		return statRouteMeta{"admin_db", messageAction(path), []string{"messages"}}
	case strings.HasPrefix(path, "/api/outlet/messages"):
		return statRouteMeta{"admin_db", messageAction(path), []string{"outlet_messages"}}
	case strings.HasPrefix(path, "/api/outlet/orders"):
		return statRouteMeta{"order", outletOrderAction(method, path), []string{"outlet_orders", "outlet_order_logs"}}
	case strings.HasPrefix(path, "/api/outlet/home-config"):
		return statRouteMeta{"admin_db", crudAction(method, path, "outlet_home_config"), []string{"outlet_home_configs"}}
	case strings.HasPrefix(path, "/api/outlet/service-categories"):
		return statRouteMeta{"admin_db", crudAction(method, path, "outlet_service_category"), []string{"outlet_service_categories"}}
	case strings.HasPrefix(path, "/api/outlet/services"):
		return statRouteMeta{"admin_db", crudAction(method, path, "outlet_service"), []string{"outlet_services"}}
	case strings.HasPrefix(path, "/api/auth/admin/users"):
		return statRouteMeta{"admin_db", authAdminAction(method, path), []string{"users", "orders", "addresses", "messages", "user_products"}}
	case strings.HasPrefix(path, "/api/analytics/page-view"):
		return statRouteMeta{"analytics", "analytics.page_view", []string{"page_visit_daily"}}
	default:
		return statRouteMeta{"db_mutation", strings.ToLower(method) + "." + strings.TrimPrefix(path, "/api/"), nil}
	}
}

func actionName(path, suffix string) string {
	if strings.HasPrefix(path, "/api/outlet/") {
		return "outlet." + suffix
	}
	return "user." + suffix
}

func crudAction(method, path, domain string) string {
	if strings.Contains(path, "/upload") {
		return domain + ".upload"
	}
	if strings.Contains(path, "/bulk") {
		return domain + ".bulk_upsert"
	}
	if strings.Contains(path, "/default") {
		return domain + ".set_default"
	}
	switch method {
	case "POST":
		return domain + ".create"
	case "PUT", "PATCH":
		return domain + ".update"
	case "DELETE":
		return domain + ".delete"
	default:
		return domain + "." + strings.ToLower(method)
	}
}

func orderAction(method, path string) string {
	switch {
	case strings.Contains(path, "/admin/") && strings.Contains(path, "/status"):
		return "service_order.admin_update_status"
	case strings.Contains(path, "/admin/") && strings.Contains(path, "/price"):
		return "service_order.admin_update_price"
	case strings.Contains(path, "/admin/") && strings.Contains(path, "/remark"):
		return "service_order.admin_add_remark"
	case strings.Contains(path, "/cancel"):
		return "service_order.cancel"
	case strings.Contains(path, "/pay-wechat"):
		return "service_order.pay_wechat"
	case method == "POST":
		return "service_order.create"
	default:
		return "service_order." + strings.ToLower(method)
	}
}

func goodsOrderAction(method, path string) string {
	switch {
	case strings.Contains(path, "/admin/") && strings.Contains(path, "/status"):
		return "goods_order.admin_update_status"
	case strings.Contains(path, "/admin/") && strings.Contains(path, "/price"):
		return "goods_order.admin_update_price"
	case strings.Contains(path, "/admin/") && strings.Contains(path, "/remark"):
		return "goods_order.admin_add_remark"
	case strings.Contains(path, "/checkout"):
		return "goods_order.checkout"
	case strings.Contains(path, "/pay-wechat"):
		return "goods_order.pay_wechat"
	default:
		return "goods_order." + strings.ToLower(method)
	}
}

func outletOrderAction(method, path string) string {
	if strings.Contains(path, "/admin/") {
		return "outlet_order.admin_update"
	}
	if strings.Contains(path, "/cancel") {
		return "outlet_order.cancel"
	}
	if method == "POST" {
		return "outlet_order.create"
	}
	return "outlet_order." + strings.ToLower(method)
}

func inventoryAction(method, path string) string {
	switch {
	case strings.Contains(path, "import-excel"):
		return "inventory.import_excel"
	case strings.Contains(path, "delete-excel"):
		return "inventory.batch_delete_excel"
	case strings.Contains(path, "/categories"):
		return crudAction(method, path, "inventory_category")
	case strings.Contains(path, "/products"):
		return crudAction(method, path, "inventory_product")
	default:
		return "inventory." + strings.ToLower(method)
	}
}

func profileAction(path string) string {
	switch {
	case strings.Contains(path, "bind-phone"):
		return "profile.bind_phone"
	case strings.Contains(path, "upload-avatar") || strings.Contains(path, "/avatar"):
		return "profile.upload_avatar"
	case strings.Contains(path, "bind-product"):
		return "profile.bind_product"
	case strings.Contains(path, "bind-by-qr-image"):
		return "profile.bind_by_qr"
	default:
		return "profile.update"
	}
}

func profileTables(path string) []string {
	if strings.Contains(path, "bind-product") || strings.Contains(path, "bind-by-qr-image") {
		return []string{"user_products", "inventory_products"}
	}
	if strings.HasPrefix(path, "/api/outlet/") {
		return []string{"outlet_users"}
	}
	return []string{"users"}
}

func messageAction(path string) string {
	if strings.Contains(path, "/admin/") {
		return "message.admin_reply"
	}
	if strings.Contains(path, "upload-image") {
		return "message.upload_image"
	}
	return "message.send"
}

func opsAction(path string) string {
	switch {
	case strings.Contains(path, "feature-flags"):
		return "ops.feature_flags"
	case strings.Contains(path, "audit-log-backup"):
		return "ops.audit_log_backup"
	case strings.Contains(path, "stat-log-backup"):
		return "ops.stat_log_backup"
	case strings.Contains(path, "db-backup"):
		return "ops.db_backup"
	case strings.Contains(path, "/db/restore"):
		return "ops.db_restore"
	case strings.Contains(path, "/db/switch"):
		return "ops.db_switch"
	default:
		return "ops.other"
	}
}

func authAdminAction(method, path string) string {
	if method == "DELETE" && strings.Contains(path, "/products/") {
		return "admin.user_unbind_product"
	}
	if method == "DELETE" {
		return "admin.user_delete"
	}
	if strings.Contains(path, "/role") {
		return "admin.user_role_update"
	}
	return "admin.user_update"
}
