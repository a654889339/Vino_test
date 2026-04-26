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
  },

  onLoad(options) {
    const setTitle = () => i18n.setNavTitle('manual.title');
    if (i18n.isLoaded()) setTitle(); else i18n.loadI18nTexts(setTitle);
    if (options.id) this.loadGuide(options.id);
    else this.setData({ loading: false });
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

  onOpenManual() {
    openManual(this.data.manualPdfUrl, app);
  },
});
