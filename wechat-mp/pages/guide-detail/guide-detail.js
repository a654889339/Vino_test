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
    loadingText: '',
    helpTitle: '',
    manualLabel: '',
    faqLabel: '',
    serviceEntryTitle: '',
    selfServiceLabel: '',
    servicePointLabel: '',
    afterSalesLabel: '',
    repairQuoteLabel: '',
  },

  onLoad(options) {
    const self = this;
    // 同步立即按当前语言设置标题，避免英文下闪现 JSON 默认的「设备指南」。
    // 服务端回包后 applyNavBarTitle 会再以 guide.name/subtitle 覆盖本次占位。
    i18n.setNavTitle('guideDetail.title', '设备指南', 'Device Guide');
    const doRefresh = () => {
      self.refreshI18n();
      if (options.id) self.loadGuide(options.id);
      else self.setData({ loading: false });
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  onShow() {
    // 处理「跨页切换语言后回到本页」的场景：已加载 guide 时按当前语言重新设置导航栏标题与 hero 文案。
    const g = this.data.guide;
    if (g && g.id) {
      this.refreshI18n();
      this.applyLocalizedGuideFields(g);
      this.applyNavBarTitle(g);
      const mediaItems = this.data.mediaItems || [];
      this.setData({
        guide: g,
        firstMediaTitle: mediaItems.length ? (mediaItems[0].title || g.displayName || g.name) : (g.displayName || g.name),
      });
    }
  },

  refreshI18n() {
    this.setData({
      loadingText: i18n.t('common.loading'),
      helpTitle: i18n.t('guideDetail.helpTitle'),
      manualLabel: i18n.t('guideDetail.manual'),
      faqLabel: i18n.t('guideDetail.faq'),
      serviceEntryTitle: i18n.t('guideDetail.serviceEntry'),
      selfServiceLabel: i18n.t('guideDetail.selfService'),
      servicePointLabel: i18n.t('guideDetail.servicePoint'),
      afterSalesLabel: i18n.t('guideDetail.afterSales'),
      repairQuoteLabel: i18n.t('guideDetail.repairQuote'),
    });
  },

  applyNavBarTitle(g) {
    if (!g) return;
    const title =
      i18n.pick(g, 'subtitle') ||
      i18n.pick(g, 'name') ||
      i18n.t('guideDetail.title');
    wx.setNavigationBarTitle({ title });
  },

  /** 按当前语言重算 guide 上随语言变化的派生字段 */
  applyLocalizedGuideFields(g) {
    if (!g) return g;
    g.displayName = i18n.pick(g, 'name');
    g.displaySubtitle = i18n.pick(g, 'subtitle');
    return g;
  },

  loadGuide(id) {
    app.request({ url: `/guides/${id}` })
      .then(res => {
        const g = res.data || {};
        this.applyLocalizedGuideFields(g);
        this.applyNavBarTitle(g);
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
      const images = this.data.mediaItems
        .filter(m => m.type !== 'video')
        .map(m => m.url || m.thumb)
        .filter(Boolean);
      const idx = images.indexOf(mediaUrl);
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
      wx.showToast({ title: i18n.t('guideDetail.noManual'), icon: 'none' });
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
