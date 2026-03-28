const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    avatarInitial: 'V',
    avatarUrl: '',
    maskedPhone: '',
    profileHeaderStyle: 'background: linear-gradient(135deg, #B91C1C, #7F1D1D);',
    stats: [
      { label: '待支付', value: 0 },
      { label: '进行中', value: 0 },
      { label: '待评价', value: 0 },
      { label: '售后', value: 0 },
    ],
    menus: [
      { title: '我的订单', emoji: '📋', url: '/pages/orders/orders' },
      { title: '我的商品', emoji: '📦', url: '/pages/my-products/my-products' },
      { title: '地址管理', emoji: '📍', url: '/pages/address/address' },
      { title: '意见反馈', emoji: '💬', url: '', chat: true },
      { title: '关于Vino', emoji: 'ℹ️', url: '', webUrl: 'www.vinotech.cn' },
      { title: '联系我们', emoji: '📞', url: '', contact: true },
    ],
  },

  onShow() {
    this.checkLoginState();
    this.loadMineBg();
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
      my.navigateTo({ url: '/pages/login/login' });
    } else {
      my.navigateTo({ url: '/pages/profile-edit/profile-edit' });
    }
  },

  onMenuTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.menus[idx] || {};
    if (item.chat) {
      my.navigateTo({ url: '/pages/chat/chat' });
    } else if (item.webUrl) {
      my.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(item.webUrl) });
    } else if (item.contact) {
      my.confirm({
        title: '联系我们',
        content: '客服电话：400-8030-683',
        cancelButtonText: '复制',
        confirmButtonText: '立刻拨打',
        success: (res) => {
          if (res.confirm) {
            my.makePhoneCall({ number: '4008030683' });
          } else {
            my.setClipboard({ text: '400-8030-683' });
            my.showToast({ content: '已复制', type: 'success' });
          }
        },
      });
    } else if (item.url) {
      my.navigateTo({ url: item.url, fail() { my.switchTab({ url: item.url }); } });
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
