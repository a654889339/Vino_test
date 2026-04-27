# common/config/phone_verify_code

短信验证码（手机验证）配置。由后端在启动时读取，决定当前使用的云厂商与 SDK 参数。

## 格式约定

- **仅使用 YAML**
- **不要提交真实密钥**（ak/sk 等仅在部署环境通过挂载/环境变量/私密文件提供）

## 字段说明（简要）

- `enabled`: 总开关（默认关闭）；也可用环境变量 `PHONE_VERIFY_ENABLED` 覆盖
- `provider`: `tencent` | `aliyun`
- `policy.code_expire_minutes`: 验证码有效期（分钟）
- `policy.cooldown_seconds`: 同手机号发送冷却（秒）
- `tencent.*`: 腾讯云短信 SDK 所需
- `aliyun.*`: 阿里云短信 SDK 所需

## 使用

后端通过环境变量 `PHONE_VERIFY_CODE_CONFIG` 指向配置文件路径；未设置时使用 `../common/config/phone_verify_code/<project>.yaml`。

默认关闭：如需启用，请在 YAML 里设 `enabled: true`，或在部署环境设置 `PHONE_VERIFY_ENABLED=1`。

