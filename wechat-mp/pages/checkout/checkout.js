const app = getApp();
const i18n = require('../../utils/i18n.js');
const currencyUtil = require('../../utils/currency.js');

Page({
  data: {
    loading: true,
    submitting: false,
    isLoggedIn: false,
    lines: [],
    totalText: '',
    i18n: { loading: '' },
    form: {
      contactName: '',
      contactPhone: '',
      address: '',
      remark: '',
    },
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
          priceText: currencyUtil.formatPriceDisplay(x.listPrice, x.currency || sym) || '未定价',
          lineTotalText: currencyUtil.formatPriceDisplay(x.lineTotal, x.currency || sym) || '—',
        }));
        const totalText = currencyUtil.formatPriceDisplay(d.totalPrice || 0, sym) || '—';
        this.setData({ lines, totalText, loading: false });
      })
      .catch(() => this.setData({ lines: [], totalText: '', loading: false }));
  },

  onName(e) { this.setData({ 'form.contactName': e.detail.value }); },
  onPhone(e) { this.setData({ 'form.contactPhone': e.detail.value }); },
  onAddr(e) { this.setData({ 'form.address': e.detail.value }); },
  onRemark(e) { this.setData({ 'form.remark': e.detail.value }); },

  submit() {
    if (this.data.submitting) return;
    if (!this.data.lines.length) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }
    const f = this.data.form || {};
    if (!String(f.contactName || '').trim() || !String(f.contactPhone || '').trim()) {
      wx.showToast({ title: '请填写联系人和手机号', icon: 'none' });
      return;
    }
    if (!String(f.address || '').trim()) {
      wx.showToast({ title: '请填写地址', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    app.request({
      url: '/goods-orders/checkout',
      method: 'POST',
      data: {
        contactName: f.contactName,
        contactPhone: f.contactPhone,
        address: f.address,
        remark: f.remark,
      },
    })
      .then(() => {
        wx.showToast({ title: '下单成功', icon: 'success' });
        wx.redirectTo({ url: '/pages/goods-orders/goods-orders' });
      })
      .catch((err) => wx.showToast({ title: (err && err.message) || '下单失败', icon: 'none' }))
      .finally(() => this.setData({ submitting: false }));
  },
});

