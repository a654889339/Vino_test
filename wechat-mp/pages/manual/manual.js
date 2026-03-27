const app = getApp();

Page({
  data: {
    loading: true,
    guideName: '',
    helpItems: [],
    manualPdfUrl: '',
  },

  onLoad(options) {
    if (options.id) this.loadGuide(options.id);
    else this.setData({ loading: false });
  },

  loadGuide(id) {
    app.request({ url: `/guides/${id}` })
      .then(res => {
        const g = res.data || {};
        const parse = v => { try { return Array.isArray(v) ? v : JSON.parse(v || '[]'); } catch { return []; } };
        this.setData({
          guideName: g.name || '',
          helpItems: parse(g.helpItems),
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
  },

  onDownloadPdf() {
    const url = this.data.manualPdfUrl;
    if (!url) return;
    wx.showLoading({ title: '下载中...' });
    wx.downloadFile({
      url,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 && res.tempFilePath) {
          wx.openDocument({
            filePath: res.tempFilePath,
            fileType: 'pdf',
            showMenu: true,
          });
        } else {
          wx.showToast({ title: '下载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载失败', icon: 'none' });
      },
    });
  },
});
