# common/frontend/wechat_pay

微信支付（JSAPI / 小程序内 `wx.requestPayment`）的**前端侧说明与非敏感配置约定**。

## 原则

- **商户私钥/平台证书/APIV3Key 等敏感信息只能在后端**（环境变量/私密文件），前端与小程序不应持有。
- 前端/小程序只负责：
  - 向后端请求 **prepay/payment params**
  - 调用 `wx.requestPayment` 完成支付

## 后端应返回的数据结构（示例）

小程序支付前，前端请求后端接口（如 R-M `/api/orders/:id/pay/wechat`、Vino `/api/orders/:id/pay-wechat` 或 `/goods-orders/:id/pay-wechat`），后端返回的 `payment`（或整体）应能直接用于：

```js
wx.requestPayment({
  timeStamp,
  nonceStr,
  package,
  signType, // 通常为 'RSA'
  paySign,
});
```

## common/wechat-mp/pay

建议各小程序页面统一使用 `common/wechat-mp/pay`：

- `createWechatPayRunner({ requestPrepay }).pay(orderId)`

由业务侧注入如何请求后端 prepay 即可，页面避免重复写 `wx.requestPayment` 细节与 cancel 分支。

