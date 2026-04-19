# ai 必读（Vino_test）

本 skill 汇总当你改动 Vino_test 后端/管理页前，**必须**遵守的全局规则。
当你在开始一个新任务时，若涉及以下任一主题，先通读本文件再动手。

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

`services.SignJWT` 把 `role` 写进 Claims，浏览器缓存的 token 依旧保留老角色：

- 一旦通过 `PUT /auth/admin/users/:userId/role` 改了角色，目标用户**下一次重新登录**才能获得新的 JWT，中间件按 JWT role 判定；
- 前端展示角色依然实时（`GET /auth/profile` 走 DB）。修改角色后如需立即生效，提示用户退出重登。

---

## 5. 本 skill 出现的改动入口

| 文件 | 含义 |
| ---- | ---- |
| `backend/internal/models/user.go` | Role enum 定义 |
| `backend/internal/db/db.go` (`MigrateSuperAdmin`) | 启动时幂等迁移 + 自动提升 |
| `backend/internal/middleware/middleware.go` (`Admin` / `SuperAdmin`) | 权限中间件 |
| `backend/internal/handlers/router.go` | `/admin/ops/*` & `/auth/admin/users/:id/role` 路由 |
| `backend/internal/handlers/auth.go` (`authAdminSetUserRole`) | 超级管理员改他人角色 |
| `backend/static/admin.html` | 前端角色徽章 / 调试侧栏可见性 / 改角色下拉 |

以上文件在改动后必须复审：是否仍能满足「**调试窗口 = 仅 super_admin**」这一硬约束。
