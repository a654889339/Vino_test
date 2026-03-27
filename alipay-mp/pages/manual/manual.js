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
    my.showLoading({ content: '下载中...' });
    my.downloadFile({
      url,
      success: (res) => {
        my.hideLoading();
        const p = res.apFilePath || res.tempFilePath;
        if (p) {
          my.openDocument({
            filePath: p,
            fileType: 'pdf',
          });
        } else {
          my.showToast({ content: '下载失败', type: 'none' });
        }
      },
      fail: () => {
        my.hideLoading();
        my.showToast({ content: '下载失败', type: 'none' });
      },
    });
  },
});
