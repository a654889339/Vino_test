# 构建：docker build -t vino-backend .
FROM golang:1.22-alpine AS build
RUN apk add --no-cache git ca-certificates
WORKDIR /src
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /vino-server ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /vino-server /app/vino-server
COPY static ./static
EXPOSE 5202
ENV PORT=5202
CMD ["/app/vino-server"]
