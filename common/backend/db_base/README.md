# shared/dbbase

进程内 MySQL 逻辑全量备份（`mysqldump` → gzip → 对象存储 `db_save/…`）与整点调度。云上传通过调用方注入的 `Put` 闭包（OSS `PutBytes` / COS `PutBackupObject` 等）。

- **修改须双仓同步**：与 `Vino_test/common/backend/db_base` 同名文件逐字一致。
- 对象键与备份前缀校验见 `shared/cosbase`（`ValidateBackupObjectKey`、`FormatDbSaveHourlyKey`）。

## 引用

在 `backend/go.mod`：

```text
require shared/dbbase v0.0.0
replace shared/dbbase => ../common/backend/db_base
```

配置 YAML 见 `common/config/db/`；路径可由环境变量 `DB_BACKUP_CONFIG` 指定。

## 启动步骤抽象（DB 初始化/自举/启动自检）

`startup_steps.go` 提供通用的 `RunSteps(project, steps, onEvent)`，用于把两项目的：

- DB 连接
- schema 自举（AutoMigrate/EnsureSchema 等）
- bootstrap seed
- 启动自检/回填

按步骤串起来，减少 `cmd/server/main.go` 里重复的 “if err != nil { log.Fatalf… }” 模板代码。
