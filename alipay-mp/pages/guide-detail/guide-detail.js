const app = getApp();
const { openManualFromGuide } = require('../../utils/openManual.js');
const i18n = require('../../utils/i18n.js');
const currencyUtil = require('../../utils/currency.js');
const { resolveMediaUrl, guideProductMediaUrl } = require('../../utils/cosMedia.js');

Page({
  data: {
    loading: true,
    guide: {},
    sections: [],
    mediaItems: [],
    helpItems: [],
    firstMediaTitle: '',
    hasPrice: false,
    displayListPrice: '',
    displayOriginPrice: '',
    cartCount: 0,
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
    this.loadCart();
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
        const fix = (u) => (u ? resolveMediaUrl(u, app.globalData.baseUrl) : '');
        const lang = i18n.isEn() ? 'en' : 'zh';
        const base = app.globalData.baseUrl;
        const gid = g.id;
        g.coverImage = guideProductMediaUrl(gid, 'cover', { lang, apiBase: base });
        g.coverImageThumb = guideProductMediaUrl(gid, 'cover_thumb', { lang, apiBase: base });
        g.iconUrl = guideProductMediaUrl(gid, 'icon', { lang, apiBase: base });
        g.model3dUrl = guideProductMediaUrl(gid, 'model3d', { apiBase: base });
        g.model3dDecalUrl = guideProductMediaUrl(gid, 'decal', { apiBase: base });
        g.model3dSkyboxUrl = guideProductMediaUrl(gid, 'skybox', { apiBase: base });
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
      !!(g.id && guideProductMediaUrl(g.id, 'pdf', { apiBase: app.globalData.baseUrl }));
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

  addToCart() {
    const g = this.data.guide;
    if (!g || !g.id) return;
    if (!app.checkLogin()) return;
    const listPrice = Number(g.listPrice) || 0;
    if (!(listPrice > 0)) {
      my.showToast({ content: '该商品暂未配置价格', type: 'none' });
      return;
    }
    const gid = Number(g.id);
    const cur = (this.cartLines || []).map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
    const idx = cur.findIndex((x) => Number(x.guideId) === gid);
    if (idx >= 0) cur[idx].qty += 1;
    else cur.push({ guideId: gid, qty: 1 });
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

  goCart() {
    if (!app.checkLogin()) return;
    my.navigateTo({ url: '/pages/cart/cart' });
  },

  open3DViewer() {
    const g = this.data.guide || {};
    if (!g.model3dEnabled || !g.model3dUrl) return;
    const title = i18n.t('guideDetail.preview3D') || '3D 预览';
    const content = i18n.t('guideDetail.preview3DUnsupported') || '请在微信小程序或网页端查看商品 3D 预览';
    if (typeof my.alert === 'function') {
      my.alert({ title, content });
    } else {
      my.showToast({ content, type: 'none', duration: 2500 });
    }
  },
});
