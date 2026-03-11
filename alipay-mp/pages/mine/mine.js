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
      { title: '意见反馈', emoji: '💬', url: '' },
      { title: '关于Vino', emoji: 'ℹ️', url: '', webUrl: 'https://www.samyou.cn/' },
    ],
  },

  onShow() {
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
      my.navigateTo({ url: '/pages/login/login' });
    }
  },

  updateAvatar() {
    my.chooseImage({
      count: 1,
      success: (res) => {
        const tempUrl = res.apFilePaths && res.apFilePaths[0];
        if (!tempUrl) return;
        my.showLoading({ content: '上传中...' });
        my.uploadFile({
          url: app.globalData.baseUrl + '/auth/upload-avatar',
          fileType: 'image',
          fileName: 'avatar',
          filePath: tempUrl,
          header: { Authorization: 'Bearer ' + app.globalData.token },
          success: (uploadRes) => {
            my.hideLoading();
            try {
              const data = JSON.parse(uploadRes.data);
              if (data.code === 0) {
                const cosUrl = data.data.url;
                if (app.globalData.userInfo) app.globalData.userInfo.avatar = cosUrl;
                this.setData({ avatarUrl: cosUrl });
                my.showToast({ content: '头像已更新', type: 'success' });
              } else {
                my.showToast({ content: '上传失败', type: 'none' });
              }
            } catch {
              my.showToast({ content: '上传失败', type: 'none' });
            }
          },
          fail: () => {
            my.hideLoading();
            my.showToast({ content: '上传失败', type: 'none' });
          },
        });
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
      my.showToast({ content: '昵称已更新', type: 'success' });
    }).catch(() => {
      my.showToast({ content: '更新失败', type: 'none' });
    });
  },

  onMenuTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.menus[idx] || {};
    if (item.webUrl) {
      my.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(item.webUrl) });
    } else if (item.url) {
      my.switchTab({ url: item.url });
    } else {
      my.showToast({ content: '功能开发中', type: 'none' });
    }
  },

  logout() {
    my.confirm({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false, avatarUrl: '', avatarInitial: 'V' });
          my.showToast({ content: '已退出', type: 'success' });
        }
      },
    });
  },
});
