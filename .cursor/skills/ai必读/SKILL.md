# ai 必读（Vino_test）

本 skill 汇总当你改动 Vino_test 后端/管理页前，**必须**遵守的全局规则。
当你在开始一个新任务时，若涉及以下任一主题，先通读本文件再动手。

---

## 0. 前端/小程序 与 后端/DB 变更隔离（强制）

为降低联调面与回滚成本，**同一任务、同一提交**内必须二选一，**禁止混改**：

| 任务类型 | 允许改动的范围 | **禁止**改动的范围 |
| -------- | -------------- | ------------------ |
| 修改**前端**与**小程序**功能（含 UI、交互、样式、路由、请求组装方式不变前提下仅调已有接口） | 前端仓库 / 小程序仓库内对应代码与静态资源 | **后端**（Go、`backend/` 等）与 **数据库**（含迁移、改表结构、批量改数据、手工 SQL） |
| 修改**后端**能力与 **DB**（含接口契约变更、新表/新列、迁移、存储过程、配置驱动的数据结构） | `backend/`、数据库及相关运维脚本 | **前端**与**小程序**代码（含 `admin.html`、用户端页面、小程序各包） |

若需求**必须**同时涉及两侧（例如新接口 + 新页面），应**拆成两次独立变更**：先发布并验证一侧，再开下一任务改另一侧；**不得**在同一 PR/同一提交里把前端与后端/DB 改动绑在一起。

---

## 1. 角色与权限

Vino_test 的主用户表 `users` 支持三种角色：

- `user`：普通用户。
- `admin`：管理员，拥有管理后台大多数操作权限（订单、商品、首页、留言等）。
- `super_admin`：**超级管理员**，在 `admin` 的基础上额外拥有：
  - 后台「调试窗口」侧栏的**唯一可见者**；
  - 调试窗口里的所有操作（日志备份 / db 备份 / db 恢复 / 备份恢复切库 / `/api/admin/ops/*`）**必须**是超级管理员权限；
  - 修改其他用户角色的权限（包括给他人授予/回收 `admin`、`super_admin`）。

### 后端中间件

- `middleware.Admin()`：放行 `admin` 与 `super_admin`，用于普通管理后台操作。
- `middleware.SuperAdmin()`：**仅**放行 `super_admin`，用于调试窗口和角色管理接口。

### 路由约定

新增/修改路由时必须遵守：

- **调试窗口下所有 API**（`/api/admin/ops/...`）必须使用 `middleware.SuperAdmin()`，**严禁**使用 `middleware.Admin()`。
- 用户角色修改接口 `PUT /api/auth/admin/users/:userId/role` 使用 `middleware.SuperAdmin()`。
- 其余管理后台接口（订单、商品、首页配置、留言等）继续使用 `middleware.Admin()`，避免普通管理员失去日常管理权限。

### 管理页 UI 约定

编辑 `backend/static/admin.html` 时：

- 侧栏 `#sidebarDebug`（调试窗口）**仅对 `super_admin` 可见**，其他角色（含 `admin`）必须隐藏。
  判断使用 `isSuperAdminRole(currentUser.role)`。
- 其余普通管理员入口（`#sidebarOutlet` 等）对 `admin` 与 `super_admin` 均可见，判断使用 `isAdminRole(currentUser.role)`。
- 角色徽章渲染统一使用 `roleTagHtml(role)` 助手，对应 CSS：
  `.role-tag.super-admin`（黑底白字）/ `.role-tag.admin`（红）/ `.role-tag.user`（蓝）。
- 所有涉及 `role === 'admin'` 的权限判断必须改写为 `isAdminRole(role)`（或 `isSuperAdminRole(role)`），避免 `super_admin` 被误判为普通用户。
- 用户列表中的「改角色」下拉**仅**对 `super_admin` 渲染，并禁止修改自己（`u.id !== currentUser.id`）。
- 头部 `#dashUserMeta` 必须显示登录用户的 `#id 用户名 + 角色徽章`，便于运维快速识别当前会话身份。

---

## 2. 调试窗口变更须知

如果本次任务涉及：

- 新增任何「管理端的底层操作」（DB 备份/恢复/迁移、日志备份、重启类开关、黑白名单等），把入口放在**调试窗口**页面，后端接口放在 `/api/admin/ops/...` 路由组，并走 `middleware.SuperAdmin()`；
- 修改现有调试窗口功能，保持其前端 UI **对非 super_admin 不可见**，后端接口**不可被降级为 Admin()**；
- 任何情况下都**不要**为了图方便把调试窗口里某个按钮改回 `Admin()`，这会让普通管理员绕过最关键的风控审批。

---

## 3. 自动引导超级管理员

应用启动时 `db.MigrateSuperAdmin()` 会：

1. 把 `users.role` 列扩展为 `ENUM('user','admin','super_admin')`；
2. 若当前**无**任何 `super_admin`，把最早创建的 `admin`（`ORDER BY id ASC LIMIT 1`）自动升级为 `super_admin`。

因此本地 / 线上首次上线无需手工执行 SQL。**不要**去掉这段迁移逻辑。
新加模型字段或角色相关 DDL 变动时，需要同步修改 `MigrateSuperAdmin` 保持幂等。

---

## 4. JWT 缓存的 role

`services.SignJWT` 把 `role` 写进 Claims，浏览器缓存的 token 依旧保留老角色。

**中间件一律以数据库为准（主站）：**

- **`middleware.Admin()`**：按 token 内用户 ID 查 `users`，仅当 `role` 为 `admin` 或 `super_admin` 且 `status=active` 时放行，并 **用库中 role 覆盖上下文**。避免 JWT 仍为 `user` 而库中已升为管理员时，整页管理接口 403、前端长期卡在「加载中」。
- **`middleware.SuperAdmin()`**：同上，仅放行 `role=super_admin`。
- 前端展示角色实时（`GET /auth/profile` 走 DB）。重新登录可刷新 JWT，但**非必须**。

---

## 5. 数据库列变更与版本号（version）

凡涉及 **新增列、改列语义、删列、或需对历史行补默认值/改格式** 的变更，**必须**同时维护 **版本号 `version`**，并在 **读取 DB 数据时按版本做升级**，避免老数据与新老代码混用导致静默错误。

### 5.1 版本放哪里

- **推荐（全局）**：在专用表（如 `app_meta`，`key='schema_version'` / 单列 `version`）存**整数** schema 版本；启动或首次访问时检查并执行迁移链。
- **可选（按实体）**：若某业务表行级历史差异大，可在该表增加 **`data_version`（或沿用单列 `version`）** 整型字段，表示**该行**的数据形态版本；读该行时若 `version < 当前代码期望版本`，则走升级逻辑并 **写回** 新版本号。

具体选用哪种由任务决定，但**禁止**只加列、不写版本、也不在读路径做兼容。

### 5.2 新增列时的必做项

1. **在代码中定义常量**：例如 `const CurrentSchemaVersion = N`（或该表 `CurrentRowVersion`），**每次**列/语义变更递增 `N`（单调递增，勿复用旧号）。
2. **DDL**：`ALTER TABLE ... ADD COLUMN ...`（或 GORM `AutoMigrate` 等）与版本常量**同一提交/同一发布**说明中体现。
3. **持久化版本**：迁移成功后把全局或相关行的 `version` 更新为 `N`（启动迁移或惰性升级均可，但要有明确落点）。
4. **与「更新发布」skill 一致**：生产环境禁止随意 `docker compose down` 清库；版本升级须对**已有数据**可重复、幂等（至少可安全重试）。

### 5.3 读取数据时的升级规则

- **任何**从 DB 读出、且结构会随版本变化的模型，在 **handler / service 层**（或统一的 `NormalizeXxx` / `UpgradeXxx`）根据 **当前行或全局 `version`** 判断：
  - 若 **已等于** 当前代码期望版本：直接返回。
  - 若 **小于** 期望版本：按 **v1→v2→…→vN** 链式执行补字段、改类型、拆字段、清洗脏数据等，再 **写回 DB**（若适用）并更新 `version`。
- **禁止**只在「新插入」的路径填新列默认值，却假设「老行」在读时自动合理；老行必须通过版本分支显式处理。
- 若升级失败，应返回明确错误日志，避免半升级状态长期存在。

### 5.4 与第 3 节 `MigrateSuperAdmin` 的关系

- 启动时 **幂等 DDL**（如 `ALTER TABLE ... MODIFY ENUM`）仍放在 `db` 包或专用 `Migrate*` 函数中。
- **业务语义升级**（填默认值、改 JSON 结构、重算字段）优先放在 **version 驱动的升级链**中，与「仅扩表」的 DDL 区分清楚，便于审计与回滚策略讨论。

---

## 6. 本 skill 出现的改动入口

| 文件 | 含义 |
| ---- | ---- |
| `backend/internal/models/user.go` | Role enum 定义 |
| `backend/internal/db/db.go` (`MigrateSuperAdmin`) | 启动时幂等迁移 + 自动提升 |
| `backend/internal/middleware/middleware.go` (`Admin` / `SuperAdmin`) | 权限中间件 |
| `backend/internal/handlers/router.go` | `/admin/ops/*` & `/auth/admin/users/:id/role` 路由 |
| `backend/internal/handlers/auth.go` (`authAdminSetUserRole`) | 超级管理员改他人角色 |
| `backend/static/admin.html` | 前端角色徽章 / 调试侧栏可见性 / 改角色下拉 |

以上文件在改动后必须复审：是否仍能满足「**调试窗口 = 仅 super_admin**」这一硬约束。
