const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    stats: [
      { label: '待支付', value: 0 },
      { label: '进行中', value: 0 },
      { label: '待评价', value: 0 },
      { label: '售后', value: 0 },
    ],
    menus: [
      { title: '我的订单', emoji: '📋', url: '/pages/orders/orders' },
      { title: '我的收藏', emoji: '⭐', url: '' },
      { title: '地址管理', emoji: '📍', url: '' },
      { title: '优惠券', emoji: '🎫', url: '' },
      { title: '帮助中心', emoji: '❓', url: '' },
      { title: '意见反馈', emoji: '💬', url: '' },
      { title: '关于Vino', emoji: 'ℹ️', url: '' },
    ],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.checkLoginState();
  },

  checkLoginState() {
    const isLoggedIn = app.isLoggedIn();
    if (isLoggedIn && !app.globalData.userInfo) {
      app
        .request({ url: '/auth/profile' })
        .then(res => {
          const user = res.data || {};
          app.globalData.userInfo = user;
          this.setData({ userInfo: user, isLoggedIn: true });
        })
        .catch(() => {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false });
        });
    } else {
      this.setData({
        userInfo: app.globalData.userInfo || null,
        isLoggedIn,
      });
    }
  },

  onProfileTap() {
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
    }
  },

  onMenuTap(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.switchTab({ url });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      },
    });
  },
});
