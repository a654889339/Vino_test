# shared/cosbase

云对象存储（OSS/COS）**与厂商 SDK 无关**的公共逻辑：key 校验、多次 percent-encode 路径规范化、代理白名单匹配、从 URL 解析 object key。

- **修改须双仓同步**：`COLOMO_Like/R-Melamine/common/backend/cos_base` 与 `Vino_test/common/backend/cos_base` 同名文件内容保持一致（`go test ./...` 与人工 diff）。
- 阿里云 OSS / 腾讯云 COS 的 Put/Get/签名 仍在各项目 `internal/ossstorage`、`internal/services` 中实现，仅调用本包。

## 引用

在 `backend/go.mod`：

```text
require shared/cosbase v0.0.0
replace shared/cosbase => ../common/backend/cos_base
```
