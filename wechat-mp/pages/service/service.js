const app = getApp();
const i18n = require('../../utils/i18n.js');
const { formatPriceDisplay } = require('../../utils/currency.js');

Page({
  data: {
    categories: [],
    loading: true,
    loadingText: '',
  },

  onShow() {
    i18n.syncCustomTabBar(this, 2);
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      self.loadServices();
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  refreshI18n() {
    i18n.setNavTitle('service.title');
    this.setData({ loadingText: i18n.t('common.loading') });
  },

  loadServices() {
    this.setData({ loading: true });
    app.request({ url: '/services' })
      .then(res => {
        const services = (res.data && res.data.list) || res.data || [];
        if (services.length) {
          const catMap = {};
          const catOrder = [];
          services.forEach(s => {
            const cat = s.serviceCategory || s.category || {};
            const catKey = cat.key || cat.id || 'other';
            const catName = i18n.pick(cat, 'name') || (typeof s.category === 'string' ? s.category : i18n.t('country.other'));
            if (!catMap[catKey]) {
              catMap[catKey] = { key: String(catKey), name: catName, items: [] };
              catOrder.push(catKey);
            }
            const isEn = i18n.isEn();
            const priceRaw = isEn && s.priceEn != null && s.priceEn !== ''
              ? s.priceEn
              : s.price;
            const currencySym = isEn
              ? (String(s.currencyEn || '').trim() || app.globalData.currencySymbol || '¥')
              : (app.globalData.currencySymbol || '¥');
            const priceNum = Number(priceRaw);
            catMap[catKey].items.push({
              id: s.id,
              title: i18n.pick(s, 'title') || i18n.t('tabbar.services'),
              description: i18n.pick(s, 'description'),
              icon: s.icon || 'setting-o',
              iconUrl: s.iconUrl || '',
              emoji: '🔧',
              priceDisplay: formatPriceDisplay(Number.isFinite(priceNum) ? priceNum : priceRaw, currencySym),
            });
          });
          const cats = catOrder.map(k => catMap[k]);
          this.setData({ categories: cats, loading: false });
        } else {
          this.setData({ categories: this.getFallbackCategories(), loading: false });
        }
      })
      .catch(() => {
        this.setData({ categories: this.getFallbackCategories(), loading: false });
      });
  },

  getFallbackCategories() {
    return [
      { key: 'repair', name: i18n.t('services.catRepair'), items: [
        { id: 1, title: i18n.t('services.deviceRepair'), emoji: '🔧', icon: '', iconUrl: '' },
        { id: 2, title: i18n.t('services.onsiteRepair'), emoji: '🏠', icon: '', iconUrl: '' },
        { id: 3, title: i18n.t('services.remoteSupport'), emoji: '📞', icon: '', iconUrl: '' },
      ]},
      { key: 'clean', name: i18n.t('services.catClean'), items: [
        { id: 4, title: i18n.t('services.deepClean'), emoji: '✨', icon: '', iconUrl: '' },
        { id: 5, title: i18n.t('services.dailyClean'), emoji: '🧹', icon: '', iconUrl: '' },
      ]},
      { key: 'inspect', name: i18n.t('services.catInspect'), items: [
        { id: 6, title: i18n.t('services.fullInspection'), emoji: '🔍', icon: '', iconUrl: '' },
        { id: 7, title: i18n.t('services.performanceOpt'), emoji: '🚀', icon: '', iconUrl: '' },
      ]},
      { key: 'data', name: i18n.t('services.catData'), items: [
        { id: 8, title: i18n.t('services.dataRecovery'), emoji: '💾', icon: '', iconUrl: '' },
        { id: 9, title: i18n.t('services.dataBackup'), emoji: '📁', icon: '', iconUrl: '' },
      ]},
    ];
  },

  goServiceDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/service-detail/service-detail?id=' + id });
  },
});
