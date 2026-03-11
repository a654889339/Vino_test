const app = getApp();

Page({
  data: {
    loading: true,
    guide: {},
    tags: [],
    sections: [],
    mediaItems: [],
    helpItems: [],
  },

  onLoad(options) {
    if (options.id) this.loadGuide(options.id);
    else this.setData({ loading: false });
  },

  loadGuide(id) {
    app.request({ url: `/guides/${id}` })
      .then(res => {
        const g = res.data || {};
        wx.setNavigationBarTitle({ title: g.name || '设备指南' });
        const parse = v => { try { return Array.isArray(v) ? v : JSON.parse(v || '[]'); } catch { return []; } };
        if (g.coverImage && !g.coverImage.startsWith('http')) {
          g.coverImage = app.globalData.baseUrl.replace('/api', '') + g.coverImage;
        }
        const mediaItems = parse(g.mediaItems).map(m => {
          if (m.thumb && !m.thumb.startsWith('http')) m.thumb = app.globalData.baseUrl.replace('/api', '') + m.thumb;
          return m;
        });
        this.setData({
          guide: g,
          tags: parse(g.tags),
          sections: parse(g.sections),
          mediaItems,
          helpItems: parse(g.helpItems),
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
  },

  playShowcase() {
    const url = this.data.guide.showcaseVideo;
    if (url) wx.previewMedia({ sources: [{ url, type: 'video' }] });
  },

  openMedia(e) {
    const item = e.currentTarget.dataset.item;
    if (item.type === 'video' && item.url) {
      wx.previewMedia({ sources: [{ url: item.url, type: 'video' }] });
    } else if (item.url) {
      wx.previewImage({ current: item.url, urls: [item.url] });
    }
  },

  openHelp(e) {
    const item = e.currentTarget.dataset.item;
    if (item.content) {
      wx.showModal({ title: item.title, content: item.content, showCancel: false });
    }
  },

  goServices() {
    wx.switchTab({ url: '/pages/service/service' });
  },
});
