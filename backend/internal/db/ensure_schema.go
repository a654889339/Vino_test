package db

import (
	"fmt"
	"regexp"
	"strings"

	"vino/backend/internal/models"
	"vino/backend/internal/stat"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
)

// ManagedModelEntities 与 AutoMigrate 列表一一对应，供启动时结构校验与 admin 数据字典用。
func ManagedModelEntities() []any {
	return []any{
		&models.User{},
		&models.OutletUser{},
		&models.Order{},
		&models.OrderLog{},
		&models.GoodsOrder{},
		&models.GoodsOrderItem{},
		&models.GoodsOrderLog{},
		&models.OutletOrder{},
		&models.OutletOrderLog{},
		&models.ServiceCategory{},
		&models.Service{},
		&models.ProductCategory{},
		&models.HomeConfig{},
		&models.DeviceGuide{},
		&models.Address{},
		&models.OutletAddress{},
		&models.Message{},
		&models.OutletMessage{},
		&models.InventoryCategory{},
		&models.InventoryProduct{},
		&models.UserProduct{},
		&models.OutletServiceCategory{},
		&models.OutletService{},
		&models.OutletHomeConfig{},
		&models.PageVisitDaily{},
		&models.I18nText{},
	}
}

var (
	reIntWidth  = regexp.MustCompile(`(?i)(tinyint|smallint|mediumint|int|bigint)\s*\(\d+\)`)
	reUnifyWS   = regexp.MustCompile(`\s+`)
)

// normalizeMySQLTypeForCompare 在比对「GORM 期望的列类型」与 information_schema 的 COLUMN_TYPE 时
// 忽略整型 display width 等无实质差异的写法，避免 int(10)/int(11) 等误报。
func normalizeMySQLTypeForCompare(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	s = reIntWidth.ReplaceAllString(s, "$1")
	s = reUnifyWS.ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

func fullDataTypeSQL(d *gorm.DB, field *schema.Field) string {
	migr := d.Migrator()
	if mm, ok := migr.(interface{ FullDataTypeOf(*schema.Field) clause.Expr }); ok {
		return strings.TrimSpace(mm.FullDataTypeOf(field).SQL)
	}
	return ""
}

// snapshotTableColumns 返回 map[表名(大小写如库中)][列名][COLUMN_TYPE 原文]
func snapshotTableColumns(d *gorm.DB) (map[string]map[string]string, error) {
	rows := make([]struct {
		TableName  string
		ColumnName string
		ColumnType string
	}, 0)
	if err := d.Raw(`
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
`).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[string]map[string]string)
	for _, r := range rows {
		if out[r.TableName] == nil {
			out[r.TableName] = make(map[string]string)
		}
		out[r.TableName][r.ColumnName] = r.ColumnType
	}
	return out, nil
}

// validatePhysicalColumns 若表/列已存在，则与 GORM 预期类型做比对；已存在但类型不可兼容则失败。
func validatePhysicalColumns(d *gorm.DB, before map[string]map[string]string) error {
	for _, m := range ManagedModelEntities() {
		stmt := &gorm.Statement{DB: d}
		if err := stmt.Parse(m); err != nil {
			return fmt.Errorf("parse model: %w", err)
		}
		tn := stmt.Schema.Table
		cols, ok := before[tn]
		if !ok || len(cols) == 0 {
			continue
		}
		for _, field := range stmt.Schema.Fields {
			if field.IgnoreMigration {
				continue
			}
			if field.DBName == "" {
				continue
			}
			ct, have := cols[field.DBName]
			if !have {
				continue
			}
			exp := fullDataTypeSQL(d, field)
			if exp == "" {
				// 无法从方言解析时跳过，避免无 GORM 方言时启动失败
				continue
			}
			ne, na := normalizeMySQLTypeForCompare(exp), normalizeMySQLTypeForCompare(ct)
			if ne == na {
				continue
			}
			// 对 enum/text 等，尽量严格；若规约后仍不同则失败
			if strings.EqualFold(ne, na) {
				continue
			}
			// 兼容 MySQL 对 mediumtext/longtext 与 text 的细微显示差异
			if strings.HasPrefix(ne, "varchar") && strings.HasPrefix(na, "varchar") && ne == na {
				continue
			}
			return fmt.Errorf("schema 不一致且无法安全忽略: 表 %s 列 %s: 代码期望 %s, 实际 %s (norm: %q vs %q)", tn, field.DBName, exp, ct, ne, na)
		}
	}
	return nil
}

// diffAndStatSchema 对比迁移前后全库列集合，对「新建表」「在已有表上新增列」分别打点 db_add / db_modify。
func diffAndStatSchema(databaseName string, before, after map[string]map[string]string) {
	// 新建表
	for t, afterCols := range after {
		_, had := before[t]
		if !had {
			stat.Record("db_add", map[string]interface{}{
				"source":   "db",
				"action":   "db_add",
				"database": databaseName,
				"table":    t,
			})
			// 新表不单独对每列打 db_modify
			_ = afterCols
		}
	}
	// 在已有表上新增列
	for t, afterCols := range after {
		bf, ok := before[t]
		if !ok {
			continue
		}
		for col := range afterCols {
			if _, ex := bf[col]; !ex {
				stat.Record("db_modify", map[string]interface{}{
					"source":   "db",
					"action":   "db_modify",
					"database": databaseName,
					"table":    t,
					"column":   col,
					"reason":   "column_added",
				})
			}
		}
	}
}

func currentDatabaseName(d *gorm.DB) (string, error) {
	var name string
	if err := d.Raw("SELECT DATABASE()").Scan(&name).Error; err != nil {
		return "", err
	}
	return strings.TrimSpace(name), nil
}

// EnsureAppSchema 在 AutoMigrate 前校验已存在列类型；执行 AutoMigrate；再比较前后差异并打点；失败时返回错误以终止启动。
func EnsureAppSchema() error {
	if DB == nil {
		return fmt.Errorf("DB 未初始化")
	}
	d := DB
	dbName, err := currentDatabaseName(d)
	if err != nil {
		return err
	}
	before, err := snapshotTableColumns(d)
	if err != nil {
		return fmt.Errorf("schema snapshot(before): %w", err)
	}
	if err := validatePhysicalColumns(d, before); err != nil {
		return err
	}
	ents := ManagedModelEntities()
	if err := d.AutoMigrate(ents...); err != nil {
		return fmt.Errorf("AutoMigrate: %w", err)
	}
	after, err := snapshotTableColumns(d)
	if err != nil {
		return fmt.Errorf("schema snapshot(after): %w", err)
	}
	diffAndStatSchema(dbName, before, after)
	return nil
}
