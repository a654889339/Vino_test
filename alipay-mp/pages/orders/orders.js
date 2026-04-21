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
    i18n.applyTabBarLabels();
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      self.loadOrders();
    };
    if (i18n.isLoaded()) doRefresh();
    else i18n.loadI18nTexts(doRefresh);
  },

  refreshI18n() {
    i18n.setNavTitle('orders.title', '我的订单', 'My Orders');
    this.setData({
      i18n: {
        loading: i18n.t('orders.loading'),
        empty: i18n.t('orders.empty'),
        cancelOrder: i18n.t('orders.cancelOrder'),
        loginTip: i18n.t('orders.loginTip'),
        goLogin: i18n.t('orders.goLogin'),
      },
      tabs: [
        { key: 'all', name: i18n.t('orders.all') },
        { key: 'pending', name: i18n.t('orders.pendingPay') },
        { key: 'processing', name: i18n.t('orders.processing') },
        { key: 'completed', name: i18n.t('orders.completed') },
      ],
    });
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => {
      my.stopPullDownRefresh();
    });
  },

  loadOrders() {
    const isLoggedIn = app.isLoggedIn();
    this.setData({ isLoggedIn });
    if (!isLoggedIn) {
      this.setData({ orders: [], loading: false });
      return Promise.resolve();
    }
    const status = (this.data.tabs[this.data.activeTab] || { key: 'all' }).key;
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
          serviceTitle: i18n.pick(o, 'serviceTitle') || o.serviceTitle || '',
          priceDisplay: formatPriceDisplay(o.price, sym),
          statusText: (statusMap[o.status] || {}).text || o.status,
          statusType: (statusMap[o.status] || {}).type || 'default',
          timeText: this.formatTime(o.createdAt),
        }));
        this.setData({ orders: data, loading: false });
      })
      .catch(err => {
        this.setData({ loading: false, orders: [] });
        if (err.message === '请先登录' || err.message === 'Please log in first') {
          my.showToast({ content: i18n.t('orders.loginRequired'), type: 'none' });
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

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    my.confirm({
      title: i18n.t('orders.cancelTitle'),
      content: i18n.t('orders.cancelConfirm'),
      success: res => {
        if (res.confirm) {
          app
            .request({ method: 'PUT', url: `/orders/${id}/cancel` })
            .then(() => {
              my.showToast({ content: i18n.t('orders.orderCancelled'), type: 'success' });
              this.loadOrders();
            })
            .catch(err => {
              my.showToast({ content: err.message || i18n.t('orders.cancelFailed'), type: 'none' });
            });
        }
      },
    });
  },
});
