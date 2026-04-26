const app = getApp();
const { openManual } = require('../../utils/openManual.js');
const i18n = require('../../utils/i18n.js');
const cosMedia = require('../../utils/cosMedia.js');

Page({
  data: {
    loading: true,
    guideName: '',
    helpItems: [],
    manualPdfUrl: '',
    loadingText: '',
    manualSuffix: '',
    chapterCountPrefix: '',
    chapterCountSuffix: '',
    tocTitle: '',
    viewManualText: '',
  },

  onLoad(options) {
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      if (options.id) self.loadGuide(options.id);
      else self.setData({ loading: false });
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  refreshI18n() {
    i18n.setNavTitle('manual.title');
    this.setData({
      loadingText: i18n.t('common.loading'),
      manualSuffix: i18n.t('manual.suffix'),
      chapterCountPrefix: i18n.t('manual.chapterCountPrefix'),
      chapterCountSuffix: i18n.t('manual.chapterCountSuffix'),
      tocTitle: i18n.t('manual.toc'),
      viewManualText: i18n.t('manual.viewManual'),
    });
  },

  loadGuide(id) {
    app.request({ url: `/guides/${id}` })
      .then(res => {
        const g = res.data || {};
        const parse = v => { try { return Array.isArray(v) ? v : JSON.parse(v || '[]'); } catch { return []; } };
        const gid = Number(g.id);
        const pdf = Number.isFinite(gid) && gid > 0
          ? cosMedia.guideProductMediaUrl(gid, 'pdf', { apiBase: app.globalData.baseUrl })
          : '';
        this.setData({
          guideName: g.name || '',
          helpItems: parse(g.helpItems),
          manualPdfUrl: pdf,
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
