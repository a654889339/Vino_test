---
name: 更新发布
description: 将本地代码上传到 Git，并通过 SSH 在腾讯云服务器上拉取代码、编译并更新部署（Docker）。执行前需先阅读 connectToTxCloud.md 获取 SSH 与服务器信息。
---

# 更新发布（Vino_test）

当用户要求「更新发布」「发布」「部署」「推代码并部署」时，按以下流程执行。

## 项目相关说明（首页配置）

- **首页背景图**：后台「首页配置」可新增多条「首页背景图 (HomeBg)」，填图片 URL、排序；前台首页顶部会按列表**自动轮播**播放（约 4 秒切换）。**网页与小程序首页背景区已去除蓝色底**，仅显示配置的背景图铺满该区域，无渐变遮挡。
- **板块名称可配置**：后台可新增「热门服务区块标题」「为你推荐区块标题」配置项，填写标题后前台对应板块会显示该名称，未配置则显示默认「热门服务」「为你推荐」。
- **距上高度调节**：后台可新增「热门服务-距上高度」「为你推荐-距上高度」配置项，标题填数字（单位 px，可填负数如 -10），用于调节该板块与上一板块的间距；网页与小程序均生效。

## 前置依赖

- **连接与服务器信息**：先读取项目中的 **`.cursor/skills/connectToTxCloud.md`**（或任意 `connect*.md`），获取：
  - SSH 命令（含密钥路径、用户、IP、端口）
  - 服务器上项目路径（如 `/root/Vino_test`）
  - 是否使用 GitHub 镜像（如 ghfast.top）、是否需 `sudo`

## 流程概览

1. **本地 Git：提交并推送**
2. **SSH 到服务器：拉取代码**
3. **服务器：重新构建并启动容器**

---

## 第一步：本地 Git 上传

在项目根目录执行（PowerShell 用分号连接命令）：

```bash
git add -A
git status
git commit -m "<用户指定的提交说明或简短描述>"
git push origin main
```

- 若用户未提供提交说明，使用简洁英文或中文描述本次改动，例如：`feat: 更新发布流程与文档`。
- 若当前分支不是 `main`，按实际分支名推送（如 `master`）。

---

## 第二步：SSH 拉取代码

根据 **connectToTxCloud.md** 中的 SSH 命令与项目路径执行。

**示例**（具体以 connect 文档为准）：

- SSH 选项（RSA 兼容）：`-o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i <密钥路径>`
- 用户与主机：`ubuntu@106.54.50.88`
- 项目路径：`/root/Vino_test`（需 `sudo`）

**拉取命令**（服务器若使用 GitHub 镜像，remote 已配置为镜像地址）：

```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i <密钥路径> ubuntu@106.54.50.88 "sudo git -C /root/Vino_test pull"
```

将 `<密钥路径>` 替换为 connect 文档中的实际路径（如 `F:/ItsyourTurnMy/backend/deploy/test.pem`）。

---

## 第三步：服务器编译与部署

在同一台服务器上，进入项目目录，使用 **Docker Compose v2** 重新构建并启动（connect 文档中注明使用 `docker compose`）：

```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i <密钥路径> ubuntu@106.54.50.88 "sudo bash -c 'cd /root/Vino_test && docker compose down && docker compose up -d --build'"
```

- 若文档中写的是 `docker-compose`（v1），则改用 `docker-compose`。
- 构建时间可能较长，命令会等待执行结束。

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
4. **失败时**：若 `git pull` 失败，检查服务器 remote 是否为镜像地址；若 docker 失败，在服务器上执行 `docker compose logs` 查看错误。
5. **后端新增依赖**：若修改了 `backend/package.json`（如新增 tencentcloud-sdk-nodejs），需在本地执行 `cd backend && npm install` 生成/更新 `package-lock.json`，再 commit 并 push，否则服务器上 `npm ci` 会报 lock 与 package 不同步。
