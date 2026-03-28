const app = getApp();
const { openManualFromGuide } = require('../../utils/openManual.js');
const { sortGuidesByDisplayOrder, sortCategoriesForSidebar } = require('../../utils/productGuideOrder.js');

Page({
  data: {
    categories: [],
    selectedCategoryId: null,
    deviceGuides: [],
    activeId: null,
    guide: {},
    sections: [],
    mediaItems: [],
    helpItems: [],
    firstMediaTitle: '',
    listLoading: false,
    detailLoading: false,
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
      activeId: null,
      guide: {},
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
        if (list.length) {
          this.loadDetail(list[0].slug || list[0].id, list[0].id);
        } else {
          this.setData({ detailLoading: false });
        }
      })
      .catch(() => this.setData({ listLoading: false }));
  },

  selectProduct(e) {
    const id = e.currentTarget.dataset.id;
    const slug = e.currentTarget.dataset.slug || '';
    if (id === this.data.activeId) return;
    this.loadDetail(slug || id, id);
  },

  loadDetail(param, id) {
    this.setData({ activeId: id, detailLoading: true });
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
          firstMediaTitle: mediaItems.length ? (mediaItems[0].title || g.name) : g.name,
          detailLoading: false,
        });
      })
      .catch(() => this.setData({ detailLoading: false }));
  },

  previewCover() {
    const url = this.data.guide.coverImage;
    if (url) wx.previewImage({ current: url, urls: [url] });
  },

  playShowcase() {
    const url = this.data.guide.showcaseVideo;
    if (url) wx.previewMedia({ sources: [{ url, type: 'video' }] });
  },

  openMedia(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    const mediaUrl = item.url || item.thumb;
    if (!mediaUrl) return;
    if (item.type === 'video') {
      wx.previewMedia({ sources: [{ url: mediaUrl, type: 'video' }] });
    } else {
      const images = this.data.mediaItems.filter(m => m.type !== 'video').map(m => m.url || m.thumb).filter(Boolean);
      wx.previewImage({ current: mediaUrl, urls: images.length ? images : [mediaUrl] });
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
      wx.showToast({ title: '暂无说明书', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/manual/manual?id=${g.id}` });
  },

  goMaintenance() {
    const id = this.data.guide.id;
    wx.navigateTo({ url: `/pages/maintenance/maintenance?id=${id}` });
  },

  goServices() {
    wx.switchTab({ url: '/pages/service/service' });
  },
});
