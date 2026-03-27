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
          manualPdfUrl: (g.manualPdfUrl && String(g.manualPdfUrl).trim()) || '',
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
  },

  onOpenManualWeb() {
    let url = (this.data.manualPdfUrl && String(this.data.manualPdfUrl).trim()) || '';
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const base = (app.globalData.baseUrl || '').replace(/\/api\/?$/, '') || '';
      url = base + (url.startsWith('/') ? url : '/' + url);
    }
    my.navigateTo({
      url: '/pages/webview/webview?url=' + encodeURIComponent(url),
    });
  },
});
