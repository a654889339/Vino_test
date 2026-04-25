const app = getApp();
const { openManualFromGuide } = require('../../utils/openManual.js');
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    categories: [],
    selectedCategoryId: null,
    deviceGuides: [],
    activeId: null,
    selectedProductLabel: '',
    productPickerIndex: 0,
    guide: {},
    sections: [],
    mediaItems: [],
    helpItems: [],
    firstMediaTitle: '',
    loading: false,
    cartCount: 0,
  },

  onShow() {
    i18n.applyTabBarLabels();
    const setTitle = () => i18n.setNavTitle('products.title');
    if (i18n.isLoaded()) setTitle(); else i18n.loadI18nTexts(setTitle);
    if (!this.data.categories.length) this.loadCategories();
    this.loadCart();
  },

  loadCategories() {
    app.request({ url: '/guides/categories' })
      .then(res => {
        const categories = res.data || [];
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

  _touchStartX: 0,
  _touchStartY: 0,
  onContentTouchStart(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    this._touchStartX = t.clientX;
    this._touchStartY = t.clientY;
  },
  onContentTouchEnd(e) {
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
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

  selectCategoryByCat(cat) {
    this.setData({ selectedCategoryId: cat.id, deviceGuides: [], activeId: null, guide: {}, loading: true });
    app.request({ url: '/guides', data: { categoryId: cat.id } })
      .then(res => {
        const list = (res.data || []).map(g => ({
          id: g.id,
          name: g.name,
          slug: g.slug || '',
        }));
        this.setData({ deviceGuides: list, loading: false });
        if (list.length) {
          this.loadDetail(list[0].slug || list[0].id, list[0].id, 0);
        }
      })
      .catch(() => this.setData({ loading: false }));
  },

  onProductPick(e) {
    const index = parseInt(e.detail.value, 10);
    const list = this.data.deviceGuides;
    const item = list[index];
    if (!item) return;
    this.loadDetail(item.slug || item.id, item.id, index);
  },

  loadDetail(param, id, pickerIndex) {
    this.setData({ activeId: id, productPickerIndex: pickerIndex !== undefined ? pickerIndex : this.data.productPickerIndex, loading: true });
    const guideName = (this.data.deviceGuides.find(g => g.id === id) || {}).name || '';
    app.request({ url: `/guides/${param}` })
      .then(res => {
        const g = res.data || {};
        const parse = v => { try { return Array.isArray(v) ? v : JSON.parse(v || '[]'); } catch { return []; } };
        if (g.coverImage && !g.coverImage.startsWith('http')) {
          g.coverImage = app.globalData.baseUrl.replace('/api', '') + g.coverImage;
        }
        const mediaItems = parse(g.mediaItems).map(m => {
          if (m.thumb && !m.thumb.startsWith('http')) m.thumb = app.globalData.baseUrl.replace('/api', '') + m.thumb;
          if (m.url && !m.url.startsWith('http')) m.url = app.globalData.baseUrl.replace('/api', '') + m.url;
          return m;
        });
        const helpItems = parse(g.helpItems);
        const sections = parse(g.sections);
        this.setData({
          guide: g,
          sections,
          mediaItems,
          helpItems,
          selectedProductLabel: guideName || g.name,
          firstMediaTitle: mediaItems.length ? (mediaItems[0].title || g.name) : g.name,
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
  },

  previewCover() {
    const url = this.data.guide.coverImage;
    if (url) my.previewImage({ current: 0, urls: [url] });
  },

  playShowcase() {
    const url = this.data.guide.showcaseVideo;
    if (url) my.alert({ title: '视频', content: url });
  },

  openMedia(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = this.data.mediaItems[idx];
    if (!item) return;
    const mediaUrl = item.url || item.thumb;
    if (!mediaUrl) return;
    if (item.type === 'video') {
      my.alert({ title: item.title, content: '视频地址: ' + mediaUrl });
    } else {
      const images = this.data.mediaItems.filter(m => m.type !== 'video').map(m => m.url || m.thumb).filter(Boolean);
      const curIdx = images.indexOf(mediaUrl);
      my.previewImage({ current: curIdx >= 0 ? curIdx : 0, urls: images.length ? images : [mediaUrl] });
    }
  },

  goManual() {
    const g = this.data.guide;
    if (!g || !g.id) return;
    if (openManualFromGuide(g, this.data.helpItems, app)) return;
    const hasContent =
      (this.data.helpItems && this.data.helpItems.length) ||
      (g.manualPdfUrl && String(g.manualPdfUrl).trim());
    if (!hasContent) {
      my.showToast({ content: '暂无说明书', type: 'none' });
      return;
    }
    my.navigateTo({ url: `/pages/manual/manual?id=${g.id}` });
  },

  goMaintenance() {
    const id = this.data.guide.id;
    my.navigateTo({ url: `/pages/maintenance/maintenance?id=${id}` });
  },

  goServices() {
    my.switchTab({ url: '/pages/service/service' });
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
});
