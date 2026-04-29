package dbbase

import (
	"fmt"
	"os"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// SchemaTablesDoc 是“全表清单契约”（人读/工具读入口）。
// 仅声明表名集合，用于治理：确保项目后端实际使用到的所有表都已在 common/config/db/<project>.schema.yaml 中登记。
type SchemaTablesDoc struct {
	Project string   `yaml:"project"`
	Source  string   `yaml:"source,omitempty"`
	Notes   string   `yaml:"notes,omitempty"`
	Tables  []string `yaml:"tables"`
}

func LoadSchemaTablesYAML(path string) (*SchemaTablesDoc, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var d SchemaTablesDoc
	if err := yaml.Unmarshal(b, &d); err != nil {
		return nil, err
	}
	d.Project = strings.TrimSpace(d.Project)
	for i := range d.Tables {
		d.Tables[i] = strings.TrimSpace(d.Tables[i])
	}
	return &d, nil
}

func normalizeTableSet(in []string) map[string]struct{} {
	out := map[string]struct{}{}
	for _, t := range in {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		out[t] = struct{}{}
	}
	return out
}

// CompareSchemaTableSet 做“集合一致性”校验：
// - usedTables: 项目后端实际会用到/会 AutoMigrate 的表集合（来源于模型注册表）
// - expected: common/config/db/<project>.schema.yaml 声明的表集合
// 要求两者完全一致，避免“后端新增表忘记登记”或“登记了已废弃表”。
func CompareSchemaTableSet(usedTables []string, expected *SchemaTablesDoc) error {
	if expected == nil {
		return fmt.Errorf("expected schema tables doc is nil")
	}
	expSet := normalizeTableSet(expected.Tables)
	usedSet := normalizeTableSet(usedTables)
	var missingInYaml []string
	for t := range usedSet {
		if _, ok := expSet[t]; !ok {
			missingInYaml = append(missingInYaml, t)
		}
	}
	var extraInYaml []string
	for t := range expSet {
		if _, ok := usedSet[t]; !ok {
			extraInYaml = append(extraInYaml, t)
		}
	}
	sort.Strings(missingInYaml)
	sort.Strings(extraInYaml)
	if len(missingInYaml) == 0 && len(extraInYaml) == 0 {
		return nil
	}
	return fmt.Errorf("schema tables mismatch (project=%s) missingInYaml=%v extraInYaml=%v", expected.Project, missingInYaml, extraInYaml)
}
