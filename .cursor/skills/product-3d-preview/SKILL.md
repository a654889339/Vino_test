---
name: product-3d-preview
description: >-
  Vino_test 商品详情（DeviceGuide）3D 预览：后台开关与 GLB/贴花/天空盒上传、网页 Three.js 全屏、微信完整 3D、支付宝兜底；
  COS 经后端同源代理避免 CORS；i18n 键与 SQL 执行编码注意。用户提到 3D 预览、model3d、GLB、贴花、天空盒、GuideDetail 3D 时使用。
---

# 商品 3D 预览（Vino_test）

本 Skill 描述仓库内**已实现**的「商品详情页 3D 预览」端到端约定：数据字段、上传、各端入口、CORS 与 i18n。**不**替代腾讯云 COS 桶级 CORS 配置说明；网页端通过**同源代理**规避浏览器对跨域纹理/模型的限制。

## 何时查阅本 Skill

- 修改或排查 **3D 预览按钮文案**、**全屏 overlay**、**加载提示**。
- 扩展 **后台上传** 的文件类型或 COS 路径规则。
- 处理 **COS 直链在浏览器报 CORS**、**Three.js 纹理加载失败**。
- 执行 **i18n SQL** 后出现 **「预览」变 `é¢„è§ˆ`** 等双重 UTF-8 乱码。
- 对比参考实现：历史代码曾对齐 `F:/zhikeweilai` 的 product-3d-preview 思路（本仓库为独立实现路径）。

---

## 平台行为矩阵

| 端 | 条件 | 行为 |
|----|------|------|
| **管理后台** | 编辑 Device Guide | 开关 + 三个 URL + 各「上传」按钮 |
| **Web 前端** | `model3dEnabled` 且 `model3dUrl` 非空 | 「3D 预览」浮钮 → 全屏 overlay → 懒加载 `ProductModelViewer`（Three.js） |
| **微信小程序** | 同上 | 自定义组件 `model-viewer`，`wx.downloadFile` 拉资源 |
| **支付宝小程序** | 有配置时仍可显示入口 | 点击 `my.showModal` 提示去微信/网页（`guideDetail.preview3DUnsupported`） |

---

## 数据模型（后端）

文件：`backend/internal/models/deviceguide.go`

| GORM / DB 列（示意） | JSON（API） | 含义 |
|----------------------|-------------|------|
| `model3dEnabled` | `model3dEnabled` | 是否开启 |
| `model3dUrl` | `model3dUrl` | GLB 模型 URL |
| `model3dDecalUrl` | `model3dDecalUrl` | 贴花图 URL |
| `model3dSkyboxUrl` | `model3dSkyboxUrl` | 天空盒图 URL |

表结构兜底（手工执行）：`scripts/migrate_device_guide_3d.sql`。

---

## 上传接口（`guideUploadFile`）

文件：`backend/internal/handlers/guide.go`

- 表单里 **`assetKind`** 取值：`model3d` | `model3d_decal` | `model3d_skybox`。
- **GLB**（`model3d`）：走非图片分支，COS 上固定文件名 **`model3d.glb`**（在 `goods/{id}/` 前缀下，与现有 goods 上传规则一致）。
- **贴花 / 天空盒**：按图片处理扩展名，固定前缀文件名 **`model3d_decal`** / **`model3d_skybox`** + 原扩展名；此类一般**不走**缩略图分支（与 handler 内 `isModel3D` 分支一致）。

管理端绑定：`backend/static/admin.html` 中 `gModel3DUrl` / `gModel3DDecalUrl` / `gModel3DSkyboxUrl` 与 `uploadGuideFile(..., assetKind)` 的映射（`model3d` / `model3d_decal` / `model3d_skybox`）。

---

## Web：CORS 与同源代理

- Three.js 对纹理/模型常需 `crossOrigin='anonymous'`，COS 桶若未对站点 Origin 配 CORS，浏览器会拦截。
- **做法**：在 `frontend/src/views/GuideDetail.vue` 将匹配 `*.cos.*.myqcloud.com/` 的 URL 改写为 **`/api/media/cos?key=<对象键>`**（或带 `BASE` 的完整同源前缀），由后端流式回源 COS。
- 后端路由：`GET /api/media/cos` → `MediaCosStream`（`backend/internal/handlers/misc.go`，注册于 `router.go`）。

---

## Web 组件与文案

- 组件：`frontend/src/components/ProductModelViewer.vue` + `frontend/src/utils/productModelViewer/ModelRenderer.js`、`DecalShader.js`（依赖 `three`）。
- 页面：`frontend/src/views/GuideDetail.vue`（`defineAsyncComponent` 懒加载 viewer；浮层底部提示用 `t('guideDetail.preview3DTip')`）。

---

## 微信小程序

- Three：`wechat-mp/libs/three.min.js`、`GLTFLoader.js`。
- 组件目录：`wechat-mp/components/model-viewer/`（`index.js` / `wxml` / `wxss` / `utils/*`）。
- 页面：`wechat-mp/pages/guide-detail/guide-detail.*`，`guide-detail.json` 注册 `model-viewer`；JS 中 `open3DViewer` / `close3DViewer` 与 `selectComponent` 调用 `loadModel` / `applyDecal` / `setSkybox`。

---

## 支付宝小程序

- `alipay-mp/pages/guide-detail/guide-detail.axml` + `guide-detail.js`：仅兜底弹窗，不加载 Three。

---

## i18n（`i18n_texts`）

| `key` | 用途 |
|-------|------|
| `guideDetail.preview3D` | 按钮「3D 预览」 |
| `guideDetail.preview3DTip` | 全屏操作提示 |
| `guideDetail.preview3DLoading` | 加载中文案 |
| `guideDetail.preview3DUnsupported` | 支付宝兜底正文 |

脚本：

- 首次插入（空则填）：`scripts/i18n_3d_preview.sql`（`ON DUPLICATE KEY UPDATE` 可能**不覆盖**已有坏数据）。
- **强制纠正乱码**：`scripts/i18n_3d_preview_fix.sql`（覆盖 `zh`/`en`）。

**重要（Windows / Agent 执行 SQL）**：勿用 PowerShell 把含中文的 SQL **管道进**远程 `mysql -e "..."`，易按本地 ANSI 重编码导致 **双重 UTF-8**。应在服务器上对文件重定向执行，并带字符集，例如：

```bash
sudo docker exec -i vino-mysql mysql --default-character-set=utf8mb4 -uroot -p*** vino_db < scripts/i18n_3d_preview_fix.sql
```

验证：`curl -s 'http://<host>:<port>/api/i18n?lang=zh' | grep preview3D` 应看到正确中文；更新库后若后端有缓存可 **`docker restart vino-backend`**。

---

## 发布与验证

- 前端静态资源变更：按项目 **「更新发布」** Skill 重建 `vino-frontend`。
- 后端或 `static/admin.html` 变更：重建 `vino-backend`。
- 快速验：`model3dEnabled` + 三个 URL 配齐后，Web 打开商品详情 → 浮钮文案、全屏加载与旋转缩放提示无乱码；控制台无 CORS 阻断。

---

## 排查速查

| 现象 | 优先检查 |
|------|-----------|
| 按钮 `3D é¢„è§ˆ` | DB 中 i18n 是否双重编码；执行 `i18n_3d_preview_fix.sql`；重启 backend |
| 模型/贴图加载失败、CORS | Web 是否走 `/api/media/cos?key=`；COS 对象键是否与 DB URL 一致 |
| 后台上传失败 | `assetKind` 与 handler 分支；GLB 是否误走图片缩略图逻辑 |
| 微信白屏 / 加载失败 | 组件路径、`downloadFile` 合法域名、GLB 大小与超时 |
