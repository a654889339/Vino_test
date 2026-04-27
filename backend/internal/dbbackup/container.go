package dbbackup

import (
	"os"
	"strings"
)

var mysqlDumpContainerYAML string

// SetMysqlDumpContainerFromYAML 由 cmd/server 在加载 common/config/db 后调用。
func SetMysqlDumpContainerFromYAML(name string) {
	mysqlDumpContainerYAML = strings.TrimSpace(name)
}

// MysqlExecContainer docker exec 目标（与 mysqldump 一致）。
func MysqlExecContainer() string {
	if mysqlDumpContainerYAML != "" {
		return mysqlDumpContainerYAML
	}
	if v := strings.TrimSpace(os.Getenv("MYSQL_DUMP_CONTAINER")); v != "" {
		return v
	}
	return "vino-mysql"
}
