package dbbase

import (
	"database/sql"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// SchemaColumnsDoc 是 information_schema 导出的“列级 schema”文档。
// 作为运维/CI 可审查的契约文件；启动时可与线上 DB 结构做强校验。
type SchemaColumnsDoc struct {
	Project     string             `yaml:"project"`
	GeneratedAt string             `yaml:"generatedAt"`
	Database    string             `yaml:"database,omitempty"`
	Tables      []SchemaTableDoc   `yaml:"tables"`
}

type SchemaTableDoc struct {
	Name    string           `yaml:"name"`
	Columns []SchemaColumnDoc `yaml:"columns"`
}

type SchemaColumnDoc struct {
	Name       string `yaml:"name"`
	DataType   string `yaml:"dataType"`   // information_schema.data_type
	ColumnType string `yaml:"columnType"` // information_schema.column_type
	IsNullable bool   `yaml:"isNullable"`
	Default    *string `yaml:"default,omitempty"`
	Extra      string `yaml:"extra,omitempty"`
	Collation  string `yaml:"collation,omitempty"`
	Comment    string `yaml:"comment,omitempty"`
}

func boolFromYesNo(s string) bool {
	return strings.EqualFold(strings.TrimSpace(s), "YES")
}

// ExportInformationSchemaColumns 从当前连接的库导出 COLUMNS（按 TABLE_NAME/ORDINAL_POSITION 排序）。
// db 必须已选定 database（即 DSN 里带 dbname 或已 USE）。
func ExportInformationSchemaColumns(project string, db *sql.DB) (*SchemaColumnsDoc, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	var databaseName string
	if err := db.QueryRow("SELECT DATABASE()").Scan(&databaseName); err != nil {
		return nil, fmt.Errorf("select database(): %w", err)
	}
	type row struct {
		TableName        string
		ColumnName       string
		DataType         string
		ColumnType       string
		IsNullable       string
		ColumnDefault    sql.NullString
		Extra            string
		CollationName    sql.NullString
		ColumnComment    string
		OrdinalPosition  int
	}
	rows, err := db.Query(`
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME, COLUMN_COMMENT, ORDINAL_POSITION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME ASC, ORDINAL_POSITION ASC`)
	if err != nil {
		return nil, fmt.Errorf("query information_schema.columns: %w", err)
	}
	defer rows.Close()
	var all []row
	for rows.Next() {
		var r row
		if err := rows.Scan(
			&r.TableName, &r.ColumnName, &r.DataType, &r.ColumnType, &r.IsNullable, &r.ColumnDefault,
			&r.Extra, &r.CollationName, &r.ColumnComment, &r.OrdinalPosition,
		); err != nil {
			return nil, fmt.Errorf("scan information_schema.columns: %w", err)
		}
		all = append(all, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	byTable := map[string]*SchemaTableDoc{}
	tableOrder := make([]string, 0, 64)
	for _, r := range all {
		t := byTable[r.TableName]
		if t == nil {
			t = &SchemaTableDoc{Name: r.TableName}
			byTable[r.TableName] = t
			tableOrder = append(tableOrder, r.TableName)
		}
		var def *string
		if r.ColumnDefault.Valid {
			v := r.ColumnDefault.String
			def = &v
		}
		col := SchemaColumnDoc{
			Name:       r.ColumnName,
			DataType:   r.DataType,
			ColumnType: r.ColumnType,
			IsNullable: boolFromYesNo(r.IsNullable),
			Default:    def,
			Extra:      strings.TrimSpace(r.Extra),
			Comment:    r.ColumnComment,
		}
		if r.CollationName.Valid {
			col.Collation = r.CollationName.String
		}
		t.Columns = append(t.Columns, col)
	}
	sort.Strings(tableOrder)
	out := &SchemaColumnsDoc{
		Project:     strings.TrimSpace(project),
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Database:    strings.TrimSpace(databaseName),
	}
	for _, tn := range tableOrder {
		out.Tables = append(out.Tables, *byTable[tn])
	}
	return out, nil
}

func LoadSchemaColumnsYAML(path string) (*SchemaColumnsDoc, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var d SchemaColumnsDoc
	if err := yaml.Unmarshal(b, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

func WriteSchemaColumnsYAML(path string, d *SchemaColumnsDoc) error {
	if d == nil {
		return fmt.Errorf("doc is nil")
	}
	b, err := yaml.Marshal(d)
	if err != nil {
		return err
	}
	// yaml.v3 默认不保证尾部换行；统一加一行，便于 git diff。
	if len(b) == 0 || b[len(b)-1] != '\n' {
		b = append(b, '\n')
	}
	return os.WriteFile(path, b, 0o644)
}

// CompareSchemaColumns 做严格对齐：返回首个不一致错误（适合启动时 fatal）。
// 只比较 YAML 中声明的表/列集合：
// - YAML 缺表：允许（便于逐步引入），但如果表在 YAML 中声明则必须存在。
// - YAML 声明的列必须存在且核心属性一致。
// - 若 YAML 未声明任何表（tables 为空），则不校验「库中多出的表」，便于契约尚未导出时启动；
//   需要强白名单时请先运行 schema_export 填满列契约 YAML。
func CompareSchemaColumns(expected, actual *SchemaColumnsDoc) error {
	if expected == nil || actual == nil {
		return fmt.Errorf("expected/actual is nil")
	}
	expTable := map[string]SchemaTableDoc{}
	for _, t := range expected.Tables {
		expTable[t.Name] = t
	}
	actTable := map[string]SchemaTableDoc{}
	for _, t := range actual.Tables {
		actTable[t.Name] = t
	}
	// 1) expected tables must exist
	for tn := range expTable {
		if _, ok := actTable[tn]; !ok {
			return fmt.Errorf("missing table: %s", tn)
		}
	}
	// 2) actual must NOT contain extra tables（仅当契约里至少声明了一张表时才做强白名单）
	if len(expTable) > 0 {
		for tn := range actTable {
			if _, ok := expTable[tn]; !ok {
				return fmt.Errorf("unexpected table: %s", tn)
			}
		}
	}
	// 3) compare columns both directions
	for tn, et := range expTable {
		at := actTable[tn]
		expCols := map[string]SchemaColumnDoc{}
		for _, c := range et.Columns {
			expCols[c.Name] = c
		}
		actCols := map[string]SchemaColumnDoc{}
		for _, c := range at.Columns {
			actCols[c.Name] = c
		}
		for cn := range expCols {
			if _, ok := actCols[cn]; !ok {
				return fmt.Errorf("missing column: %s.%s", tn, cn)
			}
		}
		for cn := range actCols {
			if _, ok := expCols[cn]; !ok {
				return fmt.Errorf("unexpected column: %s.%s", tn, cn)
			}
		}
		for cn, ec := range expCols {
			ac := actCols[cn]
			if strings.TrimSpace(ec.DataType) != strings.TrimSpace(ac.DataType) {
				return fmt.Errorf("column mismatch %s.%s dataType: expected=%q actual=%q", tn, cn, ec.DataType, ac.DataType)
			}
			if strings.TrimSpace(ec.ColumnType) != strings.TrimSpace(ac.ColumnType) {
				return fmt.Errorf("column mismatch %s.%s columnType: expected=%q actual=%q", tn, cn, ec.ColumnType, ac.ColumnType)
			}
			if ec.IsNullable != ac.IsNullable {
				return fmt.Errorf("column mismatch %s.%s isNullable: expected=%v actual=%v", tn, cn, ec.IsNullable, ac.IsNullable)
			}
			expDef := ""
			if ec.Default != nil {
				expDef = *ec.Default
			}
			actDef := ""
			if ac.Default != nil {
				actDef = *ac.Default
			}
			if expDef != actDef {
				return fmt.Errorf("column mismatch %s.%s default: expected=%q actual=%q", tn, cn, expDef, actDef)
			}
			if strings.TrimSpace(ec.Extra) != strings.TrimSpace(ac.Extra) {
				return fmt.Errorf("column mismatch %s.%s extra: expected=%q actual=%q", tn, cn, ec.Extra, ac.Extra)
			}
		}
	}
	return nil
}

