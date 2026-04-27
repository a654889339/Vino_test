---
name: 更新发布
description: 通过 SSH 在腾讯云服务器上发布：先本机 git push，再服务器 git pull，并用 Docker **编译 Go 后端**（backend/Dockerfile：go mod tidy + go build）与构建前端镜像，仅重建 vino-backend、vino-frontend；不整栈重启、不重启 MySQL、不修改 DB。执行前需先阅读 connectToTxCloud.md 获取 SSH 与服务器信息。
---

# 更新发布（Vino_test）

当用户要求「更新发布」「发布」「部署」时，按以下流程执行。

## 后端构建方式（Go，非 Node）

- **源码目录**：仓库内 `backend/` 为 **Go** 服务（`go.mod`、`cmd/server/main.go`）。
- **服务器上如何「编译后端」**：**不**在服务器单独安装 Go；使用 **`docker compose up -d --build vino-backend`**，由 **`backend/Dockerfile`** 在容器构建阶段执行：
  - `go mod tidy`
  - `CGO_ENABLED=0 go build -o /vino-server ./cmd/server`
- 运行时镜像为 **Alpine**，仅包含编译好的二进制与 `static/`（管理页等），**无 Node/npm**。
- 历史 Node 后端目录已移除；仅维护 `backend/`（Go）。

## 禁止事项（必须遵守）

- **禁止修改 DB**：不执行数据库迁移、不删除或替换 volume（如 `vino-mysql-data`）。
- **禁止整栈 down**：不执行 `docker compose down`，不重启 vino-mysql。

## 项目相关说明（后台配置）

- **首页配置**：管理 **自助预约(大/小)**、**我的商品**（及 Vino 产品、甄选推荐、探索 VINO 等在后台对应入口）。红框处可设置 **板块整体偏移(px)**，仅移动首页配置管理对应区块，不移动首页动画配置（开场动画、首页 Logo、首页背景）。**自助服务 / 服务产品** 已从首页与后台配置表移除。
- **首页动画配置**：单独管理 **开场动画**、**首页 Logo**、**首页背景图**。首页背景可配置多条并自动轮播（约 4 秒切换）；网页与小程序首页背景区仅显示配置图，无蓝色底或渐变遮挡。
- **已移除功能**：「为已有图片生成缩略图」按钮及函数、「热门服务距上/为你推荐距上」配置、各板块标题可编辑功能（navSectionTitle/hotServiceTitle/recommendTitle 编辑入口）均已移除。商品库存仅提供数据支持，不提供页面配置。

## 前置依赖

- **连接与服务器信息**：先读取项目中的 **`.cursor/skills/connectToTxCloud.md`**（或任意 `connect*.md`），获取：
  - SSH 命令（含密钥路径、用户、IP、端口）
  - 服务器上项目路径（如 `/home/ubuntu/Vino_test`）
  - 是否使用 GitHub 镜像（如 ghfast.top）、是否需 `sudo`

## 流程概览

1. **本机（必做）**：先把当前分支最新代码 **push 到 origin**（确保服务器可拉到本次改动）。
2. **SSH 到服务器**：在项目目录下 **`git pull`**。
3. **SSH 到服务器**：**仅重建并启动** `vino-backend`（Go 编译）、`vino-frontend`：`docker compose up -d --build vino-backend vino-frontend`（需 sudo）。

---

## 第一步：本机先 git push（必做）

在本机仓库根目录先执行 `git push`。推荐流程：

```bash
git status
# 若有改动，先提交
git add -A
git commit -m "<用户指定的提交说明或简短描述>"
git push origin main
```

若本地已无未提交改动，也应执行一次：

```bash
git push origin main
```

---

## 第二步：SSH 拉取代码

在服务器上进入 `/home/ubuntu/Vino_test` 并执行 `git pull`（/home/ubuntu 下无需 sudo）。密钥路径以 connect 文档为准（如 `F:/ItsyourTurnMy/backend/deploy/test.pem`）：

```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i F:/ItsyourTurnMy/backend/deploy/test.pem ubuntu@106.54.50.88 "cd /home/ubuntu/Vino_test && git pull"
```

若服务器使用 GitHub 镜像，remote 已配置为镜像地址，直接执行即可。

---

## 第三步：Docker 编译 Go 后端并更新前端（不 down、不动 DB）

在同一台服务器上，进入项目目录，**仅**对 **vino-backend**（Dockerfile 内 **go build**）、**vino-frontend** 重新构建并启动；不执行 `docker compose down`，不重启 vino-mysql：

```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i F:/ItsyourTurnMy/backend/deploy/test.pem ubuntu@106.54.50.88 "sudo bash -c 'cd /home/ubuntu/Vino_test && docker compose up -d --build vino-backend vino-frontend'"
```

- **vino-backend**：拉取 `backend/` 源码后，在镜像构建阶段 **编译 Go 二进制**，替换运行中的后端容器。
- **vino-frontend**：按需重建静态前端镜像。
- MySQL（`vino-mysql`）保持运行。

---

## 一键执行（推荐顺序）

```bash
# 1. 本机先推送
git push origin main

# 2. 拉取代码
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i F:/ItsyourTurnMy/backend/deploy/test.pem ubuntu@106.54.50.88 "cd /home/ubuntu/Vino_test && git pull"

# 3. Docker 编译 Go 后端并更新前端（不 down、不动 volume）
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i F:/ItsyourTurnMy/backend/deploy/test.pem ubuntu@106.54.50.88 "sudo bash -c 'cd /home/ubuntu/Vino_test && docker compose up -d --build vino-backend vino-frontend'"
```

---

## 本地 Git 上传（默认步骤）

部署前默认需要在项目根目录执行：

```bash
git add -A
git status
git commit -m "<用户指定的提交说明或简短描述>"
git push origin main
```

再执行上述第二步、第三步（或一键执行三条命令）。

---

## 可选：验证部署

- 健康检查（示例，端口以 connect 文档为准）：
  ```bash
  ssh ... ubuntu@106.54.50.88 "curl -s http://localhost:5202/api/health"
  ```
- 查看容器与日志：
  ```bash
  ssh ... ubuntu@106.54.50.88 "sudo docker ps --filter 'name=vino'"
  ssh ... ubuntu@106.54.50.88 "sudo docker logs vino-backend --tail 50"
  ```

---

## 注意事项

1. **先读 connect*.md**：SSH 密钥路径、主机、项目路径、是否用镜像、是否 sudo 均以该文档为准。
2. **Windows 下路径**：密钥路径可用正斜杠（如 `F:/path/to/test.pem`），避免反斜杠转义问题。
3. **首次部署**：若服务器尚未 clone 仓库，需先按 connect 文档中的「First-time deployment」执行 clone（通常通过镜像 URL），再执行上述 pull 与 docker 命令。
4. **失败时**：若 `git pull` 失败，检查服务器 remote 是否为镜像地址；若 docker 失败，在服务器上执行 `docker compose logs vino-backend` 等查看错误。
5. **后端新增依赖**：修改 `backend/go.mod` 后，本地执行 `cd backend && go mod tidy`，提交 `go.mod` / `go.sum`；服务器上 **`docker compose --build`** 会在 Dockerfile 中再次 `go mod tidy` 并 **go build**。
6. **整栈重启**：若确需重启全部服务（含 MySQL），再使用 `docker compose down && docker compose up -d --build`；日常更新部署仅用上述第一步+第二步+第三步（或一键执行）即可，禁止 down。
