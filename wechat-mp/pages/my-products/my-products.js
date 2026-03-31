const app = getApp();
const i18n = require('../../utils/i18n.js');

function formatTime(t) {
  if (!t) return '-';
  const d = new Date(t);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

Page({
  data: {
    list: [],
    loading: true,
    i18n: {},
  },

  onShow() {
    this.refreshI18n();
    this.loadList();
  },

  refreshI18n() {
    this.setData({
      i18n: {
        addBtn: i18n.t('myProducts.addBtn'),
        empty: i18n.t('myProducts.empty'),
        category: i18n.t('myProducts.category'),
        name: i18n.t('myProducts.name'),
        serial: i18n.t('myProducts.serial'),
        boundAt: i18n.t('myProducts.boundAt'),
      },
    });
  },

  loadList() {
    if (!app.isLoggedIn()) {
      this.setData({ list: [], loading: false });
      return;
    }
    this.setData({ loading: true });
    app.request({ url: '/auth/my-products' })
      .then(res => {
        const list = (res.data || []).map(item => ({
          ...item,
          boundAtStr: formatTime(item.boundAt),
        }));
        this.setData({ list, loading: false });
      })
      .catch(() => this.setData({ list: [], loading: false }));
  },

  addProduct() {
    const app = getApp();
    if (!app.isLoggedIn()) {
      wx.showModal({
        title: i18n.t('myProducts.notLoggedIn'),
        content: i18n.t('myProducts.loginFirst'),
        confirmText: i18n.t('myProducts.goLogin'),
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/login' });
        },
      });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        wx.showLoading({ title: i18n.t('myProducts.recognizing') });
        wx.uploadFile({
          url: app.globalData.baseUrl + '/auth/bind-by-qr-image',
          filePath: file.tempFilePath,
          name: 'image',
          header: { Authorization: 'Bearer ' + (app.globalData.token || wx.getStorageSync('vino_token') || '') },
          success: (uploadRes) => {
            try {
              const data = JSON.parse(uploadRes.data);
              if (data.code === 0 && data.data) {
                wx.showToast({ title: i18n.t('myProducts.bindSuccess'), icon: 'success' });
                this.loadList();
                if (data.data.guideSlug) {
                  setTimeout(() => {
                    wx.navigateTo({ url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(data.data.guideSlug) });
                  }, 800);
                }
              } else {
                wx.showToast({ title: data.message || i18n.t('myProducts.bindFailed'), icon: 'none' });
              }
            } catch {
              wx.showToast({ title: i18n.t('myProducts.bindFailed'), icon: 'none' });
            }
          },
          fail: () => wx.showToast({ title: i18n.t('myProducts.uploadFailed'), icon: 'none' }),
          complete: () => wx.hideLoading(),
        });
      },
    });
  },
});
