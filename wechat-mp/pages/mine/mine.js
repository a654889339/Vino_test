const app = getApp();
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    avatarInitial: 'V',
    avatarUrl: '',
    maskedPhone: '',
    profileHeaderStyle: 'background: linear-gradient(135deg, #B91C1C, #7F1D1D);',
    stats: [],
    menus: [],
    i18n: {},
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      self.checkLoginState();
      self.loadMineBg();
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  refreshI18n() {
    const vals = this.data.stats.map(s => s.value);
    this.setData({
      i18n: {
        user: i18n.t('mine.user'),
        tapLogin: i18n.t('mine.tapLogin'),
        loginBenefits: i18n.t('mine.loginBenefits'),
        logout: i18n.t('mine.logout'),
      },
      stats: [
        { label: i18n.t('mine.pendingPay'), value: vals[0] || 0 },
        { label: i18n.t('mine.inProgress'), value: vals[1] || 0 },
        { label: i18n.t('mine.pendingReview'), value: vals[2] || 0 },
        { label: i18n.t('mine.afterSales'), value: vals[3] || 0 },
      ],
      menus: [
        { title: i18n.t('mine.orders'), icon: '/images/icons/mine-orders.svg', url: '/pages/orders/orders' },
        { title: i18n.t('mine.products'), icon: '/images/icons/mine-bag.svg', url: '/pages/my-products/my-products' },
        { title: i18n.t('mine.address'), icon: '/images/icons/mine-location.svg', url: '/pages/address/address' },
        { title: i18n.t('mine.feedback'), icon: '/images/icons/mine-comment.svg', url: '', chat: true },
        { title: i18n.t('mine.about'), icon: '/images/icons/mine-info.svg', url: '', webUrl: 'www.vinotech.cn' },
        { title: i18n.t('mine.contact'), icon: '/images/icons/mine-phone.svg', url: '', contact: true },
      ],
    });
  },

  loadMineBg() {
    app.request({ url: '/home-config' }).then(res => {
      const list = res.data || [];
      const mineBg = list.find(i => i.section === 'mineBg' && i.status === 'active');
      const style = mineBg && mineBg.imageUrl
        ? 'background-image: url(' + mineBg.imageUrl + '); background-size: cover; background-position: center;'
        : 'background: linear-gradient(135deg, #B91C1C, #7F1D1D);';
      this.setData({ profileHeaderStyle: style });
    }).catch(() => {});
  },

  checkLoginState() {
    const isLoggedIn = app.isLoggedIn();
    if (isLoggedIn && !app.globalData.userInfo) {
      app
        .request({ url: '/auth/profile' })
        .then(res => {
          const user = res.data || {};
          app.globalData.userInfo = user;
          this.applyUserData(user);
        })
        .catch(() => {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false, avatarUrl: '', avatarInitial: 'V' });
        });
    } else {
      const user = app.globalData.userInfo || null;
      if (user) {
        this.applyUserData(user);
      } else {
        this.setData({ userInfo: null, isLoggedIn: isLoggedIn, avatarUrl: '', avatarInitial: 'V' });
      }
    }
  },

  applyUserData(user) {
    const initial = (user.nickname || user.username || 'V').charAt(0);
    const avatarUrl = user.avatar || '';
    const maskedPhone = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
    this.setData({ userInfo: user, isLoggedIn: true, avatarInitial: initial, avatarUrl, maskedPhone });
  },

  onProfileTap() {
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
    } else {
      wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
    }
  },

  onMenuTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.menus[idx] || {};
    if (item.chat) {
      wx.navigateTo({ url: '/pages/chat/chat' });
    } else if (item.webUrl) {
      wx.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(item.webUrl) });
    } else if (item.contact) {
      wx.showModal({
        title: i18n.t('mine.contactTitle'),
        content: i18n.t('mine.contactPhone'),
        cancelText: i18n.t('mine.copy'),
        confirmText: i18n.t('mine.callNow'),
        success: (res) => {
          if (res.confirm) {
            wx.makePhoneCall({ phoneNumber: '4008030683' });
          } else {
            wx.setClipboardData({ data: '400-8030-683', success: () => wx.showToast({ title: i18n.t('mine.copied') }) });
          }
        },
      });
    } else if (item.url) {
      wx.navigateTo({ url: item.url, fail() { wx.switchTab({ url: item.url }); } });
    } else {
      wx.showToast({ title: i18n.t('mine.comingSoon'), icon: 'none' });
    }
  },

  logout() {
    wx.showModal({
      title: i18n.t('mine.logout'),
      content: i18n.t('mine.logoutConfirm'),
      success: res => {
        if (res.confirm) {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false, avatarUrl: '', avatarInitial: 'V' });
          wx.showToast({ title: i18n.t('mine.loggedOut'), icon: 'success' });
        }
      },
    });
  },
});
