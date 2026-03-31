const app = getApp();
const { openManual } = require('../../utils/openManual.js');
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    loading: true,
    guideName: '',
    helpItems: [],
    manualPdfUrl: '',
    loadingText: i18n.t('common.loading'),
    manualSuffix: i18n.t('manual.suffix'),
    chapterCountPrefix: i18n.t('manual.chapterCountPrefix'),
    chapterCountSuffix: i18n.t('manual.chapterCountSuffix'),
    tocTitle: i18n.t('manual.toc'),
    viewManualText: i18n.t('manual.viewManual'),
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

  /** PDF：downloadFile + openDocument（小程序内预览）；网页：webview */
  onOpenManual() {
    openManual(this.data.manualPdfUrl, app);
  },
});
