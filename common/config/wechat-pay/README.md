# common/config/wechat-pay

微信支付配置基线。这里保存两项目统一的字段结构、接口路径约定与敏感环境变量名；不得提交商户私钥、API v3 Key、平台证书等真实敏感内容。

## 字段

- `enabled`: 总开关，默认关闭。
- `appId`: 支付所用小程序 appid。
- `mchId`: 微信支付商户号。
- `mchSerialNoEnv`: 商户 API 证书序列号环境变量名，统一为 `WECHAT_PAY_MCH_SERIAL_NO`。
- `apiV3KeyEnv`: API v3 Key 环境变量名。
- `privateKeyEnv` / `privateKeyPathEnv`: 商户私钥 PEM 或文件路径环境变量名。
- `platformCertEnv` / `platformCertPathEnv`: 平台证书 PEM 或文件路径环境变量名，用于回调验签。
- `notifyUrl`: 公网回调 URL，部署环境注入。
- `notifyRoute`: 后端实际注册的回调路由。
- `prepayRoutes`: 前端/小程序调用的预支付路由清单。

## 安全约定

回调必须先验证微信支付 HTTP 头签名，再解密 `resource`。两项目都必须配置平台证书，避免仅凭 AES-GCM 解密判断回调可信。

