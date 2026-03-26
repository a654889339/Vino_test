const app = getApp();
const { formatPriceDisplay } = require('../../utils/currency.js');

/** 与网页栏目外观一致：透明度同时作用于白底板 */
function skinContainerStyle(items, path, variant) {
  const row = items.find(i => i.section === 'homeSectionSkin' && String(i.path || '').trim() === path && i.status === 'active');
  if (!row) return '';
  let op = parseFloat(row.desc);
  if (!Number.isFinite(op)) op = 100;
  op = Math.min(100, Math.max(0, op)) / 100;
  const shadow = variant === 'vino' ? '0 4rpx 24rpx rgba(0,0,0,0.08)' : '0 4rpx 20rpx rgba(0,0,0,0.08)';
  const bg = op > 0 ? `rgba(255,255,255,${op})` : 'transparent';
  return `background:${bg};box-shadow:${op > 0 ? shadow : 'none'};`;
}

Page({
  data: {
    headerLogoUrl: '',
    heroBgUrl: '',
    heroBgList: [],
    navSectionTitle: '自助预约',
    myProductsTitle: '我的商品',
    hotServiceTitle: '热门服务',
    recommendTitle: '为你推荐',
    navLgItems: [],
    navSmItems: [],
    myProducts: [],
    hotServices: [],
    vinoItems: [],
    featuredItems: [],
    vinoSectionStyle: '',
    frSectionStyle: '',
    exploreVino: null,
    recommends: [
      { id: 1, title: '会员权益', desc: '专属折扣', emoji: '🏅', bg: 'linear-gradient(135deg, #F59E0B, #D97706)' },
      { id: 2, title: '服务保障', desc: '无忧售后', emoji: '🛡️', bg: 'linear-gradient(135deg, #10B981, #059669)' },
      { id: 3, title: '积分商城', desc: '好礼兑换', emoji: '🎁', bg: 'linear-gradient(135deg, #EC4899, #DB2777)' },
      { id: 4, title: '邀请有礼', desc: '分享得佣金', emoji: '👥', bg: 'linear-gradient(135deg, #6366F1, #4F46E5)' },
    ],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.loadHomeConfig();
    this.loadHotServices();
    this.loadMyProducts();
  },

  loadMyProducts() {
    if (!(getApp().globalData.token || wx.getStorageSync('vino_token'))) {
      this.setData({ myProducts: [] });
      return;
    }
    getApp().request({ url: '/auth/my-products' })
      .then(res => {
        const list = res.data || [];
        const base = (getApp().globalData.baseUrl || '').replace(/\/api\/?$/, '') || 'http://106.54.50.88:5202';
        const toFull = (u) => {
          if (!u || typeof u !== 'string') return u || '';
          const t = String(u).trim();
          if (t.startsWith('http')) return t;
          return base + (t.startsWith('/') ? t : '/' + t);
        };
        const myProducts = list.map(item => ({
          ...item,
          iconUrl: item.iconUrl ? toFull(item.iconUrl) : '',
          iconUrlThumb: item.iconUrlThumb ? toFull(item.iconUrlThumb) : '',
        }));
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
      wx.showToast({ title: '未配置商品', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(slug),
    });
  },

  goFeaturedGuide(e) {
    const slug = (e.currentTarget.dataset.slug && String(e.currentTarget.dataset.slug).trim()) || '';
    if (!slug) {
      wx.showToast({ title: '未配置商品', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/guide-detail/guide-detail?id=' + encodeURIComponent(slug),
    });
  },

  goExploreVino() {
    const ev = this.data.exploreVino;
    if (!ev || !ev.path) {
      wx.showToast({ title: '未配置链接', icon: 'none' });
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
      wx.showToast({ title: '暂无产品指南', icon: 'none' });
      return;
    }
    wx.navigateTo({
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
        const hotServiceTitleItem = items.find(i => i.section === 'hotServiceTitle' && i.status === 'active');
        const recommendTitleItem = items.find(i => i.section === 'recommendTitle' && i.status === 'active');
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
          let iconUrlThumb = '';
          if (g) {
            title = (g.name && String(g.name).trim()) || title;
            iconUrl = (g.iconUrl && String(g.iconUrl).trim()) || '';
            iconUrlThumb = (g.iconUrlThumb && String(g.iconUrlThumb).trim()) || '';
          }
          if (!iconUrl && row.imageUrl) iconUrl = row.imageUrl;
          if (!iconUrlThumb && row.imageUrlThumb) iconUrlThumb = row.imageUrlThumb;
          return {
            id: row.id,
            title,
            path,
            iconUrl: iconUrl ? toFull(iconUrl) : '',
            iconUrlThumb: iconUrlThumb ? toFull(iconUrlThumb) : '',
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

        const recRows = items.filter(i => i.section === 'recommend' && i.status === 'active');
        const recommends = recRows.length
          ? recRows.map((i, idx) => ({
            id: i.id,
            title: i.title || '',
            desc: i.desc || '',
            emoji: ['🏅', '🛡️', '🎁', '👥', '⭐', '📌'][idx % 6],
            bg: i.color && String(i.color).trim() ? i.color : 'linear-gradient(135deg, #6366F1, #4F46E5)',
          }))
          : this.data.recommends;

        this.setData({
          headerLogoUrl: headerLogo ? toFull(headerLogo.imageUrl) : '',
          heroBgUrl: singleBg,
          heroBgList: homeBgList,
          navSectionTitle: (navSectionTitleItem && navSectionTitleItem.title) ? navSectionTitleItem.title.trim() : '自助预约',
          hotServiceTitle: (hotServiceTitleItem && hotServiceTitleItem.title) ? hotServiceTitleItem.title.trim() : '热门服务',
          recommendTitle: (recommendTitleItem && recommendTitleItem.title) ? recommendTitleItem.title.trim() : '为你推荐',
          myProductsTitle: (myProductsTitleItem && myProductsTitleItem.title) ? myProductsTitleItem.title.trim() : '我的商品',
          navLgItems: navLg,
          navSmItems: navSm,
          vinoItems,
          featuredItems,
          vinoSectionStyle: skinContainerStyle(items, 'vinoProduct', 'vino'),
          frSectionStyle: skinContainerStyle(items, 'featuredRecommend', 'fr'),
          exploreVino,
          recommends,
        });
      })
      .catch(() => {});
  },

  /** 缩略图/轮播图加载失败时回退原图（避免 404 导致空白） */
  onHeroBgError(e) {
    const idx = e.currentTarget.dataset.idx;
    const list = this.data.heroBgList || [];
    if (!list[idx] || !list[idx].url) return;
    if (list[idx].displayUrl === list[idx].url) return;
    list[idx] = { ...list[idx], displayUrl: list[idx].url };
    this.setData({ heroBgList: list });
  },

  loadHotServices() {
    const sym = app.globalData.currencySymbol || '¥';
    app.request({ url: '/services' })
      .then(res => {
        const data = (res.data || []).slice(0, 8);
        const hotServices = data.map(s => ({
          id: s.id, title: s.title || '服务', desc: s.description || '专业服务',
          price: s.price || 0, priceDisplay: formatPriceDisplay(s.price, sym), emoji: '🔧', bg: 'linear-gradient(135deg, #B91C1C, #991B1B)',
        }));
        this.setData({ hotServices: hotServices.length ? hotServices : this.getFallbackHotServices() });
      })
      .catch(() => this.setData({ hotServices: this.getFallbackHotServices() }));
  },

  getFallbackHotServices() {
    const sym = app.globalData.currencySymbol || '¥';
    return [
      { id: 1, title: '设备维修', desc: '专业工程师', price: '99', priceDisplay: formatPriceDisplay('99', sym), emoji: '🔧', bg: 'linear-gradient(135deg, #B91C1C, #991B1B)' },
      { id: 2, title: '深度清洁', desc: '全方位保养', price: '149', priceDisplay: formatPriceDisplay('149', sym), emoji: '✨', bg: 'linear-gradient(135deg, #2563EB, #1D4ED8)' },
      { id: 3, title: '系统检测', desc: '全面评估', price: '49', priceDisplay: formatPriceDisplay('49', sym), emoji: '🔍', bg: 'linear-gradient(135deg, #059669, #047857)' },
      { id: 4, title: '数据恢复', desc: '专业找回', price: '199', priceDisplay: formatPriceDisplay('199', sym), emoji: '💾', bg: 'linear-gradient(135deg, #7C3AED, #6D28D9)' },
    ];
  },

  goPath(e) {
    const path = e.currentTarget.dataset.path || '';
    if (path) {
      wx.navigateTo({ url: path, fail() { wx.switchTab({ url: path }); } });
    }
  },

  goService() { wx.switchTab({ url: '/pages/service/service' }); },
  goServiceList() { wx.switchTab({ url: '/pages/service/service' }); },

  goServiceDetail(e) {
    wx.navigateTo({ url: '/pages/service-detail/service-detail?id=' + e.currentTarget.dataset.id });
  },
});
