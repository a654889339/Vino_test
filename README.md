# Vino 服务

一站式服务管理平台，包含 Web 前端、后端 API、微信小程序和支付宝小程序。

## 项目结构

```
Vino_test/
├── frontend/           # Vue3 + Vite 前端（移动端优先）
│   ├── src/
│   │   ├── views/      # 页面组件
│   │   ├── components/ # 公共组件
│   │   ├── api/        # API 请求封装
│   │   ├── stores/     # Pinia 状态管理
│   │   └── router/     # 路由配置
│   ├── Dockerfile
│   └── nginx.conf
├── backend/            # Node.js + Express 后端
│   ├── src/
│   │   ├── routes/     # 路由
│   │   ├── controllers/# 控制器
│   │   ├── models/     # Sequelize 模型
│   │   ├── middleware/  # 中间件（JWT认证等）
│   │   └── config/     # 配置
│   └── Dockerfile
├── wechat-mp/          # 微信小程序
│   ├── pages/
│   │   ├── index/      # 首页
│   │   ├── service/    # 服务列表
│   │   └── mine/       # 我的
│   └── app.json
├── alipay-mp/          # 支付宝小程序
│   ├── pages/
│   │   ├── index/      # 首页
│   │   ├── service/    # 服务列表
│   │   └── mine/       # 我的
│   └── app.json
├── deploy/             # 部署脚本
├── docker-compose.yaml # Docker 编排
└── nginx-vino.conf     # Nginx 反向代理
```

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Vant 4 + Pinia |
| 后端 | Node.js + Express + Sequelize + MySQL |
| 微信小程序 | 原生小程序框架 |
| 支付宝小程序 | 原生小程序框架 |
| 部署 | Docker + Docker Compose |

## 端口分配

| 服务 | 端口 |
|------|------|
| 前端 | 5201 |
| 后端 API | 5202 |
| MySQL | 3308 |

> 端口设计避免了与 ItsyourTurnMy（5001/5002/3306）和 ItsyourTurnRing（5101/5102/3307）的冲突。

## 快速开始

### 本地开发

```bash
# 后端
cd backend
cp .env.example .env
npm install
npm run dev

# 前端
cd frontend
npm install
npm run dev
```

### Docker 部署

```bash
docker compose up -d --build
```

### 腾讯云部署

```bash
bash deploy/deploy.sh
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/profile | 获取用户信息 |
| GET | /api/services | 服务列表 |
| GET | /api/services/:id | 服务详情 |
| POST | /api/services | 创建服务（管理员）|
| PUT | /api/services/:id | 更新服务（管理员）|
| DELETE | /api/services/:id | 删除服务（管理员）|
| GET | /api/health | 健康检查 |

## 服务器信息

- **IP**: 106.54.50.88
- **前端访问**: http://106.54.50.88:5201
- **后端API**: http://106.54.50.88:5202/api/health
