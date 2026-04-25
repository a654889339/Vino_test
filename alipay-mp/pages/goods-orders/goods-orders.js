const app = getApp();
const i18n = require('../../utils/i18n.js');
const currencyUtil = require('../../utils/currency.js');

const GOODS_ORDER_STATUS_GROUPS = {
  pendingPay: ['pending'],
  pendingShipment: ['paid'],
  pendingReceipt: ['processing'],
  pendingReview: ['completed'],
  afterSales: ['after_sale', 'after-sales', 'refund', 'refunding', 'refunded'],
};

function formatTime(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function orderStatusText(status) {
  const map = {
    pending: '待付款',
    paid: '已付款',
    processing: '处理中',
    completed: '已完成',
    cancelled: '已取消',
  };
  return map[status] || status;
}

Page({
  data: {
    loading: true,
    isLoggedIn: false,
    list: [],
    statusGroup: '',
    i18n: { loading: '' },
  },

  onLoad(options) {
    this.setData({ statusGroup: options && options.statusGroup ? decodeURIComponent(options.statusGroup) : '' });
  },

  onShow() {
    const self = this;
    const doRefresh = () => {
      self.setData({ i18n: { loading: i18n.t('common.loading') } });
      self.load();
    };
    if (i18n.isLoaded()) doRefresh();
    else i18n.loadI18nTexts(doRefresh);
  },

  load() {
    const isLoggedIn = app.isLoggedIn();
    this.setData({ isLoggedIn, loading: true });
    if (!isLoggedIn) {
      this.setData({ loading: false, list: [] });
      return;
    }
    const statuses = GOODS_ORDER_STATUS_GROUPS[this.data.statusGroup] || [];
    const requests = statuses.length
      ? statuses.map(status => app.request({ url: '/goods-orders', data: { status, page: 1, pageSize: 50 } }))
      : [app.request({ url: '/goods-orders', data: { page: 1, pageSize: 50 } })];
    Promise.all(requests)
      .then((results) => {
        const sym = app.globalData.currencySymbol;
        const rows = results
          .reduce((all, res) => all.concat((res.data && res.data.list) ? res.data.list : []), [])
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        const list = rows.map((o) => ({
          ...o,
          timeText: formatTime(o.createdAt),
          totalText: currencyUtil.formatPriceDisplay(o.totalPrice, o.currency || sym) || '—',
          statusText: orderStatusText(o.status),
          statusClass: o.status,
        }));
        this.setData({ list, loading: false });
      })
      .catch(() => this.setData({ list: [], loading: false }));
  },

  open(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    my.navigateTo({ url: '/pages/goods-order-detail/goods-order-detail?id=' + encodeURIComponent(String(id)) });
  },
});
