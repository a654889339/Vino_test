const app = getApp();
const { buildSectionSkinContainerStyle } = require('../../utils/sectionSkin.js');
const i18n = require('../../utils/i18n.js');
const { normalizeImageUrl } = require('../../utils/image.js');
const cosMedia = require('../../utils/cosMedia.js');

Page({
  data: {
    currentLang: '',
    headerLogoUrl: '',
    heroBgUrl: '',
    heroBgList: [],
    navSectionTitle: '',
    myProductsTitle: '',
    langLabel: '',
    progressQueryText: '',
    vinoProductsText: '',
    viewAllText: '',
    featuredText: '',
    viewMoreText: '',
    navLgItems: [],
    navSmItems: [],
    myProducts: [],
    vinoItems: [],
    featuredItems: [],
    vinoSectionStyle: '',
    frSectionStyle: '',
    homeScrollStyle: '',
    myProductsSectionStyle: '',
    hotServiceSectionStyle: '',
    exploreVino: null,
    recommends: [],
  },

  onShow() {
    i18n.syncCustomTabBar(this, 0);
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      i18n.detectLangByIp((lang) => {
        self.setData({
          currentLang: lang,
          langLabel: i18n.isEn() ? 'EN' : i18n.t('lang.zhLabel'),
        });
      });
      self.loadHomeConfig();
      self.loadMyProducts();
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  refreshI18n() {
    i18n.setNavTitle('index.title');
    this.setData({
      currentLang: i18n.getLang(),
      langLabel: i18n.isEn() ? 'EN' : i18n.t('lang.zhLabel'),
      navSectionTitle: i18n.t('home.selfBook'),
      myProductsTitle: i18n.t('home.myProducts'),
      progressQueryText: i18n.t('home.progressQuery'),
      vinoProductsText: i18n.t('home.vinoProducts'),
      viewAllText: i18n.t('home.viewAll'),
      featuredText: i18n.t('home.featured'),
      viewMoreText: i18n.t('home.viewMore'),
      recommends: [
        { id: 1, title: i18n.t('home.memberBenefits'), desc: i18n.t('home.exclusiveDiscount'), emoji: '🏅', bg: 'linear-gradient(135deg, #F59E0B, #D97706)' },
        { id: 2, title: i18n.t('home.serviceGuarantee'), desc: i18n.t('home.worryfreeAfterSales'), emoji: '🛡️', bg: 'linear-gradient(135deg, #10B981, #059669)' },
        { id: 3, title: i18n.t('home.pointsMall'), desc: i18n.t('home.giftExchange'), emoji: '🎁', bg: 'linear-gradient(135deg, #EC4899, #DB2777)' },
        { id: 4, title: i18n.t('home.inviteReward'), desc: i18n.t('home.shareCommission'), emoji: '👥', bg: 'linear-gradient(135deg, #6366F1, #4F46E5)' },
      ],
    });
  },

  onLangTap() {
    const items = [i18n.t('lang.zhName'), 'English'];
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const lang = res.tapIndex === 1 ? 'en' : 'zh';
        i18n.setLang(lang);
        this.refreshI18n();
        this.loadHomeConfig();
        i18n.syncCustomTabBar(this, 0);
      },
    });
  },

  loadMyProducts() {
    if (!(getApp().globalData.token || wx.getStorageSync('vino_token'))) {
      this.setData({ myProducts: [] });
      return;
    }
    getApp().request({ url: '/auth/my-products' })
      .then(res => {
        const list = res.data || [];
        const toFull = (u) => normalizeImageUrl(u, getApp().globalData.baseUrl);
        const myProducts = list.map(item => {
          const gid = Number(item.guideId);
          let full = '';
          if (Number.isFinite(gid) && gid > 0) {
            const lang = i18n.isEn() ? 'en' : 'zh';
            full = cosMedia.guideProductMediaUrl(gid, 'icon', { lang, apiBase: getApp().globalData.baseUrl });
          } else if (item.iconUrl) {
            full = toFull(item.iconUrl);
          }
          return {
            ...item,
            categoryName: i18n.pick(item, 'categoryName') || item.categoryName || '',
            iconUrl: full,
            displayIconUrl: (full || '').trim(),
          };
        });
        this.setData({ myProducts });
      })
      .catch(() => this.setData({ myProducts: [] }));
  },

  goMyProducts() {
    wx.navigateTo({ url: '/pages/my-products/my-products' });
  },

  goProducts() {
    wx.switchTab({ url: '/pages/products/products' });
  },

  goVinoGuide(e) {
    const slug = (e.currentTarget.dataset.slug && String(e.currentTarget.dataset.slug).trim()) || '';
    if (!slug) {
      wx.showToast({ title: i18n.t('home.noProduct'), icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(slug),
    });
  },

  goFeaturedGuide(e) {
    const slug = (e.currentTarget.dataset.slug && String(e.currentTarget.dataset.slug).trim()) || '';
    if (!slug) {
      wx.showToast({ title: i18n.t('home.noProduct'), icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(slug),
    });
  },

  goExploreVino() {
    const ev = this.data.exploreVino;
    if (!ev || !ev.path) {
      wx.showToast({ title: i18n.t('home.noLink'), icon: 'none' });
      return;
    }
    const link = String(ev.path).trim();
    if (link.startsWith('http://') || link.startsWith('https://')) {
      wx.navigateTo({
        url: '/pages/webview/webview?url=' + encodeURIComponent(link),
      });
      return;
    }
    if (link.startsWith('/pages/')) {
      wx.navigateTo({ url: link, fail: () => wx.switchTab({ url: link }) });
      return;
    }
    wx.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(link),
    });
  },

  goMyProductGuide(e) {
    const slug = (e.currentTarget.dataset.slug && String(e.currentTarget.dataset.slug).trim()) || '';
    if (!slug) {
      wx.showToast({ title: i18n.t('home.noGuide'), icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(slug),
    });
  },

  loadHomeConfig() {
    const toFull = (u) => normalizeImageUrl(u, app.globalData.baseUrl);
    const lang = i18n.isEn() ? 'en' : 'zh';
    const apiBase = app.globalData.baseUrl;

    const pHc = app.request({ url: '/home-config?all=1' }).catch(() => ({ data: [] }));
    const pGuides = app.request({ url: '/guides' }).catch(() => ({ data: [] }));

    Promise.all([pHc, pGuides])
      .then(([hcRes, gRes]) => {
        const items = hcRes.data || [];
        const guides = gRes.data || [];
        const guidesBySlug = {};
        guides.forEach((g) => {
          const s = g.slug != null ? String(g.slug).trim() : '';
          if (!s) return;
          guidesBySlug[s] = g;
          guidesBySlug[s.toLowerCase()] = g;
        });

        const headerLogo = items.find(i => i.section === 'headerLogo' && i.status === 'active');
        const homeBgItems = items.filter(i => i.section === 'homeBg' && i.status === 'active');
        const homeBgList = homeBgItems.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map(i => {
            const url = toFull(i18n.pick(i, 'imageUrl'));
            const thumb = '';
            const displayUrl = url;
            return { url, thumb, displayUrl };
          })
          .filter(i => i.url);
        const singleBg = homeBgList[0] ? homeBgList[0].displayUrl : '';
        const navSectionTitleItem = items.find(i => i.section === 'navSectionTitle' && i.status === 'active');
        const myProductsTitleItem = items.find(i => i.section === 'myProducts' && i.status === 'active');
        const navLg = items.filter(i => i.section === 'navLg' && i.status === 'active')
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(i => {
            const imageUrl = i.imageUrl ? toFull(i.imageUrl) : '';
            const imageUrlThumb = i.imageUrlThumb ? toFull(i.imageUrlThumb) : '';
            return {
              id: i.id,
              title: i18n.pick(i, 'title') || i.title || '',
              imageUrl,
              imageUrlThumb,
              displayImageUrl: (imageUrlThumb || imageUrl || '').trim(),
              icon: i.icon,
              path: i.path || '/pages/service/service',
              color: i.color,
            };
          });
        const navSm = items.filter(i => i.section === 'navSm' && i.status === 'active')
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(i => {
            const imageUrl = i.imageUrl ? toFull(i.imageUrl) : '';
            const imageUrlThumb = i.imageUrlThumb ? toFull(i.imageUrlThumb) : '';
            return {
              id: i.id,
              title: i18n.pick(i, 'title') || i.title || '',
              imageUrl,
              imageUrlThumb,
              displayImageUrl: (imageUrlThumb || imageUrl || '').trim(),
              icon: i.icon,
              path: i.path || '/pages/service/service',
              color: i.color,
            };
          });

        const vinoRows = items.filter(i => i.section === 'vinoProduct' && i.status === 'active')
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const vinoItems = vinoRows.map((row) => {
          const path = (row.path || '').trim();
          const g = path ? (guidesBySlug[path] || guidesBySlug[path.toLowerCase()]) : null;
          let title = i18n.pick(row, 'title') || row.title || '';
          let fullIcon = '';
          if (g && g.id) {
            title = i18n.pick(g, 'name') || title;
            fullIcon = cosMedia.guideProductMediaUrl(g.id, 'icon', { lang, apiBase });
          } else if (row.imageUrl) {
            fullIcon = toFull(row.imageUrl);
          }
          return {
            id: row.id,
            title,
            path,
            iconUrl: fullIcon,
            displayIconUrl: (fullIcon || '').trim(),
          };
        });

        const frRows = items.filter(i => i.section === 'featuredRecommend' && i.status === 'active')
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const featuredItems = frRows.map((row) => {
          const path = (row.path || '').trim();
          const g = path ? (guidesBySlug[path] || guidesBySlug[path.toLowerCase()]) : null;
          let title = i18n.pick(row, 'title') || row.title || '';
          let subtitle = (i18n.pick(row, 'desc') || row.desc || '').trim();
          let coverUrl = '';
          if (g && g.id) {
            title = i18n.pick(g, 'name') || title;
            subtitle = i18n.pick(g, 'subtitle') || subtitle;
            const th = cosMedia.guideProductMediaUrl(g.id, 'cover_thumb', { lang, apiBase });
            const cv = cosMedia.guideProductMediaUrl(g.id, 'cover', { lang, apiBase });
            coverUrl = (th || cv || '').trim();
          }
          if (!coverUrl) {
            coverUrl = toFull((row.imageUrlThumb || row.imageUrl || '').trim());
          }
          return { id: row.id, title, subtitle, path, coverUrl };
        });

        const evRow = items.find(i => i.section === 'exploreVino' && i.status === 'active');
        let exploreVino = null;
        if (evRow) {
          const img = i18n.pick(evRow, 'imageUrl').trim();
          const pathEv = (evRow.path || '').trim();
          if (img || pathEv) {
            const thumb = i18n.pick(evRow, 'imageUrlThumb').trim();
            const displayBg = thumb ? toFull(thumb) : (img ? toFull(img) : '');
            const barTitle = i18n.pick(evRow, 'title').trim() || i18n.t('home.exploreVino');
            const mainTitle = i18n.pick(evRow, 'icon').trim() || 'VINO';
            const subTitle = i18n.pick(evRow, 'desc').trim();
            exploreVino = { barTitle, mainTitle, subTitle, path: pathEv, displayBg };
          }
        }

        const recRows = items.filter(i => i.section === 'recommend' && i.status === 'active');
        const recommends = recRows.length
          ? recRows.map((i, idx) => ({
            id: i.id,
            title: i18n.pick(i, 'title') || i.title || '',
            desc: i18n.pick(i, 'desc') || i.desc || '',
            emoji: ['🏅', '🛡️', '🎁', '👥', '⭐', '📌'][idx % 6],
            bg: i.color && String(i.color).trim() ? i.color : 'linear-gradient(135deg, #6366F1, #4F46E5)',
          }))
          : this.data.recommends;

        const navSectionTitle = (() => {
          const v = navSectionTitleItem ? (i18n.pick(navSectionTitleItem, 'title') || navSectionTitleItem.title || '').trim() : '';
          return v || i18n.t('home.selfBook');
        })();
        const myProductsTitle = (() => {
          const v = myProductsTitleItem ? (i18n.pick(myProductsTitleItem, 'title') || myProductsTitleItem.title || '').trim() : '';
          return v || i18n.t('home.myProducts');
        })();

        this.setData({
          headerLogoUrl: headerLogo ? toFull(i18n.pick(headerLogo, 'imageUrl')) : '',
          heroBgUrl: singleBg,
          heroBgList: homeBgList,
          navSectionTitle,
          myProductsTitle,
          navLgItems: navLg,
          navSmItems: navSm,
          vinoItems,
          featuredItems,
          recommends,
          vinoSectionStyle: buildSectionSkinContainerStyle(items, 'vinoProduct', 'vino'),
          frSectionStyle: buildSectionSkinContainerStyle(items, 'featuredRecommend', 'fr'),
          homeScrollStyle: buildSectionSkinContainerStyle(items, 'homeScroll', 'card'),
          myProductsSectionStyle: buildSectionSkinContainerStyle(items, 'myProducts', 'card'),
          exploreVino,
        });
      })
      .catch(() => {});
  },

  /** 导航图：缩略图 404 时改用原图 */
  onNavImageError(e) {
    const id = e.currentTarget.dataset.id;
    const kind = e.currentTarget.dataset.kind;
    const key = kind === 'sm' ? 'navSmItems' : 'navLgItems';
    const srcList = this.data[key] || [];
    const cur = srcList.find((it) => it.id === id);
    console.error('[img-err] nav', kind, id, cur && cur.displayImageUrl, e && e.detail);
    const list = srcList.map((item) => {
      if (item.id !== id || !item.imageUrl) return item;
      if (item.displayImageUrl === item.imageUrl) return item;
      return { ...item, displayImageUrl: item.imageUrl };
    });
    this.setData({ [key]: list });
  },

  /** Vino 产品区：缩略图失败回退原图 */
  onVinoIconError(e) {
    const idx = e.currentTarget.dataset.idx;
    const list = [...(this.data.vinoItems || [])];
    const it = list[idx];
    console.error('[img-err] vinoIcon', idx, it && it.displayIconUrl, it && it.iconUrl, e && e.detail);
    if (!it || !it.iconUrl) return;
    if (it.displayIconUrl === it.iconUrl) return;
    list[idx] = { ...it, displayIconUrl: it.iconUrl };
    this.setData({ vinoItems: list });
  },

  /** 我的商品：缩略图失败回退原图 */
  onMyProductIconError(e) {
    const idx = e.currentTarget.dataset.idx;
    const list = [...(this.data.myProducts || [])];
    const it = list[idx];
    console.error('[img-err] myProduct', idx, it && it.displayIconUrl, it && it.iconUrl, e && e.detail);
    if (!it || !it.iconUrl) return;
    if (it.displayIconUrl === it.iconUrl) return;
    list[idx] = { ...it, displayIconUrl: it.iconUrl };
    this.setData({ myProducts: list });
  },

  /** 缩略图/轮播图加载失败时回退原图（避免 404 导致空白） */
  onHeroBgError(e) {
    const idx = e.currentTarget.dataset.idx;
    const list = this.data.heroBgList || [];
    console.error('[img-err] heroBg', idx, list[idx] && list[idx].displayUrl, list[idx] && list[idx].url, e && e.detail);
    if (!list[idx] || !list[idx].url) return;
    if (list[idx].displayUrl === list[idx].url) return;
    list[idx] = { ...list[idx], displayUrl: list[idx].url };
    this.setData({ heroBgList: list });
  },

  goPath(e) {
    const path = e.currentTarget.dataset.path || '';
    if (path) {
      wx.navigateTo({ url: path, fail() { wx.switchTab({ url: path }); } });
    }
  },

  goService() { wx.switchTab({ url: '/pages/service/service' }); },
});
