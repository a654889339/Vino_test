# 商品 COS 路径迁移说明

线上历史文件位于 `vino/items/goods/{device_guides.id}/`（如 `large_image.jpg`、`icon.png`、`scan.png` 等）。新版本 ToC 与小程序按 **`front_page_config/product/{id}/`** 下的固定文件名拼代理 URL，与 DB 中 `coverImage` / `iconUrl` 等字段解耦。

## 目标前缀与文件名（与 `media_asset_catalog.json` / 上传逻辑一致）

- 前缀：`front_page_config/product/{id}/`（`{id}` = `device_guides.id`）
- 示例映射（旧 → 新 stem，扩展名按实际上传保留或统一为 jpg/png）：
  - `large_image*` → `banner_page*`
  - `large_image_en*` → `banner_page_en*`
  - `cover_thumbnail*` → 仍为 `cover_thumbnail` / `cover_thumbnail_en`
  - `icon*` / `icon_en*` → 不变 stem
  - `model3d_decal*` → `decal.png`
  - `model3d_skybox*` → `model3d_skybox.jpg`（建议统一 jpg）
  - 说明书 PDF → `description.pdf`
  - 二维码 `scan.png` 可保留同名

## 操作建议

1. 使用腾讯云 COS 控制台或 **coscli** 在同一桶内「复制」对象到新前缀，再按需 **重命名**；或从源前缀同步到目标前缀的脚本（注意保持 `public-read` 与 `Content-Type`）。
2. 迁移完成后，在浏览器 spot-check：`GET /api/media/cos?key=front_page_config/product/<id>/banner_page.jpg`（扩展名以实际上传为准）。
3. 未迁移完成前，旧 URL 仍可通过白名单 `vino/items/` 访问；新上传仅写入 `front_page_config/product/...`。

## 可选 coscli 示例（需本机已配置密钥与桶）

将某商品 id=123 的旧目录复制到新目录后，在控制台批量改名；或使用 `coscli cp` 单文件拷贝并指定目标 Key。具体命令依赖桶名、地域与账号权限，此处不硬编码。
