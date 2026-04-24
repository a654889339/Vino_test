const app = getApp();
const i18n = require('../../utils/i18n.js');
const currencyUtil = require('../../utils/currency.js');

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
    order: null,
    i18n: { loading: '' },
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
      this.setData({ loading: false, order: null });
      return;
    }
    const id = this.options && this.options.id ? this.options.id : '';
    if (!id) {
      this.setData({ loading: false, order: null });
      return;
    }
    app.request({ url: '/goods-orders/' + encodeURIComponent(String(id)) })
      .then((res) => {
        const o = res.data || null;
        if (!o) {
          this.setData({ order: null, loading: false });
          return;
        }
        const sym = app.globalData.currencySymbol;
        const items = (o.items || []).map((it) => ({
          ...it,
          unitText: currencyUtil.formatPriceDisplay(it.unitPrice, it.currency || sym) || '—',
          lineText: currencyUtil.formatPriceDisplay(it.lineTotal, it.currency || sym) || '—',
        }));
        this.setData({
          order: {
            ...o,
            timeText: formatTime(o.createdAt),
            totalText: currencyUtil.formatPriceDisplay(o.totalPrice, o.currency || sym) || '—',
            statusText: orderStatusText(o.status),
            statusClass: o.status,
            items,
          },
          loading: false,
        });
      })
      .catch(() => this.setData({ order: null, loading: false }));
  },
});
