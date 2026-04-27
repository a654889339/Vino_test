# 构建上下文为仓库根（见 docker-compose），以便 go.mod replace 指向 ../common/backend/*
FROM golang:1.25-alpine AS build
RUN apk add --no-cache git ca-certificates
WORKDIR /src
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn
ENV GOTOOLCHAIN=auto
COPY backend/ .
COPY common/backend /common/backend
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /vino-server ./cmd/server

FROM docker:24-cli AS dockercli

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata \
  && apk add --no-cache mysql-client --repository=https://dl-cdn.alpinelinux.org/alpine/v3.19/community
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
WORKDIR /app
COPY --from=build /vino-server /app/vino-server
COPY backend/static ./static
# 运行时 main 从 ../common/config/... 解析 YAML（WORKDIR=/app → /common/config）
COPY common/config /common/config
EXPOSE 5202
ENV PORT=5202
CMD ["/app/vino-server"]
