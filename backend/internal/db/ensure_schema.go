package db

import (
	"fmt"
	"regexp"
	"strings"

	"vino/backend/internal/models"

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
		&models.FrontPageConfigHomepageCarousel{},
		&models.DeviceGuide{},
		&models.Address{},
		&models.OutletAddress{},
		&models.Message{},
		&models.OutletMessage{},
		&models.InventoryCategory{},
		&models.InventoryProduct{},
		&models.UserProduct{},
		&models.CartItem{},
		&models.OutletServiceCategory{},
		&models.OutletService{},
		&models.OutletHomeConfig{},
		&models.PageVisitDaily{},
		&models.I18nText{},
	}
}

var (
	reIntWidth = regexp.MustCompile(`(?i)(tinyint|smallint|mediumint|int|bigint)\s*\(\d+\)`)
	reUnifyWS  = regexp.MustCompile(`\s+`)
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
	if mm, ok := migr.(interface {
		FullDataTypeOf(*schema.Field) clause.Expr
	}); ok {
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

// validatePhysicalColumns 若表/列已存在，则与 GORM 预期类型做比对；类型不符合预期则失败。
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
			// MySQL 对 mediumtext/longtext 与 text 的显示存在细微差异。
			if strings.HasPrefix(ne, "varchar") && strings.HasPrefix(na, "varchar") && ne == na {
				continue
			}
			return fmt.Errorf("schema 不一致且无法安全忽略: 表 %s 列 %s: 代码期望 %s, 实际 %s (norm: %q vs %q)", tn, field.DBName, exp, ct, ne, na)
		}
	}
	return nil
}

// SchemaColumnAdd 表示在**已存在**的表上新增的一列（用于在 main 中打 db_modify 点）。
type SchemaColumnAdd struct {
	Table, Column string
}

// SchemaEnsureDiff 迁移「前后」对业务库的差异（在 main 里转 db_add / db_modify 打点）。
type SchemaEnsureDiff struct {
	Database          string
	NewTables         []string
	ColumnsOnExisting []SchemaColumnAdd
}

// computeSchemaDiff 对比 AutoMigrate 前后全库列集合，区分新表与在旧表上新增的列。
func computeSchemaDiff(databaseName string, before, after map[string]map[string]string) *SchemaEnsureDiff {
	out := &SchemaEnsureDiff{Database: databaseName}
	for t := range after {
		if _, had := before[t]; !had {
			out.NewTables = append(out.NewTables, t)
		}
	}
	for t, afterCols := range after {
		bf, ok := before[t]
		if !ok {
			continue
		}
		for col := range afterCols {
			if _, ex := bf[col]; !ex {
				out.ColumnsOnExisting = append(out.ColumnsOnExisting, SchemaColumnAdd{Table: t, Column: col})
			}
		}
	}
	return out
}

func currentDatabaseName(d *gorm.DB) (string, error) {
	var name string
	if err := d.Raw("SELECT DATABASE()").Scan(&name).Error; err != nil {
		return "", err
	}
	return strings.TrimSpace(name), nil
}

// EnsureAppSchema 在 AutoMigrate 前校验已存在列类型，再执行 AutoMigrate，并返回差异供主程序打点；失败时返回错误以终止启动。
func EnsureAppSchema() (*SchemaEnsureDiff, error) {
	if DB == nil {
		return nil, fmt.Errorf("DB 未初始化")
	}
	d := DB
	dbName, err := currentDatabaseName(d)
	if err != nil {
		return nil, err
	}
	before, err := snapshotTableColumns(d)
	if err != nil {
		return nil, fmt.Errorf("schema snapshot(before): %w", err)
	}
	if err := validatePhysicalColumns(d, before); err != nil {
		return nil, err
	}
	ents := ManagedModelEntities()
	if err := d.AutoMigrate(ents...); err != nil {
		return nil, fmt.Errorf("AutoMigrate: %w", err)
	}
	after, err := snapshotTableColumns(d)
	if err != nil {
		return nil, fmt.Errorf("schema snapshot(after): %w", err)
	}
	return computeSchemaDiff(dbName, before, after), nil
}
