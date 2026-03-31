const app = getApp();
const { formatPriceDisplay } = require('../../utils/currency.js');
const i18n = require('../../utils/i18n.js');

function getStatusMap() {
  return {
    pending: { text: i18n.t('orders.pendingPay'), type: 'warning' },
    paid: { text: i18n.t('orders.paid'), type: 'primary' },
    processing: { text: i18n.t('orders.processing'), type: 'primary' },
    completed: { text: i18n.t('orders.completed'), type: 'success' },
    cancelled: { text: i18n.t('orders.cancelled'), type: 'default' },
  };
}

Page({
  data: {
    isLoggedIn: false,
    activeTab: 0,
    tabs: [],
    orders: [],
    loading: true,
    i18n: {},
  },

  onShow() {
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      self.loadOrders();
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  refreshI18n() {
    this.setData({
      i18n: {
        loading: i18n.t('orders.loading'),
        empty: i18n.t('orders.empty'),
        pay: i18n.t('orders.pay'),
        cancelOrder: i18n.t('orders.cancelOrder'),
        loginTip: i18n.t('orders.loginTip'),
        goLogin: i18n.t('orders.goLogin'),
      },
      tabs: [
        { key: 'all', name: i18n.t('orders.all') },
        { key: 'pending', name: i18n.t('orders.pendingPay') },
        { key: 'paid', name: i18n.t('orders.paid') },
        { key: 'processing', name: i18n.t('orders.processing') },
        { key: 'completed', name: i18n.t('orders.completed') },
      ],
    });
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadOrders() {
    const isLoggedIn = app.isLoggedIn();
    this.setData({ isLoggedIn });
    if (!isLoggedIn) {
      this.setData({ orders: [], loading: false });
      return Promise.resolve();
    }
    const status = this.data.tabs[this.data.activeTab].key;
    const url = status === 'all' ? '/orders/mine' : `/orders/mine?status=${status}`;
    this.setData({ loading: true });
    const statusMap = getStatusMap();
    return app
      .request({ url })
      .then(res => {
        const raw = res.data || {};
        const arr = raw.list || raw;
        const sym = app.globalData.currencySymbol || '¥';
        const data = (Array.isArray(arr) ? arr : []).map(o => ({
          ...o,
          priceDisplay: formatPriceDisplay(o.price, sym),
          statusText: (statusMap[o.status] || {}).text || o.status,
          statusType: (statusMap[o.status] || {}).type || 'default',
          timeText: this.formatTime(o.createdAt),
        }));
        this.setData({ orders: data, loading: false });
      })
      .catch(err => {
        this.setData({ loading: false, orders: [] });
        if (err.message === '请先登录') {
          wx.showToast({ title: i18n.t('orders.loginRequired'), icon: 'none' });
        }
      });
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    this.setData({ activeTab: index });
    this.loadOrders();
  },

  formatTime(t) {
    if (!t) return '';
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  payOrder(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    app
      .request({ method: 'POST', url: `/orders/${id}/pay-wechat` })
      .then((res) => {
        const p = res.data || {};
        wx.requestPayment({
          timeStamp: p.timeStamp,
          nonceStr: p.nonceStr,
          package: p.package,
          signType: p.signType || 'RSA',
          paySign: p.paySign,
          success: () => {
            wx.showToast({ title: i18n.t('orders.paySuccess'), icon: 'success' });
            this.loadOrders();
          },
          fail: (err) => {
            const msg = (err && err.errMsg) || '';
            if (msg.indexOf('cancel') !== -1) return;
            wx.showToast({ title: i18n.t('orders.payIncomplete'), icon: 'none' });
          },
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || i18n.t('orders.payFailed'), icon: 'none' });
      });
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: i18n.t('orders.cancelTitle'),
      content: i18n.t('orders.cancelConfirm'),
      success: res => {
        if (res.confirm) {
          app
            .request({ method: 'PUT', url: `/orders/${id}/cancel` })
            .then(() => {
              wx.showToast({ title: i18n.t('orders.orderCancelled'), icon: 'success' });
              this.loadOrders();
            })
            .catch(err => {
              wx.showToast({ title: err.message || i18n.t('orders.cancelFailed'), icon: 'none' });
            });
        }
      },
    });
  },
});
