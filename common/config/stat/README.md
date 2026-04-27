# 打点日志（按类型、按小时）配置

- **双仓纪律**：与 `common/config/log` 相同，须两仓逐字镜像。
- **加载**：环境变量 `STAT_HOURLY_CONFIG`；默认 `../common/config/stat/rmelamine.stat.yaml`（Vino 为 `vino.stat.yaml`）。
- **优先级**：`local_dir` 覆盖 `LOG_STAT_DIR` / 应用默认；`timezone` 默认 `Asia/Shanghai`。

## 字段

| 字段 | 说明 |
|------|------|
| `local_dir` | 本地打点根目录（可选） |
| `timezone` | 整点分桶与 `log/stat/...` 路径（IANA） |
| `uploader.enabled` | 是否启动后台上传（默认 true） |
| `uploader.tick_seconds` | 检测间隔（默认 60） |
