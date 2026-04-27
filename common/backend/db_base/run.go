package dbbase

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"strings"
	"time"

	"shared/cosbase"
)

// PutBackupFunc 上传 gzip 体到对象存储（如 OSS PutBytes、COS PutBackupObject）。
type PutBackupFunc func(ctx context.Context, key string, body []byte, contentType string) error

// RunHourlyParams 单次按「整点小时」命名键的备份。
type RunHourlyParams struct {
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string

	Location  *time.Location
	Hour      time.Time // 任意时区时刻，内部按 Location 截断到整点；仅当 ObjectKeyOverride 为空时用于生成键名

	// ObjectKeyOverride 非空时直接使用该对象键上传（如手动备份日路径 db_save/.../YYYY-MM/DD.sql.gz），仍须通过 ValidateBackupObjectKey。
	ObjectKeyOverride string

	ContainerName string
	DumpMode      string // docker|local

	// RefreshActiveDBName 可选：切库场景下在导出前刷新（如 R-Melamine）。
	RefreshActiveDBName func()
	// GetDBName 可选：Refresh 之后取当前主库名；nil 时使用 DBName。
	GetDBName func() string

	Put PutBackupFunc
}

// RunHourlyBackup mysqldump → gzip → 校验键 → Put；返回对象键与字节数。
func RunHourlyBackup(ctx context.Context, p RunHourlyParams) (objectKey string, gzLen, sqlLen int, err error) {
	if p.Put == nil {
		return "", 0, 0, fmt.Errorf("Put 未配置")
	}
	if p.Location == nil {
		p.Location = time.Local
	}
	if p.RefreshActiveDBName != nil {
		p.RefreshActiveDBName()
	}
	dbName := strings.TrimSpace(p.DBName)
	if p.GetDBName != nil {
		if s := strings.TrimSpace(p.GetDBName()); s != "" {
			dbName = s
		}
	}
	if dbName == "" {
		return "", 0, 0, fmt.Errorf("数据库名为空")
	}
	hour := p.Hour.In(p.Location).Truncate(time.Hour)
	if strings.TrimSpace(p.ObjectKeyOverride) != "" {
		objectKey = strings.TrimSpace(p.ObjectKeyOverride)
	} else {
		objectKey = cosbase.FormatDbSaveHourlyKey(dbName, hour, p.Location)
	}

	sqlOut, sqlErr, err := DumpLogical(ctx, DumpParams{
		Host:          p.DBHost,
		Port:          p.DBPort,
		User:          p.DBUser,
		Password:      p.DBPassword,
		DBName:        dbName,
		Mode:          p.DumpMode,
		ContainerName: p.ContainerName,
	})
	if err != nil {
		if sqlErr != "" {
			return objectKey, 0, 0, fmt.Errorf("%w: %s", err, sqlErr)
		}
		return objectKey, 0, 0, err
	}
	if len(sqlOut) == 0 {
		return objectKey, 0, 0, fmt.Errorf("mysqldump 输出为空")
	}
	if err := cosbase.ValidateBackupObjectKey(objectKey); err != nil {
		return objectKey, 0, len(sqlOut), err
	}
	var gzBuf bytes.Buffer
	gw := gzip.NewWriter(&gzBuf)
	if _, err := gw.Write(sqlOut); err != nil {
		return objectKey, 0, len(sqlOut), fmt.Errorf("gzip: %w", err)
	}
	if err := gw.Close(); err != nil {
		return objectKey, 0, len(sqlOut), fmt.Errorf("gzip close: %w", err)
	}
	if err := p.Put(ctx, objectKey, gzBuf.Bytes(), "application/gzip"); err != nil {
		return objectKey, gzBuf.Len(), len(sqlOut), err
	}
	return objectKey, gzBuf.Len(), len(sqlOut), nil
}
