const app = getApp();
const { sortGuidesByDisplayOrder, sortCategoriesForSidebar } = require('../../utils/productGuideOrder.js');
const i18n = require('../../utils/i18n.js');
const { pick } = i18n;

function resolveMediaUrl(u) {
  if (!u || !String(u).trim()) return '';
  const s = String(u).trim();
  if (s.startsWith('http')) return s;
  return app.globalData.baseUrl.replace('/api', '') + s;
}

Page({
  data: {
    categories: [],
    selectedCategoryId: null,
    deviceGuides: [],
    filteredDeviceGuides: [],
    searchKeyword: '',
    categoryBannerUrl: '',
    listLoading: false,
    searchPlaceholder: '',
    loadingText: '',
    noMatchText: '',
    noCategoryProductText: '',
    noConfigText: '',
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      if (!self.data.categories.length) self.loadCategories();
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  refreshI18n() {
    this.setData({
      searchPlaceholder: i18n.t('products.searchPlaceholder'),
      loadingText: i18n.t('common.loading'),
      noMatchText: i18n.t('products.noMatch'),
      noCategoryProductText: i18n.t('products.noCategoryProduct'),
      noConfigText: i18n.t('products.noConfig'),
    });
  },

  loadCategories() {
    app.request({ url: '/guides/categories' })
      .then(res => {
        const categories = sortCategoriesForSidebar(res.data || []).map(c => ({ ...c, name: pick(c, 'name') }));
        this.setData({ categories });
        if (categories.length) {
          this.selectCategoryByCat(categories[0]);
        }
      })
      .catch(() => {});
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.selectedCategoryId) return;
    const cat = this.data.categories.find(c => c.id === id);
    if (cat) this.selectCategoryByCat(cat);
  },

  updateCategoryBanner() {
    const id = this.data.selectedCategoryId;
    const cats = this.data.categories || [];
    const cat = cats.find(c => c.id === id);
    let url = '';
    if (cat) {
      const tu = pick(cat, 'thumbnailUrl');
      if (tu) url = resolveMediaUrl(tu);
    }
    this.setData({ categoryBannerUrl: url });
  },

  applyFilter() {
    const list = this.data.deviceGuides || [];
    const kw = (this.data.searchKeyword || '').trim().toLowerCase();
    if (!kw) {
      this.setData({ filteredDeviceGuides: list });
      return;
    }
    const filtered = list.filter(g => (g.name || '').toLowerCase().indexOf(kw) !== -1);
    this.setData({ filteredDeviceGuides: filtered });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
    this.applyFilter();
  },

  selectCategoryByCat(cat) {
    this.setData({
      selectedCategoryId: cat.id,
      deviceGuides: [],
      filteredDeviceGuides: [],
      searchKeyword: '',
      listLoading: true,
    });
    this.updateCategoryBanner();
    app.request({ url: '/guides', data: { categoryId: cat.id } })
      .then(res => {
        const base = app.globalData.baseUrl.replace('/api', '');
        const raw = res.data || [];
        const sorted = sortGuidesByDisplayOrder(raw, cat.name);
        const list = sorted.map(g => {
          const rawIcon = pick(g, 'iconUrl') || '';
          const rawThumb = pick(g, 'iconUrlThumb') || '';
          const iconUrl = rawIcon ? (rawIcon.startsWith('http') ? rawIcon : base + rawIcon) : '';
          const iconUrlThumb = rawThumb ? (rawThumb.startsWith('http') ? rawThumb : base + rawThumb) : '';
          return {
            id: g.id,
            name: pick(g, 'name'),
            slug: g.slug || '',
            icon: g.icon || '',
            iconUrl,
            iconUrlThumb,
            displayIconUrl: (iconUrlThumb || iconUrl || '').trim(),
          };
        });
        this.setData({ deviceGuides: list, listLoading: false }, () => {
          this.applyFilter();
        });
      })
      .catch(() => this.setData({ listLoading: false }));
  },

  /** 缩略图加载失败（如 COS 无 thumb 对象）时回退原图 */
  onGridIconError(e) {
    const id = e.currentTarget.dataset.id;
    const deviceGuides = (this.data.deviceGuides || []).map((g) => {
      if (g.id !== id || !g.iconUrl) return g;
      if (g.displayIconUrl === g.iconUrl) return g;
      return { ...g, displayIconUrl: g.iconUrl };
    });
    this.setData({ deviceGuides }, () => this.applyFilter());
  },

  selectProduct(e) {
    const slug = e.currentTarget.dataset.slug || '';
    const id = e.currentTarget.dataset.id;
    const param = slug || id;
    if (param == null || param === '') return;
    wx.navigateTo({
      url: `/pages/guide-detail/guide-detail?id=${encodeURIComponent(String(param))}`,
    });
  },
});
