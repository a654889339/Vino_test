# 构建：docker build -t vino-backend .
FROM golang:1.22-alpine AS build
RUN apk add --no-cache git ca-certificates
WORKDIR /src
# 腾讯云等国内环境访问 proxy.golang.org 易超时，构建时使用国内代理
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /vino-server ./cmd/server

# docker CLI：用于在 backend 容器内 exec 到 mysql:8.0 官方镜像执行 mysqldump（与 caching_sha2_password 兼容）
FROM docker:24-cli AS dockercli

FROM alpine:3.19
# Alpine 的 mysql-client 实际为 MariaDB 客户端，缺 caching_sha2_password 插件；
# 因此以 docker exec 到 vino-mysql 官方客户端为主路径，mysql-client 仅作兜底。
RUN apk add --no-cache ca-certificates tzdata \
  && apk add --no-cache mysql-client --repository=https://dl-cdn.alpinelinux.org/alpine/v3.19/community
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
WORKDIR /app
COPY --from=build /vino-server /app/vino-server
COPY static ./static
EXPOSE 5202
ENV PORT=5202
CMD ["/app/vino-server"]
