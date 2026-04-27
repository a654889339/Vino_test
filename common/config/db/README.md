# common/config/db

进程内 **MySQL 整点逻辑备份** 的 YAML 契约：调度开关、tick 间隔、时区、是否补跑错过的整点、`mysqldump` 容器名等。数据库连接串仍由各项目 `.env` / `config.Load()` 提供。

## 格式约定

**本目录仅使用 YAML**（推荐扩展名 `.yaml`），与 [`common/config/cos`](../cos/README.md) 一致；勿提交 JSON。

## 文件

| 文件 | 说明 |
|------|------|
| `defaults.example.yaml` | 占位示例 |
| `rmelamine.db.yaml` | R-Melamine 默认（容器名 `r-melamine-mysql`） |
| `vino.db.yaml` | Vino_test 默认（容器名 `vino-mysql`） |
| `rmelamine.schema.yaml` | R-Melamine 全表结构契约（表清单入口） |
| `vino.schema.yaml` | Vino 全表结构契约（表清单入口） |
| `rmelamine.schema.columns.yaml` | R-Melamine 列级 schema（information_schema 导出，启动可强校验） |
| `vino.schema.columns.yaml` | Vino 列级 schema（information_schema 导出，启动可强校验） |

## 加载

后端通过环境变量 **`DB_BACKUP_CONFIG`** 指向 YAML 绝对或相对路径；未设置时使用 `../common/config/db/<project>.db.yaml`（相对 `backend` 工作目录）。

## 同步

`COLOMO_Like/R-Melamine/common/config/db` 与 `Vino_test/common/config/db` 下同名 YAML 与 README 保持逐字一致。
