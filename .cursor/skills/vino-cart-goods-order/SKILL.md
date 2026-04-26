---
name: vino-cart-goods-order
description: Vino 购物车（users.cartJson）与商品订单（goods_orders / goods_order_items）：checkout 全量语义、与前端「勾选」关系、用户待付款取消并恢复购物车。用户或任务提到购物车、商品订单、checkout、cartJson、取消订单时使用。
---

# Vino 购物车与商品订单流程

## 1. 数据形态

| 实体 | 存储 | 说明 |
|------|------|------|
| 购物车 | `users.cartJson`（JSON 数组） | 每元素 `{ "guideId", "qty" }`；**不存**商品名、价、币种；展示由 `GET /api/cart` 联表 `device_guides` 计算 |
| 购物车行（DB 明细） | `cart_items` | 与 `cartJson` **双写**：`userId` + `guideId` 唯一；含 `qty` 及展示用快照 `nameSnapshot`、`unitPriceSnapshot`、`currencySnapshot`（无贴花列）。`PUT /api/cart`、checkout 清空车、取消订单恢复车后均同步；启动时若表为空则从非空 `cartJson` 回填 |
| 商品订单头 | `goods_orders` | `orderNo`、`status`（含 `pending`/`cancelled`）、`totalPrice`、`currency`、收货信息等 |
| 商品订单行 | `goods_order_items` | `guideId`、`qty`、下单时快照 `nameSnapshot`、`imageUrl`、`unitPrice`、`currency`、`lineTotal` |

## 2. 下单：`POST /api/goods-orders/checkout`

实现见 [`backend/internal/handlers/goods_order.go`](../../../backend/internal/handlers/goods_order.go) `goodsOrderCheckout`。

- 请求体：`contactName`、`contactPhone`、`address`、`remark`（**不含**行列表；行列表**绝不**信任客户端）。
- 服务端读取**当前用户数据库中的整份 `cartJson`**，解析后与 `device_guides` 校验（上架、有价、币种一致），生成订单行，事务内将 `cartJson` **清空为 `[]`**。

### 与前端「勾选结算」的关系（须写进排查笔记）

与 R-Melamine `from-cart` 同类语义：**权威在 DB 全量 `cartJson`**。

- 若 H5/小程序结算页只展示「勾选子集」，但用户**未**在结算前调用 `PUT /api/cart` 把购物车同步为勾选子集，则会出现：**页面展示件数/金额与最终下单不一致**——后端仍会按 DB 中**全部行**下单并**清空整车**。
- **正确做法**：从结算页返回修改勾选时，先 `PUT /api/cart` 写入期望的 `items`，再 `checkout`；或未来扩展协议（例如 body 传 `guideIds[]` 且服务端校验为当前 `cartJson` 子集）。

## 3. 购物车 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cart` | 返回 `items`、`totalPrice`、`totalCount`（由 `cartJson` + 商品表解析） |
| PUT | `/api/cart` | body `{ items: [{ guideId, qty }] }` 整包替换；校验混币种 |

## 4. 用户取消待付款订单：`POST /api/goods-orders/:id/cancel`

- 条件：订单属于当前用户且 `status === 'pending'`。
- 事务：将订单置 `cancelled`；将该订单**所有行**按 `guideId`/`qty` **合并回** `cartJson`（与车内已有行按 `mergeCartLines` 规则相加，单 `guideId` 数量上限 9999）。
- 若合并后的购物车违反**混币种**规则（与 `PUT /api/cart` 相同校验），取消失败并提示用户先调整购物车（避免静默产生非法车）。

## 5. 功能开关

- 下单创建：`GetFeatureFlags().EnableGoodsOrder` 为假时 `checkout` 返回 403。
- **取消订单**：不依赖该开关，避免功能关闭后用户无法撤回待付款单。

## 6. 管理端（数据管理）

- **用户购物车管理**：`GET /api/admin/user-carts`（有车的用户 + `cartJson` 摘要 + `cart_items` 行数）。
- **购物车商品明细**：`GET /api/admin/cart-items`。
- **商品订单行表明细**：`GET /api/admin/goods-order-items`（与「商品订单」页内嵌明细互补，独立 DB 视角页）。
- 管理 UI：`backend/static/admin.html` 数据管理顶栏；`adminPageTableMap` 见 [`backend/internal/handlers/admin_schema_catalog.go`](../../../backend/internal/handlers/admin_schema_catalog.go)。

## 7. 相关文件速查

| 环节 | 路径 |
|------|------|
| 购物车解析/合并/币种校验、`cart_items` 双写与回填 | [`backend/internal/handlers/cart.go`](../../../backend/internal/handlers/cart.go) |
| 模型 `CartItem` | [`backend/internal/models/cart_item.go`](../../../backend/internal/models/cart_item.go) |
| 下单与取消 | [`backend/internal/handlers/goods_order.go`](../../../backend/internal/handlers/goods_order.go) |
| 管理端列表 API | [`backend/internal/handlers/admin_cart_lists.go`](../../../backend/internal/handlers/admin_cart_lists.go) |
| 路由 | [`backend/internal/handlers/router.go`](../../../backend/internal/handlers/router.go) `goods-orders`、`/api/admin/*` |
| Web API | [`frontend/src/api/index.js`](../../../frontend/src/api/index.js) `goodsOrderApi` |
| Web 订单详情 | [`frontend/src/views/GoodsOrderDetail.vue`](../../../frontend/src/views/GoodsOrderDetail.vue) |
