package dbbase

import (
	"errors"

	mysqlDriver "github.com/go-sql-driver/mysql"
)

// IsMySQLTableMissingErr reports whether err indicates a missing table (MySQL errno 1146).
// 用于“自举”：当业务查询/写入命中缺表时，触发 AutoMigrate/建表后重试。
func IsMySQLTableMissingErr(err error) bool {
	if err == nil {
		return false
	}
	var me *mysqlDriver.MySQLError
	if errors.As(err, &me) {
		return me.Number == 1146
	}
	return false
}

// RetryOnMissingTable 执行 run；若报 MySQL 1146（缺表），则先执行 ensure（自举/建表），再重试一次 run。
// - ensure 失败则返回 ensure 的错误
// - ensure 成功但重试仍失败则返回重试错误
func RetryOnMissingTable(run func() error, ensure func() error) error {
	if run == nil {
		return nil
	}
	if err := run(); err != nil {
		if !IsMySQLTableMissingErr(err) || ensure == nil {
			return err
		}
		if err2 := ensure(); err2 != nil {
			return err2
		}
		return run()
	}
	return nil
}
