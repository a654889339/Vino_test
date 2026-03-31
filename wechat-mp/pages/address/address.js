const app = getApp();
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    addresses: [],
    loading: false,
    emptyText: i18n.t('addressList.empty'),
    defaultTag: i18n.t('addressList.default'),
    setDefaultText: i18n.t('addressList.setDefault'),
    deleteText: i18n.t('addressList.delete'),
    addText: i18n.t('addressList.add'),
    confirmDeleteTitle: i18n.t('addressList.confirmDeleteTitle'),
    confirmDeleteContent: i18n.t('addressList.confirmDeleteContent'),
  },

  onShow() {
    this.loadAddresses();
  },

  loadAddresses() {
    this.setData({ loading: true });
    app.request({ url: '/addresses' })
      .then(res => {
          const list = (res.data || []).map(a => ({
          ...a,
          fullAddress: [a.country === i18n.t('country.other') ? a.customCountry : a.country, a.province, a.city, a.district, a.detailAddress].filter(Boolean).join(' '),
        }));
        this.setData({ addresses: list, loading: false });
      })
      .catch(() => this.setData({ loading: false }));
  },

  addAddr() {
    wx.navigateTo({ url: '/pages/address-edit/address-edit' });
  },

  editAddr(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/address-edit/address-edit?id=' + id });
  },

  setDefault(e) {
    const id = e.currentTarget.dataset.id;
    app.request({ url: '/addresses/' + id + '/default', method: 'PUT' })
      .then(() => this.loadAddresses())
      .catch(() => wx.showToast({ title: i18n.t('common.operationFailed'), icon: 'none' }));
  },

  deleteAddr(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: i18n.t('addressList.confirmDeleteTitle'),
      content: i18n.t('addressList.confirmDeleteContent'),
      success: res => {
        if (res.confirm) {
          app.request({ url: '/addresses/' + id, method: 'DELETE' })
            .then(() => this.loadAddresses())
            .catch(() => wx.showToast({ title: i18n.t('addressList.deleteFailed'), icon: 'none' }));
        }
      },
    });
  },
});
