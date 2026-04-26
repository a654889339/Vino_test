package handlers

import (
	"sort"
	"strings"

	"vino/backend/internal/db"
	"vino/backend/internal/resp"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// admin 各页对应主要业务表（管理后台调用的读写字典）；debugTocData 在响应里单独展开为全量 GORM 表。
var adminPageTableMap = map[string]struct {
	Label  string
	Tables []string
}{
	"overview": {
		Label:  "概览",
		Tables: []string{"orders", "goods_orders", "page_visit_daily", "users"},
	},
	"orders":         {Label: "服务订单管理", Tables: []string{"orders", "order_logs"}},
	"goodsOrders":    {Label: "商品订单管理", Tables: []string{"goods_orders", "goods_order_items", "goods_order_logs"}},
	"users":          {Label: "用户管理", Tables: []string{"users"}},
	"guides":         {Label: "商品配置", Tables: []string{"device_guides", "product_categories"}},
	"serviceConfig":  {Label: "服务配置", Tables: []string{"service_categories", "services"}},
	"inventory":      {Label: "商品库存", Tables: []string{"inventory_categories", "inventory_products", "user_products"}},
	"homeConfig":     {Label: "首页配置", Tables: []string{"home_configs", "device_guides", "product_categories", "user_products"}},
	"homeAnimConfig": {Label: "首页动画配置", Tables: []string{"home_configs"}},
	"pageThemeConfig": {Label: "页面基础配置", Tables: []string{"home_configs", "i18n_texts"}},
	"i18nConfig":     {Label: "语言翻译", Tables: []string{"i18n_texts"}},
	"messages":       {Label: "留言板", Tables: []string{"messages"}},
	"debugTocData":   {Label: "ToC 数据调试", Tables: []string{}},
	"debugTocPage":  {Label: "ToC 页面配置调试", Tables: []string{"home_configs", "i18n_texts", "device_guides"}},
	"debugFeatureFlags": {Label: "功能开关", Tables: []string{}},

	"outletOverview":       {Label: "服务商-概览", Tables: []string{"outlet_orders", "outlet_users", "page_visit_daily"}},
	"outletOrders":         {Label: "服务商-订单", Tables: []string{"outlet_orders", "outlet_order_logs", "outlet_users"}},
	"outletUsers":          {Label: "服务商-用户", Tables: []string{"outlet_users"}},
	"outletServiceConfig":  {Label: "服务商-服务配置", Tables: []string{"outlet_service_categories", "outlet_services"}},
	"outletHomeConfig":     {Label: "服务商-首页配置", Tables: []string{"outlet_home_configs"}},
	"outletHomeAnimConfig": {Label: "服务商-首页动画", Tables: []string{"outlet_home_configs"}},
	"outletMineConfig":     {Label: "服务商-个人中心", Tables: []string{"outlet_home_configs"}},
	"outletMessages":       {Label: "服务商-留言", Tables: []string{"outlet_messages", "outlet_users"}},
}

// adminGetDbCatalog GET /api/admin/db-catalog
func adminGetDbCatalog(c *gin.Context) {
	var dbname string
	if err := db.DB.Raw("SELECT DATABASE()").Scan(&dbname).Error; err != nil {
		resp.Err(c, 500, 500, "读取库名失败")
		return
	}
	dbname = strings.TrimSpace(dbname)

	// 由 GORM 管理的主业务表全量（用于 ToC 数据调试用）
	managed := map[string]struct{}{}
	for _, ent := range db.ManagedModelEntities() {
		if tn := gormTableName(db.DB, ent); tn != "" {
			managed[tn] = struct{}{}
		}
	}

	pages := make([]gin.H, 0, len(adminPageTableMap))
	for page, def := range adminPageTableMap {
		tb := def.Tables
		if page == "debugTocData" {
			for t := range managed {
				tb = append(tb, t)
			}
		}
		seen := map[string]struct{}{}
		ut := make([]string, 0, len(tb))
		for _, t := range tb {
			t = strings.TrimSpace(t)
			if t == "" {
				continue
			}
			if _, ok := seen[t]; ok {
				continue
			}
			seen[t] = struct{}{}
			ut = append(ut, t)
		}
		sort.Strings(ut)
		pages = append(pages, gin.H{
			"page":  page,
			"label": def.Label,
			"tables": ut,
		})
	}
	sort.Slice(pages, func(i, j int) bool {
		a, _ := pages[i]["page"].(string)
		b, _ := pages[j]["page"].(string)
		return a < b
	})

	want := map[string]struct{}{}
	for page, def := range adminPageTableMap {
		for _, t := range def.Tables {
			want[strings.TrimSpace(t)] = struct{}{}
		}
		if page == "debugTocData" {
			for t := range managed {
				want[t] = struct{}{}
			}
		}
	}
	names := make([]string, 0, len(want))
	for t := range want {
		if t != "" {
			names = append(names, t)
		}
	}
	sort.Strings(names)
	if len(names) == 0 {
		resp.OK(c, gin.H{
			"database":   dbname,
			"pages":      []gin.H{},
			"tableColumns": map[string]any{},
			"managedTableCount": 0,
		})
		return
	}

	rows := make([]struct {
		Table    string
		Column   string
		ColType  string `gorm:"column:column_type"`
		Nullable string `gorm:"column:is_nullable"`
		ColKey   string `gorm:"column:column_key"`
		ColExtra string `gorm:"column:extra"`
		Pos      int    `gorm:"column:ordinal_position"`
	}, 0)
	if err := db.DB.Raw(`
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA, ORDINAL_POSITION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ?
ORDER BY TABLE_NAME, ORDINAL_POSITION`, names).Scan(&rows).Error; err != nil {
		resp.Err(c, 500, 500, "读取表结构失败: "+err.Error())
		return
	}

	tableCols := make(map[string]any)
	for i := range rows {
		r := &rows[i]
		if tableCols[r.Table] == nil {
			tableCols[r.Table] = []any{}
		}
		extra := r.ColExtra
		var extraPtr *string
		if extra != "" {
			extraPtr = &extra
		}
		col := map[string]any{
			"name":    r.Column,
			"colType": r.ColType,
			"nullable": r.Nullable,
			"key":     r.ColKey,
		}
		if extraPtr != nil {
			col["extra"] = *extraPtr
		}
		lst := tableCols[r.Table].([]any)
		tableCols[r.Table] = append(lst, col)
	}

	resp.OK(c, gin.H{
		"database":  dbname,
		"pages":     pages,
		"tableColumns": tableCols,
		"managedTableCount": len(managed),
	})
}

func gormTableName(d *gorm.DB, model any) string {
	if d == nil {
		return ""
	}
	stmt := &gorm.Statement{DB: d}
	if err := stmt.Parse(model); err != nil {
		return ""
	}
	if stmt.Schema == nil {
		return ""
	}
	return stmt.Schema.Table
}
