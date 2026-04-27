const app = getApp();
const i18n = require('../../utils/i18n.js');
const currencyUtil = require('../../utils/currency.js');
const { createWechatPayRunner } = require('../../../common/wechat-mp/pay/index.js');

function formatAddressLine(addr) {
  if (!addr) return '';
  const parts = [];
  if (addr.country === i18n.t('country.other')) {
    parts.push(addr.customCountry || i18n.t('country.other'));
  } else if (addr.country) {
    parts.push(addr.country);
  }
  if (addr.country === i18n.t('country.cn')) {
    if (addr.province) parts.push(addr.province);
    if (addr.city) parts.push(addr.city);
    if (addr.district) parts.push(addr.district);
  }
  if (addr.detailAddress) parts.push(addr.detailAddress);
  return parts.join(' ');
}

Page({
  data: {
    loading: true,
    submitting: false,
    isLoggedIn: false,
    lines: [],
    totalText: '',
    i18n: { loading: '' },
    addresses: [],
    selectedAddress: null,
    showAddressPicker: false,
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
      this.setData({ loading: false, lines: [], totalText: '', addresses: [], selectedAddress: null });
      return;
    }
    Promise.all([
      app.request({ url: '/cart' }),
      app.request({ url: '/addresses' }).catch(() => ({ data: [] })),
    ])
      .then(([cartRes, addrRes]) => {
        const d = cartRes.data || {};
        const sym = app.globalData.currencySymbol;
        const lines = (d.items || []).map((x) => ({
          ...x,
          priceText: currencyUtil.formatPriceDisplay(x.listPrice, x.currency || sym) || '未定价',
          lineTotalText: currencyUtil.formatPriceDisplay(x.lineTotal, x.currency || sym) || '—',
        }));
        const totalText = currencyUtil.formatPriceDisplay(d.totalPrice || 0, sym) || '—';
        const addresses = Array.isArray(addrRes.data) ? addrRes.data : [];
        const def = addresses.find((a) => a.isDefault);
        const selectedAddress = def || (addresses.length ? addresses[0] : null);
        const form = { ...this.data.form };
        if (selectedAddress) {
          form.contactName = selectedAddress.contactName || '';
          form.contactPhone = selectedAddress.contactPhone || '';
          form.address = formatAddressLine(selectedAddress);
        }
        this.setData({ lines, totalText, addresses, selectedAddress, form, loading: false });
      })
      .catch(() => this.setData({ lines: [], totalText: '', addresses: [], selectedAddress: null, loading: false }));
  },

  onName(e) { this.setData({ 'form.contactName': e.detail.value }); },
  onPhone(e) { this.setData({ 'form.contactPhone': e.detail.value }); },
  onAddr(e) { this.setData({ 'form.address': e.detail.value }); },
  onRemark(e) { this.setData({ 'form.remark': e.detail.value }); },

  showAddressPicker() {
    this.setData({ showAddressPicker: true });
  },

  closeAddressPicker() {
    this.setData({ showAddressPicker: false });
  },

  selectAddress(e) {
    const id = e.currentTarget.dataset.id;
    const addr = this.data.addresses.find((a) => String(a.id) === String(id));
    if (!addr) return;
    this.setData({
      selectedAddress: addr,
      'form.contactName': addr.contactName || '',
      'form.contactPhone': addr.contactPhone || '',
      'form.address': formatAddressLine(addr),
      showAddressPicker: false,
    });
  },

  goAddAddress() {
    wx.navigateTo({ url: '/pages/address-edit/address-edit' });
  },

  doWechatPay(orderId) {
    const runner = createWechatPayRunner({
      requestPrepay: (id) =>
        app.request({ url: '/goods-orders/' + id + '/pay-wechat', method: 'POST' }).then((r) => (r && r.data) || {}),
    });
    return runner.pay(orderId);
  },

  normalizeSubmitPhone(s) {
    const d = String(s || '').replace(/\D/g, '');
    if (d.length >= 11 && d[d.length - 11] === '1') return d.slice(-11);
    return d;
  },

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
    const phoneNorm = this.normalizeSubmitPhone(f.contactPhone);
    if (phoneNorm.length !== 11 || phoneNorm[0] !== '1') {
      wx.showToast({ title: '请输入正确的11位大陆手机号', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    app.request({
      url: '/goods-orders/checkout',
      method: 'POST',
      data: {
        contactName: String(f.contactName).trim(),
        contactPhone: phoneNorm,
        address: String(f.address).trim(),
        remark: String(f.remark || '').trim(),
      },
    })
      .then((res) => {
        const order = res.data;
        if (order && order.id) {
          return this.doWechatPay(order.id)
            .then(() => {
              wx.showToast({ title: '支付成功', icon: 'success' });
              wx.redirectTo({ url: '/pages/goods-orders/goods-orders' });
            })
            .catch((err) => {
              wx.showToast({ title: (err && err.message) || '支付未完成', icon: 'none' });
              wx.redirectTo({ url: '/pages/goods-order-detail/goods-order-detail?id=' + encodeURIComponent(String(order.id)) });
            });
        }
        wx.showToast({ title: '下单成功', icon: 'success' });
        wx.redirectTo({ url: '/pages/goods-orders/goods-orders' });
      })
      .catch((err) => wx.showToast({ title: (err && err.message) || '下单失败', icon: 'none' }))
      .finally(() => this.setData({ submitting: false }));
  },
});

