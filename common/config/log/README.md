# 审计 HTTP 日志（按小时）配置

- **双仓纪律**：本目录下文件在 COLOMO_Like/R-Melamine 与 Vino_test 须**逐字镜像**；任一侧修改需同步另一侧。
- **加载**：进程启动时读取环境变量 `LOG_HOURLY_CONFIG` 指向的 YAML；未设置时默认 `../common/config/log/rmelamine.log.yaml`（Vino 为 `vino.log.yaml`）。
- **优先级**：`local_dir` 非空时覆盖 `.env` / `config.Load` 中的 `LOG_BACKEND_DIR`；否则沿用应用配置里的默认目录。`timezone` 默认 `Asia/Shanghai`。

## 字段

| 字段 | 说明 |
|------|------|
| `local_dir` | 本地 `backend_*.log` 根目录（可选） |
| `timezone` | 整点分桶与 OSS 路径日界线（IANA，默认上海） |
| `uploader.enabled` | 是否启动后台上传协程（默认 true） |
| `uploader.tick_seconds` | 检测整点推进间隔（默认 60） |
