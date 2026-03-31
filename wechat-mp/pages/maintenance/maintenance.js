const app = getApp();
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    loading: true,
    guideName: '',
    sections: [],
    loadingText: i18n.t('common.loading'),
    maintenanceSuffix: i18n.t('maintenance.suffix'),
    sectionCountPrefix: i18n.t('maintenance.sectionCountPrefix'),
    sectionCountSuffix: i18n.t('maintenance.sectionCountSuffix'),
    tocTitle: i18n.t('maintenance.toc'),
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
          sections: parse(g.sections),
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
  },
});
