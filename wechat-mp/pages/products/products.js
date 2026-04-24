const app = getApp();
const { sortGuidesByDisplayOrder, sortCategoriesForSidebar } = require('../../utils/productGuideOrder.js');
const i18n = require('../../utils/i18n.js');
const { pick } = i18n;
const currencyUtil = require('../../utils/currency.js');

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
    cartCount: 0,
  },

  onShow() {
    i18n.syncCustomTabBar(this, 1);
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      if (self.data.categories.length) self.refreshLocalizedNames();
      else self.loadCategories();
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
    this.loadCart();
  },

  refreshI18n() {
    i18n.setNavTitle('products.title');
    this.setData({
      searchPlaceholder: i18n.t('products.searchPlaceholder'),
      loadingText: i18n.t('common.loading'),
      noMatchText: i18n.t('products.noMatch'),
      noCategoryProductText: i18n.t('products.noCategoryProduct'),
      noConfigText: i18n.t('products.noConfig'),
    });
  },

  /** 语言切换后按当前语言重算分类/机型名（不重复请求接口） */
  refreshLocalizedNames() {
    const categories = (this.data.categories || []).map((c) => ({
      ...c,
      displayName: pick(c, 'name'),
    }));
    const deviceGuides = (this.data.deviceGuides || []).map((g) => ({
      ...g,
      displayName: pick(g, 'name'),
    }));
    this.setData({ categories, deviceGuides }, () => this.applyFilter());
  },

  loadCategories() {
    app.request({ url: '/guides/categories' })
      .then(res => {
        const categories = sortCategoriesForSidebar(res.data || []).map((c) => ({
          ...c,
          displayName: pick(c, 'name'),
        }));
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
    const filtered = list.filter((g) => {
      const hay = [g.displayName, g.name, g.nameEn].filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(kw) !== -1;
    });
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
        const list = sorted.map((g) => {
          const rawIcon = pick(g, 'iconUrl') || '';
          const rawCover = pick(g, 'coverImage') || '';
          const iconUrl = rawIcon ? (rawIcon.startsWith('http') ? rawIcon : base + rawIcon) : '';
          const coverUrl = rawCover ? (rawCover.startsWith('http') ? rawCover : base + rawCover) : '';
          const img = (coverUrl || iconUrl || '').trim();
          const sym = (g && g.currency && String(g.currency).trim()) ? String(g.currency).trim() : app.globalData.currencySymbol;
          const listPrice = Number(g && g.listPrice) || 0;
          const originPrice = (g && g.originPrice != null) ? Number(g.originPrice) : 0;
          return {
            id: g.id,
            name: g.name,
            nameEn: g.nameEn,
            displayName: pick(g, 'name'),
            displaySubtitle: pick(g, 'subtitle'),
            displayDescription: pick(g, 'description'),
            slug: g.slug || '',
            icon: g.icon || '',
            iconUrl,
            coverImage: coverUrl,
            displayImageUrl: img,
            listPrice,
            originPrice: (g && g.originPrice != null) ? originPrice : null,
            currencySymbol: sym,
            displayListPrice: currencyUtil.formatPriceDisplay(listPrice, sym),
            displayOriginPrice: currencyUtil.formatPriceDisplay(originPrice, sym),
          };
        });
        this.setData({ deviceGuides: list, listLoading: false }, () => {
          this.applyFilter();
        });
      })
      .catch(() => this.setData({ listLoading: false }));
  },

  loadCart() {
    if (!app.isLoggedIn()) {
      this.cartLines = [];
      this.setData({ cartCount: 0 });
      return;
    }
    app.request({ url: '/cart' })
      .then((res) => {
        const items = (res.data && res.data.items) ? res.data.items : [];
        this.cartLines = items;
        const count = items.reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
        this.setData({ cartCount: count });
      })
      .catch(() => { this.cartLines = []; this.setData({ cartCount: 0 }); });
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

  goCart() {
    if (!app.checkLogin()) return;
    wx.navigateTo({ url: '/pages/cart/cart' });
  },

  addToCart(e) {
    const id = Number(e.currentTarget.dataset.id) || 0;
    if (!id) return;
    if (!app.checkLogin()) return;
    const g = (this.data.deviceGuides || []).find((x) => Number(x.id) === id);
    if (!g || !(Number(g.listPrice) > 0)) {
      wx.showToast({ title: '该商品暂未配置价格', icon: 'none' });
      return;
    }
    const cur = (this.cartLines || []).map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
    const idx = cur.findIndex((x) => Number(x.guideId) === id);
    if (idx >= 0) cur[idx].qty += 1;
    else cur.push({ guideId: id, qty: 1 });
    app.request({ url: '/cart', method: 'PUT', data: { items: cur } })
      .then((res) => {
        const items = (res.data && res.data.items) ? res.data.items : [];
        this.cartLines = items;
        const count = items.reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
        this.setData({ cartCount: count });
        wx.showToast({ title: '已加入购物车', icon: 'success' });
      })
      .catch((err) => wx.showToast({ title: (err && err.message) || '加入失败', icon: 'none' }));
  },
});
