const app = getApp();
const { openManualFromGuide } = require('../../utils/openManual.js');
const i18n = require('../../utils/i18n.js');

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
    // 同步立即按当前语言设置标题，避免英文下闪现 JSON 默认的「设备指南」。
    i18n.setNavTitle('guideDetail.title', '设备指南', 'Device Guide');
    const go = () => {
      if (options.id) this.loadGuide(options.id);
      else this.setData({ loading: false });
    };
    if (i18n.isLoaded()) go();
    else i18n.loadI18nTexts(go);
  },

  onShow() {
    // 跨页切换语言后回到本页：按当前语言重新设标题，并刷新已渲染字段。
    const g = this.data.guide;
    if (g && g.id) {
      const title = i18n.pick(g, 'subtitle') || i18n.pick(g, 'name') || i18n.t('guideDetail.title');
      if (title && typeof my.setNavigationBar === 'function') my.setNavigationBar({ title });
    } else {
      i18n.setNavTitle('guideDetail.title', '设备指南', 'Device Guide');
    }
  },

  loadGuide(id) {
    app.request({ url: `/guides/${id}` })
      .then(res => {
        const g = res.data || {};
        const displayName = i18n.pick(g, 'name') || g.name || '';
        const displaySubtitle = i18n.pick(g, 'subtitle') || g.subtitle || '';
        g.displayName = displayName;
        g.displaySubtitle = displaySubtitle;
        const navTitle = displaySubtitle || displayName || i18n.t('guideDetail.title');
        if (navTitle && typeof my.setNavigationBar === 'function') my.setNavigationBar({ title: navTitle });
        const parse = v => { try { return Array.isArray(v) ? v : JSON.parse(v || '[]'); } catch { return []; } };
        const base = app.globalData.baseUrl.replace('/api', '');
        const fix = u => (u && !u.startsWith('http') ? base + u : u);
        if (g.coverImage) g.coverImage = fix(g.coverImage);
        if (g.coverImageThumb) g.coverImageThumb = fix(g.coverImageThumb);
        if (g.iconUrl) g.iconUrl = fix(g.iconUrl);
        g.displayCoverUrl = g.coverImageThumb || g.coverImage;
        g.displayIconUrl = g.iconUrl || '';
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
          firstMediaTitle: mediaItems.length ? (mediaItems[0].title || g.displayName || g.name) : (g.displayName || g.name),
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
  onIconLoad() {},
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
