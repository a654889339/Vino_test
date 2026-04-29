# common/config/cos

与「云对象存储」相关的**静态契约**：白名单前缀、商品等媒体路径模板、建议 TTL。R-Melamine 的桶公网根在 `rmelamine.media.yaml` 的 `ossPublicBaseDefault`，经 `GET /api/media/cosConfig` 下发；Vino 在 `vino.media.yaml` 的 **`ossPublicBaseDefault`**，三端经 **`GET /api/media/cos-config`** 拉取，与 `VINO_COS_*` 推导的 `CosBase()` 需一致。

## 格式约定（重要）

**本目录内所有配置文件必须为 YAML**（扩展名使用 `.yaml` 或 `.yml`，**推荐统一为 `.yaml`**）。新增或修改契约时只维护 YAML；**不要**在本目录下提交或使用 JSON。

## 文件

| 文件 | 说明 |
|------|------|
| `defaults.example.yaml` | 占位示例，不含真实凭据 |
| `rmelamine.media.yaml` | R-Melamine（阿里云 OSS）路径与白名单约定 |
| `vino.media.yaml` | Vino_test（腾讯云 COS）路径与白名单约定 |

`cosRuleConfigPath` / `cosRuleConfigVersion` / `cosRuleConfigCheckTime`：桶内媒体规则 YAML 的 key 模板（`*project*` 替换为 `project` 字段）、版本号与拉取检查间隔；后端由 `GET /api/media/cosRuleConfigVersion` 暴露当前版本，前端与公共 `cos_base` 的 `startCosRuleConfigSync` 轮询并与 OSS 对象同步。

## TTL 字段说明（三类）

下列字段均在 `*.media.yaml` 中声明，经后端媒体配置 API 下发给前端；含义不同，**勿混作同一概念**。

| 字段 | 典型默认值 | 服务对象 | 消费位置（前端公共代码） |
|------|------------|----------|---------------------------|
| `mediaConfigTtlMs` | `300000`（5 分钟） | **合并后的媒体运行时配置**（桶域、白名单片段、`productMedia` 等与 API 对齐的字段）多久视为过期并触发重新 `fetch` | [`frontend/cos_base/runtimeStore.js`](../../frontend/cos_base/runtimeStore.js)：`ensureMediaRuntimeConfig`、sessionStorage hydration、`startMediaConfigRefreshLoop` 仅读取 **`mediaConfigTtlMs`**（缺省回落默认 `300000`），**不回填** `imageDisplayCacheTtlMs` |
| `imageDisplayCacheTtlMs` | `300000` | **展示层**对已解析 URL / blob / 代理响应的内存缓存时长（图片、同源代理 fetch 等） | [`imageDisplayCache.js`](../../frontend/cos_base/imageDisplayCache.js)、[`cosMediaProxyFetchCache.js`](../../frontend/cos_base/cosMediaProxyFetchCache.js)、小程序 [`cosMediaPathCache.js`](../../frontend/cos_base/cosMediaPathCache.js)；runtime 另提供 `getImageDisplayCacheTtlMs()` 从合并对象读取本字段，与配置刷新 TTL **分离** |
| `cosRuleConfigCheckTime` | `60`（秒） | **桶内 cosRule YAML** 与后端版本号的比对频率（版本不变则跳过拉桶） | [`cosRuleConfigClient.js`](../../frontend/cos_base/cosRuleConfigClient.js)：`startCosRuleConfigSync` 中间隔 `max(5, 该秒数)` 触发一次版本检查 |

**关系简述**：`mediaConfigTtlMs` 管「API 合并配置要不要刷新」；`imageDisplayCacheTtlMs` 管「浏览器/小程序里媒体字节或临时路径缓存多久」；`cosRuleConfigCheckTime` 管「多久问一次服务端版本、决定是否从桶拉规则 YAML」。三者独立可调。

## 与部署的对应

- 本目录下 YAML 由后端 `mediacfg.Load` 在启动时读入，并通过媒体配置 API 向 H5/小程序原样公开 JSON；**勿**在前端手抄第二份白名单或桶域。

## 同步

`COLOMO_Like/R-Melamine/common/config/cos` 与 `Vino_test/common/config/cos` 下同名 **YAML** 文件保持逐字一致；若只改一方业务白名单，请双仓同提以免漂移。
