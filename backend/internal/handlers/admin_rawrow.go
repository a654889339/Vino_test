package handlers

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"vino/backend/internal/db"
	"vino/backend/internal/middleware"
	"vino/backend/internal/resp"
	"vino/backend/internal/stat"

	"github.com/gin-gonic/gin"
)

// tableSpec 描述一张表在「通用 raw-row 编辑器」中的策略：
//   pk         主键列（物理列名）
//   readonly   只读列（GET 返回，PUT 忽略）
//   sensitive  敏感列（GET 不返回，PUT 忽略）
type tableSpec struct {
	pk        string
	readonly  []string
	sensitive []string
}

// 基线只读列集合：主键 id / 时间戳 / 行版本号
var baseReadonly = []string{"id", "version", "createdAt", "updatedAt", "created_at", "updated_at"}

// 白名单：只放管理员真正会去「详情/修改」的业务表。
var rawRowTableSpecs = map[string]tableSpec{
	"users": {
		pk: "id",
		// role 交由 super_admin 专属接口修改，此处只读避免绕过权限
		readonly:  append([]string{"role"}, baseReadonly...),
		sensitive: []string{"password"},
	},
	"outlet_users": {
		pk:        "id",
		readonly:  append([]string{"role"}, baseReadonly...),
		sensitive: []string{"password"},
	},
	// 订单金额锁死：price/totalPrice 等金额字段不允许任何入口修改
	"orders": {pk: "id", readonly: append([]string{
		"orderNo", "userId", "serviceId", "serviceTitle", "serviceTitleEn", "serviceIcon",
		"price",
	}, baseReadonly...)},
	"order_logs":       {pk: "id", readonly: append([]string{"orderId", "changeType", "oldValue", "newValue", "operator"}, baseReadonly...)},
	"goods_orders": {pk: "id", readonly: append([]string{
		"orderNo", "userId",
		"totalPrice", "currency",
	}, baseReadonly...)},
	"goods_order_items": {pk: "id", readonly: append([]string{
		"orderId", "guideId",
		"nameSnapshot", "imageUrl",
		"unitPrice", "originPrice", "currency",
		"qty", "lineTotal",
	}, baseReadonly...)},
	"goods_order_logs": {pk: "id", readonly: append([]string{"orderId", "changeType", "oldValue", "newValue", "operator"}, baseReadonly...)},
	"services":             {pk: "id", readonly: baseReadonly},
	"service_categories":   {pk: "id", readonly: baseReadonly},
	"product_categories":   {pk: "id", readonly: baseReadonly},
	"device_guides":        {pk: "id", readonly: baseReadonly},
	"inventory_products":   {pk: "id", readonly: baseReadonly},
	"inventory_categories": {pk: "id", readonly: baseReadonly},
	"user_products":        {pk: "id", readonly: baseReadonly},
	"cart_items": {pk: "id", readonly: append([]string{
		"userId", "guideId", "qty",
		"nameSnapshot", "unitPriceSnapshot", "currencySnapshot",
	}, baseReadonly...)},
	"home_configs":         {pk: "id", readonly: baseReadonly},
	"i18n_texts":           {pk: "id", readonly: baseReadonly},
	"messages":             {pk: "id", readonly: baseReadonly},
	"addresses":            {pk: "id", readonly: baseReadonly},
	"outlet_orders": {pk: "id", readonly: append([]string{
		"orderNo", "userId", "serviceId", "serviceTitle", "serviceIcon",
		"price",
	}, baseReadonly...)},
	"outlet_order_logs":    {pk: "id", readonly: append([]string{"orderId", "changeType", "oldValue", "newValue", "operator"}, baseReadonly...)},
	"outlet_services":            {pk: "id", readonly: baseReadonly},
	"outlet_service_categories":  {pk: "id", readonly: baseReadonly},
	"outlet_home_configs":        {pk: "id", readonly: baseReadonly},
	"outlet_messages":            {pk: "id", readonly: baseReadonly},
	"outlet_addresses":           {pk: "id", readonly: baseReadonly},
}

func inStrSlice(list []string, s string) bool {
	ls := strings.ToLower(s)
	for _, x := range list {
		if strings.ToLower(x) == ls {
			return true
		}
	}
	return false
}

type rawColumn struct {
	Name      string `json:"name"`
	Type      string `json:"type"`       // INFORMATION_SCHEMA.DATA_TYPE
	ColumnTyp string `json:"columnType"` // INFORMATION_SCHEMA.COLUMN_TYPE
	Nullable  bool   `json:"nullable"`
	PK        bool   `json:"pk"`
	Readonly  bool   `json:"readonly"`
	Sensitive bool   `json:"sensitive"`
}

// loadTableColumns 通过 INFORMATION_SCHEMA.COLUMNS 拿到给定表的列定义（当前 schema 下）。
func loadTableColumns(table string) ([]rawColumn, error) {
	type row struct {
		ColumnName string
		DataType   string
		IsNullable string
		ColumnType string
	}
	var rows []row
	if err := db.DB.Raw(`SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type, IS_NULLABLE as is_nullable, COLUMN_TYPE as column_type
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
ORDER BY ORDINAL_POSITION`, table).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]rawColumn, 0, len(rows))
	for _, r := range rows {
		out = append(out, rawColumn{
			Name:      r.ColumnName,
			Type:      strings.ToLower(r.DataType),
			ColumnTyp: r.ColumnType,
			Nullable:  strings.EqualFold(r.IsNullable, "YES"),
		})
	}
	return out, nil
}

// rawRowGet GET /api/admin/raw-row/:table/:id
//   返回 { columns:[{name,type,readonly,sensitive,...}], values:{<col>:<val>,...} }
func rawRowGet(c *gin.Context) {
	table := c.Param("table")
	spec, ok := rawRowTableSpecs[table]
	if !ok {
		resp.Err(c, 404, 404, "不支持的表或未授权: "+table)
		return
	}
	idStr := c.Param("id")
	if idStr == "" {
		resp.Err(c, 400, 400, "缺少主键")
		return
	}

	cols, err := loadTableColumns(table)
	if err != nil {
		resp.Err(c, 500, 500, "读取表结构失败: "+err.Error())
		return
	}
	if len(cols) == 0 {
		resp.Err(c, 404, 404, "表不存在: "+table)
		return
	}

	// 标注 pk / readonly / sensitive
	for i := range cols {
		if strings.EqualFold(cols[i].Name, spec.pk) {
			cols[i].PK = true
			cols[i].Readonly = true
		}
		if inStrSlice(spec.readonly, cols[i].Name) {
			cols[i].Readonly = true
		}
		if inStrSlice(spec.sensitive, cols[i].Name) {
			cols[i].Sensitive = true
		}
	}

	// 查询该行（排除 sensitive 字段的查询列）
	selectCols := make([]string, 0, len(cols))
	for _, col := range cols {
		if col.Sensitive {
			continue
		}
		selectCols = append(selectCols, "`"+col.Name+"`")
	}
	if len(selectCols) == 0 {
		resp.Err(c, 500, 500, "无可返回列")
		return
	}
	sql := "SELECT " + strings.Join(selectCols, ", ") + " FROM `" + table + "` WHERE `" + spec.pk + "` = ? LIMIT 1"
	rows, err := db.DB.Raw(sql, idStr).Rows()
	if err != nil {
		resp.Err(c, 500, 500, "查询失败: "+err.Error())
		return
	}
	defer rows.Close()
	if !rows.Next() {
		resp.Err(c, 404, 404, "记录不存在")
		return
	}
	rowCols, _ := rows.Columns()
	raw := make([]interface{}, len(rowCols))
	ptrs := make([]interface{}, len(rowCols))
	for i := range raw {
		ptrs[i] = &raw[i]
	}
	if err := rows.Scan(ptrs...); err != nil {
		resp.Err(c, 500, 500, "扫描失败: "+err.Error())
		return
	}
	values := make(map[string]interface{}, len(rowCols))
	for i, name := range rowCols {
		v := raw[i]
		switch vv := v.(type) {
		case []byte:
			values[name] = string(vv)
		default:
			values[name] = vv
		}
	}

	// 输出列（排除 sensitive）
	outCols := make([]rawColumn, 0, len(cols))
	for _, col := range cols {
		if col.Sensitive {
			continue
		}
		outCols = append(outCols, col)
	}

	resp.OK(c, gin.H{
		"table":   table,
		"pk":      spec.pk,
		"id":      idStr,
		"columns": outCols,
		"values":  values,
	})
}

// rawRowUpdate PUT /api/admin/raw-row/:table/:id
//   body: { values: { colName: value, ... } }
// 仅更新存在、非主键、非 readonly、非 sensitive 的列；根据 INFORMATION_SCHEMA 列类型做最小类型转换。
func rawRowUpdate(c *gin.Context) {
	table := c.Param("table")
	spec, ok := rawRowTableSpecs[table]
	if !ok {
		resp.Err(c, 404, 404, "不支持的表或未授权: "+table)
		return
	}
	idStr := c.Param("id")
	if idStr == "" {
		resp.Err(c, 400, 400, "缺少主键")
		return
	}

	var body struct {
		Values map[string]interface{} `json:"values"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误: "+err.Error())
		return
	}
	if len(body.Values) == 0 {
		resp.Err(c, 400, 400, "无待更新字段")
		return
	}

	cols, err := loadTableColumns(table)
	if err != nil {
		resp.Err(c, 500, 500, "读取表结构失败: "+err.Error())
		return
	}
	if len(cols) == 0 {
		resp.Err(c, 404, 404, "表不存在: "+table)
		return
	}

	// 构建可更新列 + 类型 map
	allowed := make(map[string]rawColumn, len(cols))
	for _, col := range cols {
		if strings.EqualFold(col.Name, spec.pk) {
			continue
		}
		if inStrSlice(spec.readonly, col.Name) {
			continue
		}
		if inStrSlice(spec.sensitive, col.Name) {
			continue
		}
		allowed[strings.ToLower(col.Name)] = col
	}

	filtered := make(map[string]interface{}, len(body.Values))
	skipped := make([]string, 0)
	for k, v := range body.Values {
		col, ok := allowed[strings.ToLower(k)]
		if !ok {
			skipped = append(skipped, k)
			continue
		}
		cv, cerr := coerceValueForColumn(col, v)
		if cerr != nil {
			resp.Err(c, 400, 400, fmt.Sprintf("字段 %s 类型错误: %s", col.Name, cerr.Error()))
			return
		}
		filtered[col.Name] = cv
	}
	if len(filtered) == 0 {
		resp.Err(c, 400, 400, "没有可更新的字段")
		return
	}

	result := db.DB.Table(table).Where("`"+spec.pk+"` = ?", idStr).Updates(filtered)
	if result.Error != nil {
		resp.Err(c, 500, 500, "更新失败: "+result.Error.Error())
		return
	}
	if result.RowsAffected == 0 {
		resp.Err(c, 404, 404, "记录不存在")
		return
	}
	changedKeys := make([]string, 0, len(filtered))
	for k := range filtered {
		changedKeys = append(changedKeys, k)
	}
	operatorID, operatorRole := 0, ""
	if u, ok := middleware.GetUser(c); ok {
		operatorID = u.ID
		operatorRole = u.Role
	}
	stat.Record("raw_row", gin.H{
		"source":         "admin",
		"action":         "admin.raw_row.update.detail",
		"table":          table,
		"id":             idStr,
		"changedKeys":    changedKeys,
		"skippedKeys":    skipped,
		"operatorUserId": operatorID,
		"operatorRole":   operatorRole,
		"requestPath":    c.Request.URL.Path,
		"clientIp":       c.ClientIP(),
		"status":         "success",
	})

	resp.OKDataMsg(c, gin.H{
		"updated": filtered,
		"skipped": skipped,
	}, "更新成功")
}

// coerceValueForColumn 按 INFORMATION_SCHEMA.DATA_TYPE 把 JSON 反序列化得到的 interface{}
// 转成 DB 可以吸收的类型；nil 原样返回（允许可空列置 NULL）。
func coerceValueForColumn(col rawColumn, v interface{}) (interface{}, error) {
	if v == nil {
		if !col.Nullable {
			return nil, fmt.Errorf("该列不允许为空")
		}
		return nil, nil
	}
	t := strings.ToLower(col.Type)
	switch t {
	case "tinyint", "smallint", "mediumint", "int", "integer", "bigint":
		return toInt64(v)
	case "decimal", "numeric", "float", "double":
		return toFloat64(v)
	case "bit", "bool", "boolean":
		return toBoolToInt(v)
	case "date", "datetime", "timestamp", "time", "year":
		s := strings.TrimSpace(fmt.Sprint(v))
		if s == "" && col.Nullable {
			return nil, nil
		}
		return s, nil
	case "json":
		switch vv := v.(type) {
		case string:
			return vv, nil
		default:
			b, err := json.Marshal(vv)
			if err != nil {
				return nil, err
			}
			return string(b), nil
		}
	default:
		switch vv := v.(type) {
		case string:
			return vv, nil
		case bool:
			if vv {
				return "1", nil
			}
			return "0", nil
		case float64:
			if vv == float64(int64(vv)) {
				return strconv.FormatInt(int64(vv), 10), nil
			}
			return strconv.FormatFloat(vv, 'f', -1, 64), nil
		case nil:
			return nil, nil
		default:
			b, err := json.Marshal(vv)
			if err != nil {
				return nil, err
			}
			return string(b), nil
		}
	}
}

func toInt64(v interface{}) (interface{}, error) {
	switch vv := v.(type) {
	case nil:
		return nil, nil
	case float64:
		return int64(vv), nil
	case int:
		return int64(vv), nil
	case int64:
		return vv, nil
	case bool:
		if vv {
			return int64(1), nil
		}
		return int64(0), nil
	case string:
		s := strings.TrimSpace(vv)
		if s == "" {
			return nil, nil
		}
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			if f, ferr := strconv.ParseFloat(s, 64); ferr == nil {
				return int64(f), nil
			}
			return nil, err
		}
		return n, nil
	}
	return nil, fmt.Errorf("无法解析为整数: %v", v)
}

func toFloat64(v interface{}) (interface{}, error) {
	switch vv := v.(type) {
	case nil:
		return nil, nil
	case float64:
		return vv, nil
	case int:
		return float64(vv), nil
	case int64:
		return float64(vv), nil
	case bool:
		if vv {
			return float64(1), nil
		}
		return float64(0), nil
	case string:
		s := strings.TrimSpace(vv)
		if s == "" {
			return nil, nil
		}
		return strconv.ParseFloat(s, 64)
	}
	return nil, fmt.Errorf("无法解析为数字: %v", v)
}

func toBoolToInt(v interface{}) (interface{}, error) {
	switch vv := v.(type) {
	case nil:
		return nil, nil
	case bool:
		if vv {
			return 1, nil
		}
		return 0, nil
	case float64:
		if vv != 0 {
			return 1, nil
		}
		return 0, nil
	case string:
		s := strings.TrimSpace(strings.ToLower(vv))
		if s == "1" || s == "true" || s == "yes" || s == "y" || s == "on" {
			return 1, nil
		}
		if s == "0" || s == "false" || s == "no" || s == "n" || s == "off" || s == "" {
			return 0, nil
		}
		return nil, fmt.Errorf("无法解析为布尔: %s", s)
	}
	return nil, fmt.Errorf("无法解析为布尔: %v", v)
}
