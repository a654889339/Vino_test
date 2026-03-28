const app = getApp();
const { sortGuidesByDisplayOrder, sortCategoriesForSidebar } = require('../../utils/productGuideOrder.js');

Page({
  data: {
    categories: [],
    selectedCategoryId: null,
    deviceGuides: [],
    listLoading: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    if (!this.data.categories.length) this.loadCategories();
  },

  loadCategories() {
    app.request({ url: '/guides/categories' })
      .then(res => {
        const categories = sortCategoriesForSidebar(res.data || []);
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

  selectCategoryByCat(cat) {
    this.setData({
      selectedCategoryId: cat.id,
      deviceGuides: [],
      listLoading: true,
    });
    app.request({ url: '/guides', data: { categoryId: cat.id } })
      .then(res => {
        const base = app.globalData.baseUrl.replace('/api', '');
        const raw = res.data || [];
        const sorted = sortGuidesByDisplayOrder(raw, cat.name);
        const list = sorted.map(g => ({
          id: g.id,
          name: g.name,
          slug: g.slug || '',
          icon: g.icon || '',
          iconUrl: g.iconUrl
            ? (g.iconUrl.startsWith('http') ? g.iconUrl : base + g.iconUrl)
            : '',
          iconUrlThumb: g.iconUrlThumb
            ? (g.iconUrlThumb.startsWith('http') ? g.iconUrlThumb : base + g.iconUrlThumb)
            : '',
        }));
        this.setData({ deviceGuides: list, listLoading: false });
      })
      .catch(() => this.setData({ listLoading: false }));
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
