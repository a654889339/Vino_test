# common/frontend/cos_base

与云厂商无关的前端工具：多次 decode 的路径段、`/api/media/oss` 或 `/api/media/cos` 同源代理 URL 构造、blob 缓存策略、运行时配置拉取骨架。

- **修改须双仓同步**：与 `Vino_test/common/frontend/cos_base` 同名文件逐字一致。
- `paths.js` 同时提供 **ESM `export`** 与 **CommonJS `module.exports`**，Web 用 Vite 别名、微信/支付宝用 `require(../../common/frontend/cos_base/paths.js)`，业务规则仍以仓根 `common/config/cos/*.media.yaml` 与各自后端媒体接口为准（如 Vino 的 `GET /api/media/cos-config`、R-M 的 `GET /api/media/cosConfig`）。
