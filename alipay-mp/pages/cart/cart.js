const app = getApp();
const i18n = require('../../utils/i18n.js');
const currencyUtil = require('../../utils/currency.js');
const { resolveMediaUrl } = require('../../utils/cosMedia.js');

Page({
  data: {
    loading: true,
    isLoggedIn: false,
    lines: [],
    totalText: '',
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
      this.setData({ loading: false, lines: [], totalText: '' });
      return;
    }
    app.request({ url: '/cart' })
      .then((res) => {
        const d = res.data || {};
        const sym = app.globalData.currencySymbol;
        const lines = (d.items || []).map((x) => ({
          ...x,
          imageUrl: x.imageUrl ? resolveMediaUrl(x.imageUrl, app.globalData.baseUrl) : '',
          priceText: currencyUtil.formatPriceDisplay(x.listPrice, x.currency || sym) || '未定价',
        }));
        const totalText = currencyUtil.formatPriceDisplay(d.totalPrice || 0, sym) || '—';
        this.cartLines = d.items || [];
        this.setData({ lines, totalText, loading: false });
      })
      .catch(() => this.setData({ lines: [], totalText: '', loading: false }));
  },

  changeQty(e) {
    const id = Number(e.currentTarget.dataset.id) || 0;
    const delta = Number(e.currentTarget.dataset.delta) || 0;
    if (!id || !delta) return;
    const cur = (this.cartLines || []).map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
    const idx = cur.findIndex((x) => Number(x.guideId) === id);
    if (idx < 0) return;
    cur[idx].qty += delta;
    if (cur[idx].qty <= 0) cur.splice(idx, 1);
    app.request({ url: '/cart', method: 'PUT', data: { items: cur } })
      .then((res) => {
        this.cartLines = (res.data && res.data.items) ? res.data.items : [];
        this.load();
      })
      .catch((err) => my.showToast({ content: (err && err.message) || '更新失败', type: 'none' }));
  },

  goCheckout() {
    if (!this.data.lines.length) {
      my.showToast({ content: '购物车为空', type: 'none' });
      return;
    }
    my.navigateTo({ url: '/pages/checkout/checkout' });
  },
});
