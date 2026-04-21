const app = getApp();
const { buildSectionSkinContainerStyle } = require('../../utils/sectionSkin.js');
const i18n = require('../../utils/i18n.js');

function getToken() {
  return app.globalData.token || (my.getStorageSync({ key: 'vino_token' }) || {}).data;
}

Page({
  data: {
    currentLang: '',
    langLabel: '',
    headerLogoUrl: '',
    heroBgUrl: '',
    heroBgList: [],
    navSectionTitle: '',
    myProductsTitle: '',
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
    exploreVino: null,
  },

  onShow() {
    i18n.applyTabBarLabels();
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
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
    });
  },

  onLangTap() {
    const items = [i18n.t('lang.zhName'), 'English'];
    my.showActionSheet({
      items,
      success: (res) => {
        if (res.index == null || res.index < 0) return;
        const lang = res.index === 1 ? 'en' : 'zh';
        i18n.setLang(lang);
        this.refreshI18n();
        this.loadHomeConfig();
      },
    });
  },

  loadMyProducts() {
    if (!getToken()) {
      this.setData({ myProducts: [] });
      return;
    }
    app.request({ url: '/auth/my-products' })
      .then(res => {
        const list = res.data || [];
        const base = (app.globalData.baseUrl || '').replace(/\/api\/?$/, '');
        const toFull = (u) => {
          if (!u || typeof u !== 'string') return u || '';
          const t = String(u).trim();
          if (t.startsWith('http')) return t;
          return base + (t.startsWith('/') ? t : '/' + t);
        };
        const myProducts = list.map(item => ({
          ...item,
          categoryName: i18n.pick(item, 'categoryName') || item.categoryName || '',
          productName: i18n.pick(item, 'productName') || item.productName || '',
          iconUrl: item.iconUrl ? toFull(item.iconUrl) : '',
        }));
        this.setData({ myProducts });
      })
      .catch(() => this.setData({ myProducts: [] }));
  },

  goMyProducts() {
    my.navigateTo({ url: '/pages/my-products/my-products' });
  },

  goProducts() {
    my.switchTab({ url: '/pages/products/products' });
  },

  goVinoGuide(e) {
    const slug = (e.currentTarget.dataset.slug && String(e.currentTarget.dataset.slug).trim()) || '';
    if (!slug) {
      my.showToast({ content: '未配置商品', type: 'none' });
      return;
    }
    my.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(slug),
    });
  },

  goFeaturedGuide(e) {
    const slug = (e.currentTarget.dataset.slug && String(e.currentTarget.dataset.slug).trim()) || '';
    if (!slug) {
      my.showToast({ content: '未配置商品', type: 'none' });
      return;
    }
    my.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(slug),
    });
  },

  goExploreVino() {
    const ev = this.data.exploreVino;
    if (!ev || !ev.path) {
      my.showToast({ content: '未配置链接', type: 'none' });
      return;
    }
    const link = String(ev.path).trim();
    if (link.startsWith('http://') || link.startsWith('https://')) {
      my.navigateTo({
        url: '/pages/webview/webview?url=' + encodeURIComponent(link),
      });
      return;
    }
    if (link.startsWith('/pages/')) {
      my.navigateTo({ url: link, fail: () => my.switchTab({ url: link }) });
      return;
    }
    my.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(link),
    });
  },

  goMyProductGuide(e) {
    const slug = (e.currentTarget.dataset.slug && String(e.currentTarget.dataset.slug).trim()) || '';
    if (!slug) {
      my.showToast({ content: '暂无产品指南', type: 'none' });
      return;
    }
    my.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(slug),
    });
  },

  loadHomeConfig() {
    const base = (app.globalData.baseUrl || '').replace(/\/api\/?$/, '');
    const toFull = (u) => {
      if (!u || typeof u !== 'string') return u || '';
      const t = u.trim();
      if (t.startsWith('http://') || t.startsWith('https://')) return t;
      return base + (t.startsWith('/') ? t : '/' + t);
    };

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
            const url = toFull(i.imageUrl);
            const thumb = (i.imageUrlThumb && i.imageUrlThumb.trim()) ? toFull(i.imageUrlThumb.trim()) : '';
            const displayUrl = url;
            return { url, thumb, displayUrl };
          })
          .filter(i => i.url);
        const singleBg = homeBgList[0] ? homeBgList[0].displayUrl : '';
        const navSectionTitleItem = items.find(i => i.section === 'navSectionTitle' && i.status === 'active');
        const myProductsTitleItem = items.find(i => i.section === 'myProducts' && i.status === 'active');
        const navLg = items.filter(i => i.section === 'navLg' && i.status === 'active')
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(i => ({ id: i.id, title: i18n.pick(i, 'title') || i.title || '', imageUrl: i.imageUrl, imageUrlThumb: i.imageUrlThumb || '', icon: i.icon, path: i.path || '/pages/service/service', color: i.color }));
        const navSm = items.filter(i => i.section === 'navSm' && i.status === 'active')
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(i => ({ id: i.id, title: i18n.pick(i, 'title') || i.title || '', imageUrl: i.imageUrl, imageUrlThumb: i.imageUrlThumb || '', icon: i.icon, path: i.path || '/pages/service/service', color: i.color }));

        const vinoRows = items.filter(i => i.section === 'vinoProduct' && i.status === 'active')
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const vinoItems = vinoRows.map((row) => {
          const path = (row.path || '').trim();
          const g = path ? (guidesBySlug[path] || guidesBySlug[path.toLowerCase()]) : null;
          let title = i18n.pick(row, 'title') || row.title || '';
          let iconUrl = '';
          if (g) {
            title = i18n.pick(g, 'name') || title;
            iconUrl = i18n.pick(g, 'iconUrl') || '';
          }
          if (!iconUrl && row.imageUrl) iconUrl = row.imageUrl;
          return {
            id: row.id,
            title,
            path,
            iconUrl: iconUrl ? toFull(iconUrl) : '',
          };
        });

        const frRows = items.filter(i => i.section === 'featuredRecommend' && i.status === 'active')
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const featuredItems = frRows.map((row) => {
          const path = (row.path || '').trim();
          const g = path ? (guidesBySlug[path] || guidesBySlug[path.toLowerCase()]) : null;
          let title = i18n.pick(row, 'title') || row.title || '';
          let subtitle = (i18n.pick(row, 'desc') || row.desc || '').trim();
          let coverImage = '';
          let coverThumb = '';
          if (g) {
            title = i18n.pick(g, 'name') || title;
            subtitle = i18n.pick(g, 'subtitle') || subtitle;
            coverImage = i18n.pick(g, 'coverImage') || '';
            coverThumb = i18n.pick(g, 'coverImageThumb') || '';
          }
          if (!coverImage && row.imageUrl) coverImage = row.imageUrl;
          if (!coverThumb && row.imageUrlThumb) coverThumb = row.imageUrlThumb;
          const coverUrl = toFull((coverImage || coverThumb || row.imageUrl || row.imageUrlThumb || '').trim());
          return { id: row.id, title, subtitle, path, coverUrl };
        });

        const evRow = items.find(i => i.section === 'exploreVino' && i.status === 'active');
        let exploreVino = null;
        if (evRow) {
          const img = (evRow.imageUrl || '').trim();
          const pathEv = (evRow.path || '').trim();
          if (img || pathEv) {
            const thumb = (evRow.imageUrlThumb || '').trim();
            const displayBg = thumb ? toFull(thumb) : (img ? toFull(evRow.imageUrl) : '');
            exploreVino = {
              barTitle: (i18n.pick(evRow, 'title') || evRow.title || '').trim() || i18n.t('home.exploreVino'),
              mainTitle: (evRow.icon && String(evRow.icon).trim()) || 'VINO',
              subTitle: (i18n.pick(evRow, 'desc') || evRow.desc || '').trim(),
              path: pathEv,
              displayBg,
            };
          }
        }

        const navSectionTitle = (() => {
          const v = navSectionTitleItem ? (i18n.pick(navSectionTitleItem, 'title') || navSectionTitleItem.title || '').trim() : '';
          return v || i18n.t('home.selfBook');
        })();
        const myProductsTitle = (() => {
          const v = myProductsTitleItem ? (i18n.pick(myProductsTitleItem, 'title') || myProductsTitleItem.title || '').trim() : '';
          return v || i18n.t('home.myProducts');
        })();

        this.setData({
          headerLogoUrl: headerLogo ? toFull(i18n.pick(headerLogo, 'imageUrl') || headerLogo.imageUrl) : '',
          heroBgUrl: singleBg,
          heroBgList: homeBgList,
          navSectionTitle,
          myProductsTitle,
          navLgItems: navLg,
          navSmItems: navSm,
          vinoItems,
          featuredItems,
          vinoSectionStyle: buildSectionSkinContainerStyle(items, 'vinoProduct', 'vino'),
          frSectionStyle: buildSectionSkinContainerStyle(items, 'featuredRecommend', 'fr'),
          homeScrollStyle: buildSectionSkinContainerStyle(items, 'homeScroll', 'card'),
          myProductsSectionStyle: buildSectionSkinContainerStyle(items, 'myProducts', 'card'),
          exploreVino,
        });
      })
      .catch(() => {});
  },

  onHeroBgError(e) {
    const idx = e.currentTarget.dataset.idx;
    const list = this.data.heroBgList || [];
    if (!list[idx] || !list[idx].url) return;
    if (list[idx].displayUrl === list[idx].url) return;
    list[idx] = { ...list[idx], displayUrl: list[idx].url };
    this.setData({ heroBgList: list });
  },

  goPath(e) {
    const path = e.currentTarget.dataset.path || '';
    if (path) {
      my.navigateTo({ url: path, fail() { my.switchTab({ url: path }); } });
    }
  },

  goService() { my.switchTab({ url: '/pages/service/service' }); },
});
