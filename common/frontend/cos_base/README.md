# common/frontend/cos_base

与云厂商无关的前端工具：路径规范化、同源媒体代理 URL 构造、运行时配置合并、展示层缓存、桶内 cosRule 规则同步。

- **修改须双仓同步**：`COLOMO_Like/R-Melamine/common/frontend/cos_base` 与 `Vino_test/common/frontend/cos_base` 同名文件须逐字一致。
- `paths.js` / `paths.mjs` / `paths.cjs`：Web 用 Vite 别名 `@cos_base`、微信/支付宝小程序用 `require(.../paths.cjs)`；业务白名单与桶域仍以仓根 `common/config/cos/*.media.yaml` 与各自后端媒体接口为准（如 Vino `GET /api/media/cos-config`、R-Melamine `GET /api/media/cosConfig`）。

## 模块选用指南

| 场景 | 使用模块 | 说明 |
|------|----------|------|
| 解析 object key、拼代理 URL、直链与代理互转 | `paths.js`（或 `paths.mjs` / `paths.cjs`） | 不含网络请求；与 YAML 白名单一致时再请求代理。 |
| 包内 YAML 子集（首帧/离线） | `parseVinoMediaYaml.js` | 轻量正则解析 `vino.media.yaml` 若干标量；完整语义以后端/API 为准。 |
| 运行时合并配置 + sessionStorage | `runtimeStore.js` `createMediaRuntimeStore` | 配置刷新与 session 有效期仅看 `getMediaConfigTtlMs()`（`mediaConfigTtlMs`）；`getImageDisplayCacheTtlMs()` 单独读 `imageDisplayCacheTtlMs`；失败回落 `getFallbackDefaults()`。 |
| 桶内 cosRule YAML 与版本轮询 | `cosRuleConfigClient.js` `startCosRuleConfigSync` | 调 `.../media/cosRuleConfigVersion`，版本变化则匿名 GET 桶对象，动态 `import('js-yaml')` 解析后 `ingestOssRuleConfigData`。Web 打包需能解析 `js-yaml`（如 Vite `resolve.alias`）。 |
| **推荐**：HTTPS 直链展示图片 | `imageDisplayCache.js` `createImageDisplayCache` | 同源可 fetch 的 URL 才走 blob 缓存；代理路径名默认 `/api/media/oss`、`/api/media/cos`。 |
| **兼容**：页面已通过同源代理访问 COS（`/api/media/oss?key=` / `/api/media/cos?key=`） | `cosMediaProxyFetchCache.js` `createCosMediaProxyFetchCache` | 缓存 ArrayBuffer，避免重复拉代理；与「仅直链」并存时按业务 URL 形态选用。 |
| 小程序 `downloadFile` 临时路径 | `cosMediaPathCache.js` `createCosMediaPathCache` | 仅客户端；默认 TTL 与 `imageDisplayCacheTtlMs` 对齐思路一致。 |

**两条展示路径**（与根目录 [`common/README.md`](../README.md) 一致）：优先桶 **HTTPS 直链**；仅在需要规避 CORS 或统一鉴权时走同源代理，并用上表中的 proxy fetch 缓存。

## 上传后失效与周期清理

- 三类缓存均提供失效与清理 API：
  - `imageDisplayCache.js`：`invalidateByUrl`、`sweepExpired`、`startPeriodicSweep(30000)`
  - `cosMediaProxyFetchCache.js`：`invalidateByAbsProxyUrl` / `invalidateByObjectKey` / `invalidateByPublicUrl`、`prune`、`startPeriodicPrune(30000)`
  - `cosMediaPathCache.js`：`invalidateUrl`、`sweepExpired`、`startPeriodicSweep(30000)`
- 统一编排由 `mediaCacheHub.js` 提供：
  - `registerMediaCaches({ image?, proxy?, path? })`
  - `startMediaCacheJanitor({ intervalMs: 30000 })`
  - `invalidateCachesForCosArtifact({ publicUrl?, proxyUrl?, objectKey?, rawUrl? })`
- 业务约定：**上传成功后**立即调用 `invalidateCachesForCosArtifact`（或项目侧封装），避免同 URL 命中旧缓存；应用启动后调用 janitor，默认每 30 秒清理过期项。

## TTL 字段

与 YAML 中 `mediaConfigTtlMs`、`imageDisplayCacheTtlMs`、`cosRuleConfigCheckTime` 的分工见 [`config/cos/README.md`](../../config/cos/README.md)。
