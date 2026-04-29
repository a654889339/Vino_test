package db

import (
	"errors"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"gorm.io/gorm"
)

// IsMySQLTableMissingErr reports whether err indicates a missing table (MySQL errno 1146).
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

// EnsureTableExists makes sure the given model's table exists by running AutoMigrate(model).
// It is safe to call repeatedly; it is intended as a last-resort runtime bootstrap.
func EnsureTableExists(model any) error {
	if DB == nil {
		return gorm.ErrInvalidDB
	}
	return DB.AutoMigrate(model)
}

