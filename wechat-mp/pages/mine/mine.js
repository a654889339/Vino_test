const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    avatarInitial: 'V',
    avatarUrl: '',
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
      { title: '意见反馈', emoji: '💬', url: '', chat: true },
      { title: '关于Vino', emoji: 'ℹ️', url: '', webUrl: 'https://www.samyou.cn/' },
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
    this.setData({ userInfo: user, isLoggedIn: true, avatarInitial: initial, avatarUrl });
  },

  onProfileTap() {
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
    }
  },

  onUpdateAvatar(e) {
    const tempUrl = e.detail.avatarUrl;
    if (!tempUrl) return;
    wx.showLoading({ title: '上传中...' });
    wx.uploadFile({
      url: app.globalData.baseUrl + '/auth/upload-avatar',
      filePath: tempUrl,
      name: 'avatar',
      header: { Authorization: 'Bearer ' + app.globalData.token },
      success: (uploadRes) => {
        wx.hideLoading();
        try {
          const data = JSON.parse(uploadRes.data);
          if (data.code === 0) {
            const cosUrl = data.data.url;
            if (app.globalData.userInfo) app.globalData.userInfo.avatar = cosUrl;
            this.setData({ avatarUrl: cosUrl });
            wx.showToast({ title: '头像已更新', icon: 'success' });
          } else {
            wx.showToast({ title: data.message || '上传失败', icon: 'none' });
          }
        } catch {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
      },
    });
  },

  onUpdateNickname(e) {
    const nickname = (e.detail.value || '').trim();
    if (!nickname || nickname === (this.data.userInfo && this.data.userInfo.nickname)) return;
    app.request({
      method: 'PUT',
      url: '/auth/profile',
      data: { nickname },
    }).then(res => {
      app.globalData.userInfo = res.data;
      this.applyUserData(res.data);
      wx.showToast({ title: '昵称已更新', icon: 'success' });
    }).catch(() => {
      wx.showToast({ title: '更新失败', icon: 'none' });
    });
  },

  onMenuTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.menus[idx] || {};
    if (item.chat) {
      wx.navigateTo({ url: '/pages/chat/chat' });
    } else if (item.webUrl) {
      wx.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(item.webUrl) });
    } else if (item.url) {
      wx.switchTab({ url: item.url });
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false, avatarUrl: '', avatarInitial: 'V' });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      },
    });
  },
});
