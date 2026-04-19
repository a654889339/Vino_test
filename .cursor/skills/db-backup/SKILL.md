---
name: db-backup
description: >-
  Vino_test MySQL 逻辑备份：管理端「db备份」POST /api/admin/ops/db-backup（backend 容器内 mysqldump→gzip→腾讯云 COS db_save/）；
  宿主机脚本 scripts/db_backup_to_cos.sh（docker exec vino-mysql→coscli）。与 connectToTxCloud、更新发布 配合用于 106 服务器运维。
  用户提到 db 备份、db_save、mysqldump、COS 备份、caching_sha2 时使用。
---

# MySQL 数据库备份（Vino_test）

本文描述本仓库**已实现**的备份路径与对象键规则；**不包含**管理端「从 COS 一键恢复」或「切换主库名文件」（若需可参考 COLOMO_Like 的 `db-backup-restore` Skill 作对照，Vino 恢复一般为手工 `mysql` 导入或自建流程）。

## 何时查阅本 Skill

- 实现或排查 **管理端调试区「db备份」**、**审计日志备份** 相关逻辑。
- 配置 **106 服务器** cron + `db_backup_to_cos.sh` 定时备份。
- 备份失败：**COS 未配置**、**mysqldump 1045 / caching_sha2**、**导出为空**、**上传失败**。
- Agent 需说明备份**实际连接的 DB 地址**（compose 内 `vino-mysql:3306` 与宿主 `3308` 映射）。

---

## 能力总览

| 能力 | 执行位置 | 上传方式 | COS 对象键习惯 |
|------|----------|----------|----------------|
| **管理端「db备份」** | `vino-backend` 容器内 | `PutBackupObject`（SDK，`services/cos.go`） | `db_save/{主库名}/YYYY-MM/DD.sql.gz`（`cfg.DB.Name` + `time.Local`） |
| **宿主机定时备份（推荐生产）** | 宿主机 shell + `docker exec` | **coscli** 命令行 | 同上：`db_save/${DB_NAME}/YYYY-MM/DD.sql.gz`（`TZ=Asia/Shanghai`） |
| **进程内整点备份（新）** | `vino-backend` goroutine | `PutBackupObject`（同 SDK） | `db_save/{主库名}/YYYY-MM-DD/HH.sql.gz`（两位 HH，`Asia/Shanghai`） |

> 对象键规则（方案 A）：**按主库名分目录**。
> - 日/手动路径：`db_save/{db}/YYYY-MM/DD.sql.gz`
> - 小时/进程内路径：`db_save/{db}/YYYY-MM-DD/HH.sql.gz`
>
> 两种路径**不会互相覆盖**；管理端按钮跟随 `cfg.DB.Name`（切主库后跟随切换），宿主机脚本固定读 `.env` 的 `DB_NAME`。**不再产生扁平历史路径 `db_save/YYYY-MM/DD.sql.gz`**，但恢复侧仅要求 `/db_save/` 前缀，历史对象仍可用于恢复。

**设计原则（吸收自跨项目实践）**

- 备份上传走 **已配置的腾讯云 COS 凭证**（`COS_SECRET_ID` / `COS_SECRET_KEY`），**勿**把密钥写入 Skill 或提交 Git。
- `mysqldump` 客户端须与 **MySQL 8 `caching_sha2_password`** 兼容：`backend/Dockerfile` 使用 **mysql-client**（Alpine community），**避免**仅用 `mariadb-client`（缺插件会导致 1045 / `caching_sha2_password.so` 找不到）。
- 对象键统一在 **`db_save/`** 前缀下，与审计类备份（`log/backend/` 等）区分，见 `services/cos.go` 中 `validateBackupKey`。

---

## 路径一：HTTP API（管理端）

### 请求

| 项目 | 说明 |
|------|------|
| **方法 / 路径** | `POST /api/admin/ops/db-backup` |
| **鉴权** | `Authorization: Bearer <JWT>`，且需 **Admin**（`router.go` 中 `/api/admin/ops`） |
| **Body** | 可为空 `{}` |
| **实现** | `backend/internal/handlers/admin_ops.go` → `adminPostDbBackup` |

### 服务端流程（顺序）

1. 若 COS 未配置 → **503**，文案提示无法上传。
2. 若容器内找不到 `mysqldump` → **503**（镜像应含 `mysql-client`）。
3. `context` 超时 **25 分钟**。
4. 执行 `mysqldump`，参数包含：`-h DB_HOST`、`-P DB_PORT`、`-u DB_USER`、`MYSQL_PWD`、`--single-transaction`、`--routines`、`--events`、`--databases DB_NAME`。
5. 将 stdout 做 **gzip**，再 `PutBackupObject` 上传；`Content-Type`: `application/gzip`。
6. 成功返回 JSON：`cosKey`、`bytes`、`sqlBytes`、`bucket` 等。

### 备份时「访问的数据库」地址（标准 docker-compose）

由 **vino-backend 容器环境变量** 决定（`backend/internal/config` 读取）：

| 变量 | 默认（见仓库 `docker-compose.yaml`） | 含义 |
|------|----------------------------------------|------|
| `DB_HOST` | `vino-mysql` | Docker 网络内 MySQL 服务名 |
| `DB_PORT` | `3306` | 容器内端口 |
| `DB_NAME` | `vino_db` | 逻辑库名 |
| `DB_USER` / `DB_PASSWORD` | 与 compose 中 MySQL 一致 | 认证 |

**宿主 / 外网视角**：MySQL 映射到宿主 **`3308:3306`**，故在 106 上从宿主连库为 `127.0.0.1:3308`（或 `106.54.50.88:3308`），与 **API 备份使用的地址无关**（API 始终在 backend 容器内连 `vino-mysql:3306`）。

---

## 路径三：进程内整点备份（`StartHourlyDbBackup`）

### 入口与实现

- 注册位置：`backend/cmd/server/main.go`，在 `audit.StartUploader(cfg)` 之后调用 `handlers.StartHourlyDbBackup(cfg)`。
- 实现：`backend/internal/handlers/db_backup_scheduler.go`
  - `time.Ticker` 每 60s 一次 tick；
  - 上海时区 `time.Now().In(shanghaiLoc).Hour()` 与上次记录值不同即触发一次备份；
  - 对象键 `db_save/{cfg.DB.Name}/YYYY-MM-DD/HH.sql.gz`（`%02d` HH）；
  - 复用 `runDbBackupCore(ctx, cfg, cosKey)`，与管理端按钮走同一份 mysqldump/gzip/上传逻辑；
  - 失败只 `log.Printf`，`recover()` 兜底；
  - 首次启动**不立刻备份**，以启动时刻的小时为基准，下一个整点才触发。

### 何时会漏备份 / 何时会补跑

- 进程刚启动到第一个整点之间：**漏**（按设计）。
- 容器被 `docker compose up -d --build` Recreate：若跨越整点，Recreate 完成后的下一次 tick 会检测到 Hour 不同，**触发一次**（最终也能落一份；但不会"补"已错过的小时）。
- 业务繁忙导致 mysqldump 超过 60s：下一次 tick 只是再次比较 Hour，不会重复入队；即使单次备份耗时数分钟，也不会并发执行。
- `cfg.DB.Name` 不合法（正则 `^[A-Za-z0-9_]{1,64}$`）：跳过这一小时，写日志。

### 失败不影响业务

- 调度器独立 goroutine；业务请求不等它。
- `runDbBackupCore` 内部对 mysqldump / gzip / PutBackupObject 的错误都是 `return nil, err`，不会写坏数据也不会使 DB 进入异常状态。
- 行数统计失败时 `tablesNote` 会记错因，但对象仍已上传。

---

## 路径二：宿主机脚本 `scripts/db_backup_to_cos.sh`

### 依赖

- 宿主机 **docker**，且能 `docker exec` 进入 MySQL 容器。
- 默认容器名 **`MYSQL_CONTAINER=vino-mysql`**（与 `docker-compose.yaml` 中 `container_name` 一致）。
- **coscli**（腾讯云 COS CLI），见脚本内注释链接。
- 项目根目录 **`.env`**：`DB_*`、`COS_SECRET_ID`、`COS_SECRET_KEY` 等。

### 流程（顺序）

1. `source` `.env`。
2. `docker exec -e MYSQL_PWD=... vino-mysql mysqldump ... --databases "$DB_NAME"`（在 **MySQL 官方镜像内**执行客户端，避免宿主 MariaDB 与 MySQL 8 认证不兼容）。
3. 管道 **`gzip -c`** 写入临时文件。
4. **`coscli cp`** 上传到 `cos://${COS_BUCKET}/db_save/${DB_NAME}/${YYYY-MM}/${DD}.sql.gz`。

**与 API 的差异**：脚本在 **MySQL 容器内** dump（隐式连本机实例）；API 在 **backend 容器** 内用 **TCP 连 `DB_HOST:DB_PORT`**。两者应对**同一数据目录**（同一 `vino-mysql` 实例上的 `vino_db`），除非单独改过环境变量。

---

## COS 与对象键

- **键名（手动 / cron 日路径）**：`db_save/{主库名}/{年-月}/{日}.sql.gz`，例如 `db_save/vino_db/2026-04/19.sql.gz`。
- **键名（进程内小时路径）**：`db_save/{主库名}/{年-月-日}/{时}.sql.gz`，例如 `db_save/vino_db/2026-04-19/17.sql.gz`。
- **主库名段**：`adminPostDbBackup` / `StartHourlyDbBackup` 均用 `cfg.DB.Name`（跟随 `active_db` 文件）；脚本用 `.env` 的 `DB_NAME`。均需匹配 `^[A-Za-z0-9_]{1,64}$`，否则拒绝上传。
- **校验**：`PutBackupObject` / `validateBackupKey` 允许前缀 `db_save/`（及 `log/backend/` 等），见 `backend/internal/services/cos.go`。
- **桶**：默认与业务上传共用（环境变量 `COS_*`），新加坡地域等以实际 `.env` 为准。
- **历史路径**：扁平路径 `db_save/YYYY-MM/DD.sql.gz` 不再生成，但恢复接口按 `/db_save/` 前缀校验，老对象仍可恢复。

---

## 环境变量（摘录）

| 变量 | 作用 |
|------|------|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | API 备份时 mysqldump 连接目标 |
| `COS_SECRET_ID` / `COS_SECRET_KEY` | COS SDK 上传备份 |
| `MYSQL_CONTAINER` | 仅 **宿主机脚本** 使用，默认 `vino-mysql` |

---

## 排障简表

| 现象 | 排查方向 |
|------|----------|
| **COS 未配置，无法上传** | 在运行中的 `vino-backend` 环境注入 `COS_SECRET_ID` / `COS_SECRET_KEY`（及桶等），与业务上传一致。 |
| **mysqldump 1045 / caching_sha2 插件** | 确认镜像使用 **mysql-client**（非仅 mariadb）；或改用脚本在 **`mysql:8.0` 容器内**执行 dump。 |
| **mysqldump 输出为空** | 检查 `DB_NAME` 是否存在、`DB_PASSWORD` 是否正确、用户权限。 |
| **备份的不是预期库** | 核对 compose / `.env` 中 `DB_HOST`、`DB_NAME`；脚本是否指向正确 `MYSQL_CONTAINER`。 |
| **定时任务无输出** | cron 环境是否有 `docker`、`coscli`、`.env` 路径；时区是否影响 `YYYY-MM/DD`（脚本设 `TZ=Asia/Shanghai`）。 |

---

## 与其他 Skill 的关系

| Skill | 关系 |
|-------|------|
| [`connectToTxCloud.md`](../connectToTxCloud.md) | SSH 连 106、项目路径、`docker compose` 命令。 |
| [`更新发布/SKILL.md`](../更新发布/SKILL.md) | 发布后端后备份逻辑随镜像更新；**禁止**为发布而 `down` 掉 MySQL 或删卷。 |
| [`cos-path-migration/SKILL.md`](../cos-path-migration/SKILL.md) | 业务对象路径迁移；与 `db_save/` 备份键名无冲突，注意勿误删备份对象。 |

---

## 与 COLOMO_Like「db-backup-restore」Skill 的对照（吸收点）

以下条目来自 R-Melamine 方案文档化经验，**已在本文采纳**的写法：何时查阅、能力表、设计原则、排障表、环境变量表、运维边界说明。

**Vino 当前未实现（仅作对照，勿在本仓库按 R-Melamine 路径找路由）**

- 管理端 **POST `/admin/ops/db/restore`**、**`/admin/ops/db/switch`**、**`DB_ACTIVE_NAME_FILE`**、**dbgate 写锁**、**OSS 恢复 URL 与域名白名单** 等——属 **R-Melamine** 代码库。
- 若未来在 Vino 增加「从 COS 恢复」，可复用相同思路：**私有桶用 SDK 下载**、**路径限制在 `db_save/`**、**防 SSRF**、**超时与体积上限**、大操作与业务并发隔离。

---

## 运维约定

- 生产建议至少保留 **宿主机定时备份** 或 **定期人工点「db备份」** 之一；双轨时注意 COS 存储与生命周期费用。
- 大库备份选低峰；网关/代理超时需大于 mysqldump + 上传耗时。
- **勿**在 Skill、规则或仓库中写入 **COS_SECRET**、**DB 密码** 明文。

---

## 代码锚点（Vino_test）

| 主题 | 路径 |
|------|------|
| 管理端 db 备份 API | `backend/internal/handlers/admin_ops.go`（`adminPostDbBackup`） |
| 路由注册 | `backend/internal/handlers/router.go`（`/api/admin/ops/db-backup`） |
| COS 备份上传 / key 校验 | `backend/internal/services/cos.go`（`PutBackupObject`、`validateBackupKey`） |
| 后端镜像 mysqldump 依赖 | `backend/Dockerfile`（`mysql-client`） |
| 宿主机备份脚本 | `scripts/db_backup_to_cos.sh` |
| 进程内整点调度器 | `backend/internal/handlers/db_backup_scheduler.go`（`StartHourlyDbBackup`） |
| 调度器启动入口 | `backend/cmd/server/main.go` |
| 部署与 DB 服务名 | 根目录 `docker-compose.yaml`（`vino-mysql`、`vino-backend`） |
| 管理端「db备份」按钮 | `backend/static/admin.html`（`runDbBackup`） |
