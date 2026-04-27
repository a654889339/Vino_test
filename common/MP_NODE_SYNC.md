# 小程序与 common 对齐

- **R-Melamine** `wechat-mp/utils/mediaUrl.js` 已直接 `require('../../common/frontend/cos_base/paths.js')` 与 H5 共用规则；**Vino** 微信/支付宝 `utils/cosMedia.js` 同理。桶域与白名单以本仓 `common/config/cos` 与后端 `GET /api/media/cosConfig`（R-M）/ `GET /api/media/cos-config`（Vino）为真源；勿手抄第二份白名单。

- 若 Vino 分包等无法上溯到 `common/frontend/cos_base`，见本仓 `common/wechat-mp/cos_base/README.md`、**Vino 仓库** `common/alipay-mp/cos_base/README.md`。

- Vino 的 `backend-node` 已删除，后端仅 `backend/`（Go）。
