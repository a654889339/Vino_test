---
name: product-3d-preview
description: >-
  Vino_test 商品详情（DeviceGuide）3D 预览端到端：后台开关、GLB/贴花/天空盒 COS 上传、Web Three.js 全屏 overlay、微信自定义组件、支付宝文案兜底；
  Web 经 /api/media/cos 同源代理规避 CORS；i18n 键、SQL 在 Windows 下勿管道乱码、双重 UTF-8 修复脚本。
  在用户或任务提到 3D 预览、model3d、GLB、贴花、天空盒、GuideDetail 3D、ProductModelViewer、model-viewer、preview3D 时使用。
---

# 商品 3D 预览（Vino_test）

本 Skill 汇总仓库内**已实现**的「商品详情 3D 预览」：数据字段、上传、各端 UI、CORS、i18n 与常见故障。**不**替代 COS 桶级 CORS 文档；Web 端以**同源代理**为主方案。

## 何时查阅

- 改文案、overlay、加载态、支付宝兜底提示。
- 扩展上传类型、COS 路径或后台表字段。
- **浏览器 CORS / Three 纹理或 GLB 加载失败**。
- **中文变 `é¢„è§ˆ`** 等乱码（双重 UTF-8）。
- 联调微信 `model-viewer`、合法域名与下载超时。

---

## 行为矩阵

| 端 | 展示条件 | 行为 |
|----|-----------|------|
| 管理后台 | 编辑 Device Guide | `model3dEnabled` 开关 + 三个 URL 输入 + 各「上传」 |
| Web | `model3dEnabled` 且 `model3dUrl` 非空 | 浮层「3D 预览」→ 全屏 overlay → 懒加载 `ProductModelViewer` |
| 微信 | 同上 | `components/model-viewer`，`wx.downloadFile` + Three |
| 支付宝 | 可显示入口（按页面逻辑） | `my.showModal`，文案键 `guideDetail.preview3DUnsupported` |

---

## 数据与迁移

**模型**：`backend/internal/models/deviceguide.go`

| DB / GORM（示意） | JSON | 含义 |
|-------------------|------|------|
| `model3dEnabled` | `model3dEnabled` | 开关 |
| `model3dUrl` | `model3dUrl` | GLB |
| `model3dDecalUrl` | `model3dDecalUrl` | 贴花图 |
| `model3dSkyboxUrl` | `model3dSkyboxUrl` | 天空盒图 |

**兜底 DDL**：`scripts/migrate_device_guide_3d.sql`（手工、幂等）。

---

## 上传（`guideUploadFile`）

**文件**：`backend/internal/handlers/guide.go`  
**表单**：`assetKind` ∈ `model3d` | `model3d_decal` | `model3d_skybox`

- `model3d`：GLB，走**非图片**分支，COS 上在 `goods/{id}/` 下固定 **`model3d.glb`**（与现有 goods 规则一致）。
- `model3d_decal` / `model3d_skybox`：按图片扩展名，固定前缀文件名 + 原扩展名；handler 内 `isModel3D` 等分支避免误走缩略图逻辑。

**管理端**：`backend/static/admin.html` — `gModel3DUrl`、`gModel3DDecalUrl`、`gModel3DSkyboxUrl` 与 `uploadGuideFile(..., assetKind)` 映射。

---

## Web：CORS 与同源代理

Three.js 常设 `crossOrigin='anonymous'`；COS 若未对站点 Origin 配 CORS，直链会失败。

**实现**：`frontend/src/views/GuideDetail.vue` 内将 `https?://*.cos.*.myqcloud.com/` 改写为同源 **`(BASE 或 /api)/media/cos?key=<URL 中对象键>`**（`encodeURIComponent`）。  
**后端**：`GET /api/media/cos` → `MediaCosStream`（如 `backend/internal/handlers/misc.go`，路由见 `router.go`）。

---

## 文件清单（实现入口）

| 区域 | 路径 |
|------|------|
| Web 页面 | `frontend/src/views/GuideDetail.vue` |
| Web 3D 组件 | `frontend/src/components/ProductModelViewer.vue` |
| Web Three 工具 | `frontend/src/utils/productModelViewer/ModelRenderer.js`、`DecalShader.js` |
| 依赖 | `frontend/package.json` → `three` |
| 微信组件 | `wechat-mp/components/model-viewer/` |
| 微信 Three | `wechat-mp/libs/three.min.js`、`GLTFLoader.js` |
| 微信页面 | `wechat-mp/pages/guide-detail/guide-detail.{js,json,wxml,wxss}` |
| 支付宝页面 | `alipay-mp/pages/guide-detail/guide-detail.{js,axml,acss}` |

---

## i18n（`i18n_texts`）

| key | 用途 |
|-----|------|
| `guideDetail.preview3D` | 按钮「3D 预览」 |
| `guideDetail.preview3DTip` | 全屏操作提示 |
| `guideDetail.preview3DLoading` | 加载中文案 |
| `guideDetail.preview3DUnsupported` | 支付宝兜底正文 |

**脚本**

- `scripts/i18n_3d_preview.sql`：首次插入；`ON DUPLICATE KEY UPDATE` 若只填「空则更新」，**不会覆盖已写入的坏数据**。
- `scripts/i18n_3d_preview_fix.sql`：**强制覆盖** `zh`/`en`，用于纠正双重 UTF-8 乱码。

**Windows / Agent 执行中文 SQL（必读）**

- **不要**在 PowerShell 里把含中文的 SQL **管道进**远程 `mysql -e '...'`，易按本地 ANSI 重编码 → 库内双重 UTF-8（界面 `3D é¢„è§ˆ`）。
- **推荐**：代码已在仓库 → 服务器 `git pull` 后，在服务器上：

```bash
sudo docker exec -i vino-mysql mysql --default-character-set=utf8mb4 -uroot -p<PASSWORD> vino_db < scripts/i18n_3d_preview_fix.sql
```

**验证**：`curl -s 'http://<host>:<port>/api/i18n?lang=zh' | grep preview3D` 应为正常中文；若后端缓存旧文案，**`docker restart vino-backend`**（日常发布见项目「更新发布」Skill，仅重建/重启 backend 即可，勿整栈 down、勿动 DB）。

---

## 发布与自测

- 按仓库 `.cursor/skills/更新发布/SKILL.md`：仅 `docker compose up -d --build vino-backend vino-frontend`（及按需 `git pull`），不 `docker compose down`，不重启 MySQL。
- 自测：后台配齐开关与三 URL → Web 浮钮文案、overlay 提示、模型与贴图加载；控制台无 CORS；微信端下载与组件回调。

---

## 排查速查

| 现象 | 优先检查 |
|------|-----------|
| `3D é¢„è§ˆ` 等乱码 | DB 双重编码；执行 `i18n_3d_preview_fix.sql`；重启 `vino-backend` |
| 模型/纹理失败、CORS | Web 是否改写为 `/api/media/cos?key=`；DB 中 URL 与 COS 对象键是否一致 |
| 后台上传异常 | `assetKind`；GLB 是否误走图片/缩略图分支 |
| 微信白屏/超时 | 合法域名、`downloadFile`、GLB 体积与网络 |

---

## 参考

历史对齐思路可参考本机 `F:/zhikeweilai` 的 3D 预览实现；本仓库路径与接口以当前文件为准。
