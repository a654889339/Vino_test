# shared/cosbase

云对象存储（OSS/COS）公共逻辑分为两层：

1. **与厂商 SDK 无关**：key 校验、多次 percent-encode 路径规范化、代理白名单匹配、从 URL 解析 object key（等）。
2. **多厂商 StorageClient**：`NewStorageClient` 按 `StorageConfig.CloudProvider`（`aliyun` / `tencent`）选择阿里云 OSS 或腾讯云 COS SDK，实现 `PutBytes`、`Head`、`List`、`SignedGetURL` 等。

- **修改须双仓同步**：`COLOMO_Like/R-Melamine/common/backend/cos_base` 与 `Vino_test/common/backend/cos_base` 同名文件内容保持一致（`go test ./...` 与人工 diff）。
- **各项目中的用法**：R-Melamine 在 `internal/ossstorage`、Vino_test 在 `internal/services/cos.go` 等处以**薄封装**注入 `config` / 环境凭据与 `mediacfg` / `vinomediacfg` 解析出的 `cloudProvider`，再调用本包的 `StorageClient`；业务 handler 不直接依赖具体云 SDK。

## 引用

在 `backend/go.mod`：

```text
require shared/cosbase v0.0.0
replace shared/cosbase => ../common/backend/cos_base
```
