const app = getApp();
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
    categoryPages: [],
    activeCategoryIndex: 0,
    selectedCategoryId: null,
    deviceGuides: [],
    categoryBannerUrl: '',
    loading: false,
    cartText: '',
    cartCount: 0,
    dragOffset: 0,
    trackStyle: 'transform: translate3d(0%, 0, 0); transition: transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1);',
  },

  categoryGuidesMap: {},
  categoryLoadingMap: {},
  cartLines: [],

  onShow() {
    i18n.applyTabBarLabels();
    const refresh = () => {
      i18n.setNavTitle('products.title');
      this.setData({ cartText: i18n.t('购物车', 'Cart') });
      if (this.data.categories.length) this.refreshLocalizedNames();
      else this.loadCategories();
    };
    if (i18n.isLoaded()) refresh(); else i18n.loadI18nTexts(refresh);
    this.loadCart();
  },

  loadCategories() {
    app.request({ url: '/guides/categories' })
      .then(res => {
        const categories = (res.data || []).map(c => ({ ...c, displayName: pick(c, 'name') }));
        this.categoryGuidesMap = {};
        this.categoryLoadingMap = {};
        this.setData({ categories });
        if (categories.length) {
          this.selectCategoryByCat(categories[0]);
          categories.slice(1).forEach(cat => this.loadGuidesForCategory(cat));
        }
      })
      .catch(() => {});
  },

  refreshLocalizedNames() {
    const categories = (this.data.categories || []).map(c => ({ ...c, displayName: pick(c, 'name') }));
    this.setData({ categories }, () => this.rebuildCategoryPages());
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.selectedCategoryId) return;
    const cat = this.data.categories.find(c => c.id === id);
    if (cat) this.selectCategoryByCat(cat);
  },

  _touchStartX: 0,
  _touchStartY: 0,
  _dragOffset: 0,
  _dragging: false,
  onContentTouchStart(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    this._touchStartX = t.clientX;
    this._touchStartY = t.clientY;
    this._dragOffset = 0;
    this._dragging = true;
    this.updateTrackStyle(0, false);
  },
  onContentTouchMove(e) {
    if (!this._dragging) return;
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    const dx = t.clientX - this._touchStartX;
    const dy = t.clientY - this._touchStartY;
    if (Math.abs(dy) > Math.abs(dx)) return;
    const idx = this.data.activeCategoryIndex || 0;
    const cats = this.data.categories || [];
    const isBoundarySwipe = (idx === 0 && dx > 0) || (idx >= cats.length - 1 && dx < 0);
    if (isBoundarySwipe) {
      this._dragOffset = 0;
      this.updateTrackStyle(0, false);
      return;
    }
    const maxLeft = 120;
    const maxRight = 120;
    this._dragOffset = Math.max(-maxRight, Math.min(maxLeft, dx));
    this.updateTrackStyle(this._dragOffset, false);
  },
  onContentTouchEnd(e) {
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    this._dragging = false;
    this._dragOffset = 0;
    this.updateTrackStyle(0, true);
    if (!t) return;
    const dx = t.clientX - this._touchStartX;
    const dy = t.clientY - this._touchStartY;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dy) > 30) return;
    const cats = this.data.categories || [];
    if (!cats.length) return;
    const idx = cats.findIndex(c => c.id === this.data.selectedCategoryId);
    if (idx < 0) return;
    const target = dx < 0 ? cats[idx + 1] : cats[idx - 1];
    if (target) this.selectCategoryByCat(target);
  },

  updateTrackStyle(offset, transition) {
    const percent = -((this.data.activeCategoryIndex || 0) * 100);
    const timing = transition ? 'transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none';
    this.setData({
      dragOffset: offset,
      trackStyle: `transform: translate3d(${percent}%, 0, 0) translateX(${offset}px); transition: ${timing};`,
    });
  },

  selectCategoryByCat(cat) {
    const activeCategoryIndex = Math.max(0, (this.data.categories || []).findIndex(c => c.id === cat.id));
    this.setData({
      selectedCategoryId: cat.id,
      activeCategoryIndex,
    }, () => {
      this.updateTrackStyle(0, true);
      this.rebuildCategoryPages();
    });
    this.loadGuidesForCategory(cat);
  },

  normalizeGuide(g) {
    const rawIcon = pick(g, 'iconUrl') || '';
    const rawCover = pick(g, 'coverImage') || '';
    const listPrice = Number(g && g.listPrice) || 0;
    const originPrice = (g && g.originPrice != null) ? Number(g.originPrice) : 0;
    const sym = (g && g.currency && String(g.currency).trim()) ? String(g.currency).trim() : app.globalData.currencySymbol;
    return {
      id: g.id,
      name: g.name,
      nameEn: g.nameEn,
      displayName: pick(g, 'name'),
      displaySubtitle: pick(g, 'subtitle'),
      displayDescription: pick(g, 'description'),
      slug: g.slug || '',
      displayImageUrl: resolveMediaUrl(rawCover || rawIcon),
      listPrice,
      originPrice: (g && g.originPrice != null) ? originPrice : null,
      displayListPrice: currencyUtil.formatPriceDisplay(listPrice, sym),
      displayOriginPrice: currencyUtil.formatPriceDisplay(originPrice, sym),
    };
  },

  loadGuidesForCategory(cat) {
    if (!cat || this.categoryGuidesMap[cat.id] || this.categoryLoadingMap[cat.id]) return;
    this.categoryLoadingMap[cat.id] = true;
    this.rebuildCategoryPages();
    app.request({ url: '/guides', data: { categoryId: cat.id } })
      .then(res => {
        this.categoryGuidesMap[cat.id] = (res.data || []).map(g => this.normalizeGuide(g));
        this.categoryLoadingMap[cat.id] = false;
        this.rebuildCategoryPages();
      })
      .catch(() => {
        this.categoryGuidesMap[cat.id] = [];
        this.categoryLoadingMap[cat.id] = false;
        this.rebuildCategoryPages();
      });
  },

  buildCategoryPage(cat) {
    const guides = this.categoryGuidesMap[cat.id] || [];
    const tu = pick(cat, 'thumbnailUrl');
    return {
      id: cat.id,
      displayName: cat.displayName || pick(cat, 'name'),
      bannerUrl: tu ? resolveMediaUrl(tu) : '',
      guides,
      loading: !!this.categoryLoadingMap[cat.id],
    };
  },

  rebuildCategoryPages() {
    const categoryPages = (this.data.categories || []).map(cat => this.buildCategoryPage(cat));
    const current = categoryPages.find(page => page.id === this.data.selectedCategoryId);
    this.setData({
      categoryPages,
      categoryBannerUrl: current ? current.bannerUrl : '',
      deviceGuides: current ? current.guides : [],
      loading: current ? current.loading : false,
    });
  },

  selectProduct(e) {
    const slug = e.currentTarget.dataset.slug || '';
    const id = e.currentTarget.dataset.id;
    const param = slug || id;
    if (param == null || param === '') return;
    my.navigateTo({ url: `/pages/guide-detail/guide-detail?id=${encodeURIComponent(String(param))}` });
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

  goCart() {
    if (!app.checkLogin()) return;
    my.navigateTo({ url: '/pages/cart/cart' });
  },

  addToCart(e) {
    const id = Number(e.currentTarget.dataset.id) || 0;
    if (!id) return;
    if (!app.checkLogin()) return;
    const allGuides = Object.keys(this.categoryGuidesMap).reduce((list, key) => list.concat(this.categoryGuidesMap[key] || []), []);
    const g = allGuides.find(x => Number(x.id) === id);
    if (!g || !(Number(g.listPrice) > 0)) {
      my.showToast({ content: '该商品暂未配置价格', type: 'none' });
      return;
    }
    const cur = (this.cartLines || []).map(x => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
    const idx = cur.findIndex(x => Number(x.guideId) === id);
    if (idx >= 0) cur[idx].qty += 1;
    else cur.push({ guideId: id, qty: 1 });
    app.request({ url: '/cart', method: 'PUT', data: { items: cur } })
      .then((res) => {
        const items = (res.data && res.data.items) ? res.data.items : [];
        this.cartLines = items;
        const count = items.reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
        this.setData({ cartCount: count });
        my.showToast({ content: '已加入购物车', type: 'success' });
      })
      .catch((err) => my.showToast({ content: (err && err.message) || '加入失败', type: 'none' }));
  },
});
