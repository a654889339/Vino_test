const app = getApp();

Page({
  data: {
    deviceGuides: [],
    activeId: null,
    guide: {},
    sections: [],
    mediaItems: [],
    helpItems: [],
    firstMediaTitle: '',
    loading: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    if (!this.data.deviceGuides.length) this.loadGuides();
  },

  loadGuides() {
    app.request({ url: '/guides' })
      .then(res => {
        const list = (res.data || []).map(g => ({
          id: g.id, name: g.name, slug: g.slug || '', model: g.subtitle || '',
          emoji: g.emoji || '', gradient: g.gradient || '', badge: g.badge || '',
          iconUrl: g.iconUrl || '',
        }));
        this.setData({ deviceGuides: list });
        if (list.length) this.loadDetail(list[0].slug || list[0].id, list[0].id);
      })
      .catch(() => {});
  },

  selectDevice(e) {
    const id = parseInt(e.currentTarget.dataset.id, 10);
    const slug = e.currentTarget.dataset.slug;
    if (id === this.data.activeId) return;
    this.loadDetail(slug || id, id);
  },

  loadDetail(param, id) {
    this.setData({ activeId: id, loading: true });
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
          guide: g, sections, mediaItems, helpItems,
          firstMediaTitle: mediaItems.length ? (mediaItems[0].title || g.name) : g.name,
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
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
    const id = this.data.guide.id;
    wx.navigateTo({ url: `/pages/manual/manual?id=${id}` });
  },

  goMaintenance() {
    const id = this.data.guide.id;
    wx.navigateTo({ url: `/pages/maintenance/maintenance?id=${id}` });
  },

  goServices() {
    wx.switchTab({ url: '/pages/service/service' });
  },
});
