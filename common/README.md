# Common（项目基建）

本目录为 **Vino_test 与各端共享的静态契约与前端工具**，与业务代码解耦；修改 `common/frontend/cos_base` 下与 R-Melamine 对齐的文件时，须按该仓规范做双仓同步。

## 目录说明

| 路径 | 用途 |
|------|------|
| `config/` | 环境无关的 YAML 配置（数据库、日志、统计、**COS 媒体**等） |
| `config/cos/vino.media.yaml` | **COS 桶 HTTPS 公网根**（`ossPublicBaseDefault`）、代理白名单前缀、媒体相关 TTL 等真源 |
| `frontend/cos_base/` | 三端共用的路径解析、运行时配置合并、**`parseVinoMediaYaml.js`**（读上一 YAML 的轻量解析） |
| `backend/` | Go 侧可选共享库（本仓 backend 可引用） |
| `wechat-mp/`、`alipay-mp/` | 小程序侧占位说明，逻辑以 `frontend/cos_base` 为准 |

> 说明：桶根字段在仓库内的路径为 **`common/config/cos/vino.media.yaml`**（`ossPublicBaseDefault`）。若口头写作 `common/config/vino.media.yaml`，指同一套配置中的 COS 媒体文件。

## 打包约定（Web / 微信 / 支付宝）

构建或上传小程序前，**必须把本目录的 `frontend` 与 `config` 打进产物**，否则：

- 小程序内 `require` 无法解析到 `cos_base`（若仅上传子目录）；
- 离线/首帧无法从包内 YAML 读取 `ossPublicBaseDefault`。

**推荐命令**（仓库根执行，将 `common/config` 与 `common/frontend` 同步到各小程序根下的 `common/`）：

```bash
node scripts/sync-common-to-miniprograms.mjs
```

Web（Vite）已通过源码引用 `../common/...` 与 `?raw` 读取 `vino.media.yaml`；Docker 若仅 `COPY frontend`，需将构建上下文设为仓库根或额外 `COPY common`，否则打包会缺文件。

## 运行时读取顺序（桶公网根）

三端 **`cosMedia`** 约定（**不得**经本服务 `GET /api/media/*` 拉取配置；该路由已撤销）：

1. **包内** `common/config/cos/vino.media.yaml` 的 `ossPublicBaseDefault`（Web 构建期 `?raw`；小程序 `readFileSync` 同步进包后路径）；
2. Web 仅本地开发：环境变量 **`VITE_COS_PUBLIC_BASE`** 兜底；
3. 商品等命名约定：Web 构建期嵌入 **`frontend/src/config/media_asset_catalog.json`**（须与 `backend/internal/configdata/media_asset_catalog.json` 同内容，改一方请双改）；小程序自包内 `common/config/cos/media_asset_catalog.json`（`sync-common-to-miniprograms.mjs` 从 **backend** 嵌入文件复制）。
4. 展示/下载：**仅**桶 **HTTPS 直链**；浏览器/小程序用跨域 `fetch` / `downloadFile`，不经后端转发字节流。
