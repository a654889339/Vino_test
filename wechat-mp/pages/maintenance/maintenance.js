const app = getApp();
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    loading: true,
    guideName: '',
    sections: [],
    loadingText: '',
    maintenanceSuffix: '',
    sectionCountPrefix: '',
    sectionCountSuffix: '',
    tocTitle: '',
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
    i18n.setNavTitle('maintenance.title');
    this.setData({
      loadingText: i18n.t('common.loading'),
      maintenanceSuffix: i18n.t('maintenance.suffix'),
      sectionCountPrefix: i18n.t('maintenance.sectionCountPrefix'),
      sectionCountSuffix: i18n.t('maintenance.sectionCountSuffix'),
      tocTitle: i18n.t('maintenance.toc'),
    });
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
