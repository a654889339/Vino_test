const app = getApp();
const { buildSectionSkinContainerStyle } = require('../../utils/sectionSkin.js');

function getToken() {
  return app.globalData.token || (my.getStorageSync({ key: 'vino_token' }) || {}).data;
}

Page({
  data: {
    headerLogoUrl: '',
    heroBgUrl: '',
    heroBgList: [],
    navSectionTitle: '自助预约',
    myProductsTitle: '我的商品',
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
    this.loadHomeConfig();
    this.loadMyProducts();
  },

  loadMyProducts() {
    if (!getToken()) {
      this.setData({ myProducts: [] });
      return;
    }
    app.request({ url: '/auth/my-products' })
      .then(res => {
        const list = res.data || [];
        const base = (app.globalData.baseUrl || '').replace(/\/api\/?$/, '') || 'http://106.54.50.88:5202';
        const toFull = (u) => {
          if (!u || typeof u !== 'string') return u || '';
          const t = String(u).trim();
          if (t.startsWith('http')) return t;
          return base + (t.startsWith('/') ? t : '/' + t);
        };
        const myProducts = list.map(item => ({
          ...item,
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
    const base = (app.globalData.baseUrl || '').replace(/\/api\/?$/, '') || 'http://106.54.50.88:5202';
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
          .map(i => ({ id: i.id, title: i.title, imageUrl: i.imageUrl, imageUrlThumb: i.imageUrlThumb || '', icon: i.icon, path: i.path || '/pages/service/service', color: i.color }));
        const navSm = items.filter(i => i.section === 'navSm' && i.status === 'active')
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(i => ({ id: i.id, title: i.title, imageUrl: i.imageUrl, imageUrlThumb: i.imageUrlThumb || '', icon: i.icon, path: i.path || '/pages/service/service', color: i.color }));

        const vinoRows = items.filter(i => i.section === 'vinoProduct' && i.status === 'active')
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const vinoItems = vinoRows.map((row) => {
          const path = (row.path || '').trim();
          const g = path ? (guidesBySlug[path] || guidesBySlug[path.toLowerCase()]) : null;
          let title = row.title || '';
          let iconUrl = '';
          if (g) {
            title = (g.name && String(g.name).trim()) || title;
            iconUrl = (g.iconUrl && String(g.iconUrl).trim()) || '';
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
          let title = row.title || '';
          let subtitle = (row.desc || '').trim();
          let coverImage = '';
          let coverThumb = '';
          if (g) {
            title = (g.name && String(g.name).trim()) || title;
            subtitle = (g.subtitle && String(g.subtitle).trim()) || subtitle;
            coverImage = (g.coverImage && String(g.coverImage).trim()) || '';
            coverThumb = (g.coverImageThumb && String(g.coverImageThumb).trim()) || '';
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
              barTitle: (evRow.title && String(evRow.title).trim()) || '探索VINO',
              mainTitle: (evRow.icon && String(evRow.icon).trim()) || 'VINO',
              subTitle: (evRow.desc || '').trim(),
              path: pathEv,
              displayBg,
            };
          }
        }

        this.setData({
          headerLogoUrl: headerLogo ? toFull(headerLogo.imageUrl) : '',
          heroBgUrl: singleBg,
          heroBgList: homeBgList,
          navSectionTitle: (navSectionTitleItem && navSectionTitleItem.title) ? navSectionTitleItem.title.trim() : '自助预约',
          myProductsTitle: (myProductsTitleItem && myProductsTitleItem.title) ? myProductsTitleItem.title.trim() : '我的商品',
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
