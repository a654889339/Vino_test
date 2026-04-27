/**
 * 小程序微信支付（JSAPI）统一封装。
 *
 * 约定：requestPrepay 返回的对象需可直接展开为 wx.requestPayment 参数，
 * 或者返回 { payment }（与 R-Melamine /api/orders/:id/pay/wechat 返回结构一致）。
 */

function normalizePaymentParams(raw) {
  const p = raw && raw.payment ? raw.payment : raw;
  return p && typeof p === 'object' ? p : null;
}

function isCancelErr(err) {
  const msg = (err && (err.errMsg || err.message)) || '';
  return /cancel/i.test(String(msg));
}

/**
 * @param {{ requestPrepay: (orderId: string|number) => Promise<any> }} deps
 */
function createWechatPayRunner(deps) {
  if (!deps || typeof deps.requestPrepay !== 'function') {
    throw new Error('createWechatPayRunner: requestPrepay required');
  }
  return {
    /**
     * @param {string|number} orderId
     * @returns {Promise<{ cancelled: boolean }>}
     */
    pay(orderId) {
      if (typeof wx === 'undefined' || typeof wx.requestPayment !== 'function') {
        return Promise.reject(new Error('请在微信小程序内完成支付'));
      }
      return Promise.resolve()
        .then(() => deps.requestPrepay(orderId))
        .then((res) => {
          const params = normalizePaymentParams(res);
          if (!params) throw new Error('支付参数无效');
          return new Promise((resolve, reject) => {
            wx.requestPayment({
              ...params,
              success: () => resolve({ cancelled: false }),
              fail: (err) => {
                if (isCancelErr(err)) return resolve({ cancelled: true });
                reject(err || new Error('支付失败'));
              },
            });
          });
        });
    },
  };
}

module.exports = { createWechatPayRunner };

