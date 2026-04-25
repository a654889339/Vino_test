# DB 打点与功能开关（Vino_test）

当任务涉及 **DB 修改、后台管理写操作、调试窗口、下单/支付/注册/登录、批量导入/删除、数据恢复/切库、重要业务开关** 时，必须使用本 skill。

## 强制原则

1. **任何导致 DB 修改的操作必须增加打点**。
   - 包括前台、小程序、后台、调试窗口、第三方回调、系统定时任务。
   - 包括直接写业务表、通过 raw-row 通用编辑器写表、事务内写表、`Exec` 写表。
   - 仅查询接口不需要打点，但如果查询触发懒升级、补默认值、写回版本号，也视为 DB 修改。

2. **重大功能必须增加功能开关**。
   - 重大功能包括：下单、支付、注册、地址创建、批量导入/删除、数据恢复/切库、对线上业务影响大的后台能力。
   - 开关优先放在后台「调试窗口 / 功能开关」里，接口必须走 `/api/admin/ops/...` + `middleware.SuperAdmin()`。
   - 开关默认应保守：不破坏现有线上行为。新增开关默认开启，除非需求明确要求默认关闭。

3. **后台 DB 修改更要打点**。
   - 后台专用业务接口要打点。
   - `PUT /api/admin/raw-row/:table/:id` 这类通用详情修改必须单独记录 `table`、`id`、`changedKeys`、`operatorUserId`、`operatorRole`。
   - 敏感字段不得记录明文值，例如 `password`、token、密钥、支付私钥。

## 现有功能开关约定

功能开关存储在 `home_configs`：

- `section = "featureFlag"`
- `path = 开关键`
- `status = active|inactive`

核心文件：

- `backend/internal/services/feature_flags.go`
- `backend/internal/handlers/admin_ops.go`
- `backend/internal/handlers/misc.go`
- `backend/static/admin.html`

当前开关：

- `maintenanceMode`：全局维护模式。
- `enableRegister`：注册开关。
- `enableCreateOrder`：创建服务订单开关，控制 `POST /api/orders/` 与 `POST /api/outlet/orders`。
- `enableCreateGoodsOrder`：创建商品订单开关，控制 `POST /api/goods-orders/checkout`。
- `enableCreateAddress`：创建地址开关。

新增重大功能开关时必须同步：

1. `FeatureFlags` 结构体与默认值。
2. `GetFeatureFlagsWithTTL` 读取逻辑。
3. `AdminGetFeatureFlags` / `AdminPutFeatureFlags`。
4. `AppStatus`（若前端需要禁用入口）。
5. 后台 `admin.html` 功能开关 UI。
6. 后端实际写入口的拦截。
7. 前端/小程序提交按钮禁用与提示（如适用）。

## 打点目录规则

打点日志按类型分目录，本地目录由 `LOG_STAT_DIR` 控制，默认 `data/logs/stat`。

上传到 COS 时使用：

```text
log/stat/{type}/YYYY-MM-DD/stat_{type}_YYYY-MM-DD-HH.log
```

示例：

- 登录：`log/stat/login/`
- 注册：`log/stat/register/`
- 服务订单：`log/stat/order/`
- 商品订单：`log/stat/goods_order/`
- 购物车：`log/stat/cart/`
- 地址：`log/stat/address/`
- 用户资料/绑定：`log/stat/profile/`
- 后台 DB 管理：`log/stat/admin_db/`
- 后台 raw-row 详情修改：`log/stat/raw_row/`
- 调试窗口/运维操作：`log/stat/ops/`
- 系统启动/定时任务：`log/stat/system/`

## 打点字段规范

每条打点至少应尽量包含：

- `type`：由目录类型决定，写入时自动补充。
- `source`：`web`、`wechat_mp`、`alipay_mp`、`admin`、`super_admin`、`outlet`、`wechat_notify`、`system`。
- `action`：明确业务动作，如 `goods_order.checkout`、`admin.raw_row.update`。
- `status`：`success` 或 `failed`。
- `operatorUserId`、`operatorRole`：能识别操作者时必须记录。
- `requestPath`、`method`、`clientIp`：HTTP 入口建议记录。
- `table` 或 `tables`：涉及 DB 表。
- `targetId` / `id`：目标记录主键或业务 ID。
- `changedKeys`：后台编辑类操作必须记录字段名。
- `error`：失败原因摘要，禁止包含密钥、密码、完整 token。

## 已有打点框架

核心文件：

- `backend/internal/stat/stat.go`
- `backend/internal/middleware/stat_mutation.go`
- `backend/internal/services/cos.go`
- `backend/cmd/server/main.go`
- `backend/internal/handlers/admin_ops.go`
- `backend/internal/handlers/router.go`

行为：

- `stat.Record(type, payload)` 写本地 typed hourly log。
- `middleware.StatMutationLog()` 对所有 mutating API（`POST` / `PUT` / `PATCH` / `DELETE`）做兜底打点。
- 高风险业务点需要在 handler 内追加更细打点，不能只依赖兜底中间件。
- `POST /api/admin/ops/stat-log-backup` 手动上传已完成小时的打点日志。
- `services.PutBackupObject` 已允许 `log/stat/` 前缀。

## 接入新 DB 修改功能时的检查清单

改代码前先回答：

1. 这个接口/任务是否会写 DB？
2. 修改哪张表？是否事务内多表？
3. 操作来源是谁：用户、小程序、后台、调试窗口、回调、定时任务？
4. 现有 `StatMutationLog` 是否已能归类到正确目录？
5. 是否需要 handler 内补充业务字段，如目标 ID、变更字段、数量、金额、订单号？
6. 是否涉及重大能力，需要新增或复用功能开关？
7. 后台功能是否需要 `middleware.SuperAdmin()` 而不是 `Admin()`？

若答案不明确，先补充方案或向用户确认，不要直接实现。

## 禁止事项

- 禁止记录密码、验证码、密钥、支付私钥、完整 JWT/token。
- 禁止把所有打点混写到一个目录；必须按类型进 `log/stat/{type}/`。
- 禁止绕过 raw-row 打点；后台详情修改是高风险操作，必须记录。
- 禁止新增重大写能力但没有开关，除非用户明确说明不需要，并在最终说明中标明风险。
