# 构建上下文为仓库根（与 compose），以便 Vite 解析 ../../../common/config/cos/vino.media.yaml?raw
FROM node:20-alpine AS builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
COPY common/config /common/config
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5201
CMD ["nginx", "-g", "daemon off;"]
