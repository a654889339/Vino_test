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
        my.setNavigationBar({ title: g.name || '设备指南' });
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
    if (url) my.alert({ title: '视频', content: url });
  },

  openMedia(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = this.data.mediaItems[idx];
    if (!item) return;
    if (item.type === 'image' && item.url) {
      my.previewImage({ current: 0, urls: [item.url] });
    } else if (item.url) {
      my.alert({ title: item.title, content: '视频地址: ' + item.url });
    }
  },

  openHelp(e) {
    const idx = e.currentTarget.dataset.idx;
    const item = this.data.helpItems[idx];
    if (item && item.content) {
      my.alert({ title: item.title, content: item.content });
    }
  },

  goServices() {
    my.switchTab({ url: '/pages/service/service' });
  },
});
