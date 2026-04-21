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
  },

  onShow() {
    const setTitle = () => i18n.setNavTitle('myProducts.title');
    if (i18n.isLoaded()) setTitle(); else i18n.loadI18nTexts(setTitle);
    this.loadList();
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
      my.confirm({
        title: '未登录',
        content: '请先登录后再添加商品',
        confirmButtonText: '去登录',
        success: (res) => {
          if (res.confirm) my.navigateTo({ url: '/pages/login/login' });
        },
      });
      return;
    }
    my.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = (res.apFilePaths && res.apFilePaths[0]) || res.tempFilePaths[0];
        if (!filePath) return;
        my.showLoading({ content: '识别中...' });
        my.uploadFile({
          url: app.globalData.baseUrl + '/auth/bind-by-qr-image',
          fileType: 'image',
          fileName: 'image',
          filePath,
          header: { Authorization: 'Bearer ' + (app.globalData.token || (my.getStorageSync({ key: 'vino_token' }).data || '')) },
          success: (uploadRes) => {
            try {
              const data = JSON.parse(uploadRes.data);
              if (data.code === 0 && data.data) {
                my.showToast({ content: '绑定成功', type: 'success' });
                this.loadList();
                if (data.data.guideSlug) {
                  setTimeout(() => {
                    my.navigateTo({ url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(data.data.guideSlug) });
                  }, 800);
                }
              } else {
                my.showToast({ content: data.message || '绑定失败', type: 'none' });
              }
            } catch {
              my.showToast({ content: '绑定失败', type: 'none' });
            }
          },
          fail: () => my.showToast({ content: '上传失败', type: 'none' }),
          complete: () => my.hideLoading(),
        });
      },
    });
  },
});
