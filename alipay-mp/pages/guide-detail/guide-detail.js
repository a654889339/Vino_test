const app = getApp();
const { openManualFromGuide } = require('../../utils/openManual.js');

Page({
  data: {
    loading: true,
    guide: {},
    sections: [],
    mediaItems: [],
    helpItems: [],
    firstMediaTitle: '',
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
        const base = app.globalData.baseUrl.replace('/api', '');
        const fix = u => (u && !u.startsWith('http') ? base + u : u);
        if (g.coverImage) g.coverImage = fix(g.coverImage);
        if (g.coverImageThumb) g.coverImageThumb = fix(g.coverImageThumb);
        if (g.iconUrl) g.iconUrl = fix(g.iconUrl);
        if (g.iconUrlThumb) g.iconUrlThumb = fix(g.iconUrlThumb);
        g.displayCoverUrl = g.coverImageThumb || g.coverImage;
        g.displayIconUrl = g.iconUrlThumb || g.iconUrl;
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
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false }));
  },

  onCoverLoad() {
    const g = this.data.guide;
    if (g.coverImageThumb && g.displayCoverUrl === g.coverImageThumb) {
      this.setData({ 'guide.displayCoverUrl': g.coverImage });
    }
  },
  onIconLoad() {
    const g = this.data.guide;
    if (g.iconUrlThumb && g.displayIconUrl === g.iconUrlThumb) {
      this.setData({ 'guide.displayIconUrl': g.iconUrl });
    }
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
      const images = this.data.mediaItems
        .filter(m => m.type !== 'video')
        .map(m => m.url || m.thumb)
        .filter(Boolean);
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
});
