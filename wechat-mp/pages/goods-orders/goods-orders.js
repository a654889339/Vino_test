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

Page({
  data: {
    loading: true,
    isLoggedIn: false,
    list: [],
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
      this.setData({ loading: false, list: [] });
      return;
    }
    app.request({ url: '/goods-orders', data: { page: 1, pageSize: 50 } })
      .then((res) => {
        const sym = app.globalData.currencySymbol;
        const list = (res.data && res.data.list ? res.data.list : []).map((o) => ({
          ...o,
          timeText: formatTime(o.createdAt),
          totalText: currencyUtil.formatPriceDisplay(o.totalPrice, o.currency || sym) || '—',
        }));
        this.setData({ list, loading: false });
      })
      .catch(() => this.setData({ list: [], loading: false }));
  },

  open(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/goods-order-detail/goods-order-detail?id=' + encodeURIComponent(String(id)) });
  },
});

