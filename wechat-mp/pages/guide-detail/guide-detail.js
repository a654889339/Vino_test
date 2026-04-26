const app = getApp();
const { openManualFromGuide } = require('../../utils/openManual.js');
const i18n = require('../../utils/i18n.js');
const { normalizeImageUrl } = require('../../utils/image.js');
const currencyUtil = require('../../utils/currency.js');
const cosMedia = require('../../utils/cosMedia.js');

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
    show3DViewer: false,
    preview3DLabel: '',
    preview3DTip: '',
    addCartLabel: '',
    hasPrice: false,
    displayListPrice: '',
    displayOriginPrice: '',
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
    this.loadCart();
  },

  refreshI18n() {
    const addCartText = i18n.t('guideDetail.addToCart');
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
      preview3DLabel: i18n.t('guideDetail.preview3D'),
      preview3DTip: i18n.t('guideDetail.preview3DTip'),
      addCartLabel: addCartText && addCartText !== 'guideDetail.addToCart' ? addCartText : '加入购物车',
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
    g.displayDescription = i18n.pick(g, 'description');
    return g;
  },

  loadGuide(id) {
    app.request({ url: `/guides/${id}` })
      .then(res => {
        const g = res.data || {};
        this.applyLocalizedGuideFields(g);
        this.applyNavBarTitle(g);
        const parse = v => { try { return Array.isArray(v) ? v : JSON.parse(v || '[]'); } catch { return []; } };
        const fix = u => normalizeImageUrl(u, app.globalData.baseUrl);
        const lang = i18n.isEn() ? 'en' : 'zh';
        const base = app.globalData.baseUrl;
        const gid = g.id;
        g.coverImage = cosMedia.guideProductMediaUrl(gid, 'cover', { lang, apiBase: base });
        g.coverImageThumb = cosMedia.guideProductMediaUrl(gid, 'cover_thumb', { lang, apiBase: base });
        g.iconUrl = cosMedia.guideProductMediaUrl(gid, 'icon', { lang, apiBase: base });
        g.model3dUrl = cosMedia.guideProductMediaUrl(gid, 'model3d', { apiBase: base });
        g.model3dDecalUrl = cosMedia.guideProductMediaUrl(gid, 'decal', { apiBase: base });
        g.model3dSkyboxUrl = cosMedia.guideProductMediaUrl(gid, 'skybox', { apiBase: base });
        g.displayCoverUrl = g.coverImageThumb || g.coverImage;
        g.displayIconUrl = g.iconUrl || '';
        const mediaItems = parse(g.mediaItems).map(m => {
          if (m.thumb) m.thumb = fix(m.thumb);
          if (m.url) m.url = fix(m.url);
          return m;
        });
        const helpItems = parse(g.helpItems);
        const sections = parse(g.sections);
        const sym = (g.currency && String(g.currency).trim()) ? String(g.currency).trim() : (app.globalData.currencySymbol || '');
        const listPrice = Number(g.listPrice) || 0;
        const originPrice = (g.originPrice != null) ? Number(g.originPrice) : 0;
        const hasPrice = listPrice > 0;
        this.setData({
          guide: g,
          sections,
          mediaItems,
          helpItems,
          firstMediaTitle: mediaItems.length ? (mediaItems[0].title || g.displayName || g.name) : (g.displayName || g.name),
          hasPrice,
          displayListPrice: hasPrice ? currencyUtil.formatPriceDisplay(listPrice, sym) : '',
          displayOriginPrice: (hasPrice && originPrice > listPrice) ? currencyUtil.formatPriceDisplay(originPrice, sym) : '',
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
  onHeroImgError(e) {
    const g = this.data.guide || {};
    console.error('[img-err] hero', g.displayCoverUrl, g.coverImage, e && e.detail);
  },
  onIconErr(e) {
    const g = this.data.guide || {};
    console.error('[img-err] guideIcon', g.displayIconUrl, g.iconUrl, e && e.detail);
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
      !!(g.id && cosMedia.guideProductMediaUrl(g.id, 'pdf', { apiBase: app.globalData.baseUrl }));
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

  loadCart() {
    if (!app.isLoggedIn()) {
      this.cartLines = [];
      return;
    }
    app.request({ url: '/cart' })
      .then((res) => {
        this.cartLines = (res.data && res.data.items) ? res.data.items : [];
      })
      .catch(() => { this.cartLines = []; });
  },

  addToCart() {
    const g = this.data.guide;
    if (!g || !g.id) return;
    if (!app.checkLogin()) return;
    const listPrice = Number(g.listPrice) || 0;
    if (!(listPrice > 0)) {
      wx.showToast({ title: '该商品暂未配置价格', icon: 'none' });
      return;
    }
    const gid = Number(g.id);
    const cur = (this.cartLines || []).map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
    const idx = cur.findIndex((x) => Number(x.guideId) === gid);
    if (idx >= 0) cur[idx].qty += 1;
    else cur.push({ guideId: gid, qty: 1 });
    app.request({ url: '/cart', method: 'PUT', data: { items: cur } })
      .then((res) => {
        this.cartLines = (res.data && res.data.items) ? res.data.items : [];
        wx.showToast({ title: '已加入购物车', icon: 'success' });
      })
      .catch((err) => wx.showToast({ title: (err && err.message) || '加入失败', icon: 'none' }));
  },

  open3DViewer() {
    const g = this.data.guide || {};
    if (!g.model3dEnabled || !g.model3dUrl) return;
    this.setData({ show3DViewer: true });
    setTimeout(() => {
      const viewer = this.selectComponent('#modelViewer');
      if (!viewer) return;
      if (g.model3dSkyboxUrl && viewer.setSkybox) {
        viewer.setSkybox(g.model3dSkyboxUrl);
      }
      viewer.loadModel(g.model3dUrl)
        .then(() => {
          if (g.model3dDecalUrl) {
            return viewer.applyDecal(g.model3dDecalUrl, {
              angle: 0,
              height: 0,
              arcWidth: Math.PI / 3,
              heightRange: 1.0,
              opacity: 1.0,
            });
          }
        })
        .catch((err) => {
          console.error('[guide-detail] 3D load error:', err);
          wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
        });
    }, 300);
  },

  close3DViewer() {
    this.setData({ show3DViewer: false });
  },

  noop() {},
});
