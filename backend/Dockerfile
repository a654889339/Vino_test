# 构建：docker build -t vino-backend .
FROM golang:1.22-alpine AS build
RUN apk add --no-cache git ca-certificates
WORKDIR /src
# 腾讯云等国内环境访问 proxy.golang.org 易超时，构建时使用国内代理
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /vino-server ./cmd/server

FROM alpine:3.19
# mysql-client（community）：与 mysql:8.0 的 caching_sha2_password 兼容；mariadb-client 缺插件会 1045
RUN apk add --no-cache ca-certificates tzdata \
  && apk add --no-cache mysql-client --repository=https://dl-cdn.alpinelinux.org/alpine/v3.19/community
WORKDIR /app
COPY --from=build /vino-server /app/vino-server
COPY static ./static
EXPOSE 5202
ENV PORT=5202
CMD ["/app/vino-server"]
